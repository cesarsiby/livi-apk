import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '../../services/api/client';
import { authApi, OtpPurpose } from './authApi';
import { configureUploadAuth } from '../../services/api/upload';
import { configureApiAuth } from '../../services/api/client';
import { ApiError } from '../../services/api/errors';
import type { AuthSession, AuthUser } from '../../types/auth';

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  loading: boolean;
  // Password reset still sends an OTP (see OtpPurpose) — this is the one
  // legitimate remaining use after the OTP/SMS removal from account
  // opening; see authApi.ts.
  sendOtp: (phone: string, purpose?: OtpPurpose) => Promise<void>;
  // V-AUDIT: creates the account AND opens the session immediately — no
  // OTP step follows this anymore, so (unlike before) the caller needs the
  // session this returns rather than discarding it. See register() below.
  register: (data: Parameters<typeof authApi.register>[0]) => Promise<void>;
  // V-AUDIT (OTP/SMS removal): phone + password, no OTP. Replaces the old
  // verifyOtp(phone, code, 'login') path entirely.
  login: (phone: string, password: string) => Promise<void>;
  // Verifies the OTP and sets a new password in one step (see
  // authApi.resetPassword). Does not sign the person in — they land back on
  // Login afterwards to sign in with the new password.
  resetPassword: (phone: string, code: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const STORAGE_KEY = 'livi.auth.session';
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  // The API client's token/refresh callbacks are registered once (see the
  // effect below with an empty dependency array) and read the session from
  // this ref rather than closing over the `session` state variable directly.
  // Updating a ref happens synchronously during render, before any child
  // screen mounts or its effects run; going through `[session]` as an effect
  // dependency instead would leave a window — one render/commit wide — where
  // a freshly mounted screen (e.g. a dashboard firing requests on mount right
  // after OTP verification) could read the *previous* closure and send a
  // request with no/stale token, itself enough to trigger a 401.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    configureUploadAuth(() => sessionRef.current?.accessToken);
    configureApiAuth(
      () => sessionRef.current?.accessToken,
      async () => {
        const current = sessionRef.current;
        if (!current?.refreshToken) return undefined;
        try {
          const refreshed = await authApi.refresh(current.refreshToken);
          const next: AuthSession = { accessToken: refreshed.token, refreshToken: refreshed.refresh_token, sessionId: refreshed.session_id, user: refreshed.user };
          sessionRef.current = next;
          setSession(next);
          await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
          return next.accessToken;
        } catch (err) {
          // Only clear the session when the server explicitly rejected the
          // refresh token or the account (401/403) — a genuinely invalid or
          // revoked session. A network error or timeout while reaching
          // /auth/refresh is not proof the session is invalid and must not
          // force the user back to the login screen.
          const rejectedByServer = err instanceof ApiError && (err.code === 'UNAUTHORIZED' || err.code === 'FORBIDDEN');
          if (rejectedByServer) {
            sessionRef.current = null;
            setSession(null);
            await SecureStore.deleteItemAsync(STORAGE_KEY);
          }
          return undefined;
        }
      },
      () => sessionRef.current?.sessionId,
    );
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!raw) return;
        const stored = JSON.parse(raw) as AuthSession;
        // Make the stored refresh token available to the refresh handler
        // *before* calling /users/me: if the stored access token has expired
        // (the common case after the app was closed for a while — access
        // tokens live 15 minutes, refresh tokens 30 days), the 401 below can
        // then actually be refreshed instead of failing outright because the
        // refresh handler had no session to read the refresh token from yet.
        sessionRef.current = stored;
        const me = await apiRequest<AuthUser>('/users/me');
        const next = { ...stored, user: me };
        sessionRef.current = next;
        setSession(next);
        await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        sessionRef.current = null;
        // A network error or timeout only means the stored session could not
        // be confirmed right now — it says nothing about whether it's valid
        // — so the tokens are kept for the next attempt instead of being
        // wiped like a genuinely rejected/corrupted session would be.
        const genuinelyInvalid = !(err instanceof ApiError) || (err.code !== 'NETWORK_ERROR' && err.code !== 'TIMEOUT');
        if (genuinelyInvalid) {
          await SecureStore.deleteItemAsync(STORAGE_KEY);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,

    async sendOtp(phone, purpose) {
      await authApi.sendOtp(phone, purpose);
    },

    async login(phone, password) {
      const data = await authApi.login(phone, password);

      const next: AuthSession = {
        accessToken: data.token,
        refreshToken: data.refresh_token,
        sessionId: data.session_id,
        user: data.user,
      };

      sessionRef.current = next;
      setSession(next);
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
    },

    // V-AUDIT: previously `await authApi.register(data);` — the session
    // POST /auth/register already returned was thrown away, because the
    // account only became usable once a *separate* OTP verification call
    // completed and returned its own session. Registration now creates the
    // account and opens the session in the same call, so this result is
    // the only session there is; RootNavigator swaps away from the auth
    // stack the moment `session` is set here, exactly as it already did
    // for the old OTP-verify success case.
    async register(data) {
      const result = await authApi.register(data);

      const next: AuthSession = {
        accessToken: result.token,
        refreshToken: result.refresh_token,
        sessionId: result.session_id,
        user: result.user,
      };

      sessionRef.current = next;
      setSession(next);
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
    },

    async resetPassword(phone, code, newPassword) {
      await authApi.resetPassword(phone, code, newPassword);
    },

    async signOut() {
      if (session?.accessToken) {
        try {
          await authApi.logout(session.refreshToken);
        } catch {
          // Local session must still be cleared if the network is unavailable.
        }
      }
      sessionRef.current = null;
      setSession(null);
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    },
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
