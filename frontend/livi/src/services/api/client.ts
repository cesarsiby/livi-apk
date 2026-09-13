import { ENV } from '../../config/env';
import { ApiError } from './errors';

type RequestOptions = RequestInit & {
  timeoutMs?: number;
  retry401?: boolean;
};

let accessTokenProvider: (() => string | undefined) | undefined;
let refreshHandler: (() => Promise<string | undefined>) | undefined;
let sessionIdProvider: (() => string | undefined) | undefined;
// Several requests can each receive a 401 within the same instant (e.g. a
// dashboard firing multiple calls in parallel on mount). Refresh tokens are
// single-use server-side (rotateRefresh revokes the old one as soon as it is
// used), so without this guard every concurrent 401 would trigger its own
// /auth/refresh call: only the first would succeed, and each of the others
// would fail on the now-rotated token and clear the session that the first
// one had just correctly renewed. Sharing one in-flight promise means every
// concurrent 401 waits on the same, single refresh attempt.
let refreshInFlight: Promise<string | undefined> | null = null;

export function configureApiAuth(
  getAccessToken: () => string | undefined,
  refresh: () => Promise<string | undefined>,
  getSessionId?: () => string | undefined,
) {
  accessTokenProvider = getAccessToken;
  refreshHandler = refresh;
  sessionIdProvider = getSessionId;
}

function requestId() {
  return `livi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
  explicitToken?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? ENV.REQUEST_TIMEOUT_MS,
  );

  try {
    const token = explicitToken ?? accessTokenProvider?.();
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    headers.set('X-Request-ID', requestId());
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const sessionId = sessionIdProvider?.();
    if (sessionId) headers.set('x-session-id', sessionId);

    let response: Response;
    try {
      response = await fetch(`${ENV.API_BASE_URL}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError('La requête a expiré. Réessayez.', { code: 'TIMEOUT' });
      }
      throw new ApiError('Impossible de joindre le serveur. Vérifiez votre connexion.', {
        code: 'NETWORK_ERROR',
        details: error,
      });
    }

    const text = await response.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }

    if (response.status === 401 && options.retry401 !== false && refreshHandler) {
      if (!refreshInFlight) {
        refreshInFlight = refreshHandler().finally(() => { refreshInFlight = null; });
      }
      const refreshed = await refreshInFlight;
      if (refreshed) {
        return apiRequest<T>(path, { ...options, retry401: false }, refreshed);
      }
    }

    if (!response.ok) {
      const code = response.status === 401
        ? 'UNAUTHORIZED'
        : response.status === 403
          ? 'FORBIDDEN'
          : response.status === 404
            ? 'NOT_FOUND'
            : response.status === 400 || response.status === 422
              ? 'VALIDATION_ERROR'
              : 'HTTP_ERROR';

      throw new ApiError(
        body?.error?.message ?? body?.message ?? body?.error ?? `Erreur API ${response.status}`,
        { code, status: response.status, details: body },
      );
    }

    // LIVI backend responses are normalized as { success, data, request_id }
    // so every feature receives the domain payload rather than the transport envelope.
    return (body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'data')) ? body.data as T : body as T;
  } finally {
    clearTimeout(timeout);
  }
}
