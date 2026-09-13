import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { walletApi } from './walletApi';
import type { Wallet } from './types';

type WalletStoreValue = {
  wallet: Wallet | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const WalletContext = createContext<WalletStoreValue | undefined>(undefined);

export function WalletProvider({ children }: React.PropsWithChildren) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const previousUserId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (previousUserId.current !== user?.id) {
      previousUserId.current = user?.id;
      setWallet(null);
      setError(null);
    }
  }, [user?.id]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await walletApi.getWallet();
      setWallet(response.wallet ?? response);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger le wallet.');
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({ wallet, loading, error, refresh }),
    [wallet, loading, error, refresh],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletStore() {
  const value = useContext(WalletContext);
  if (!value) throw new Error('useWalletStore must be used inside WalletProvider');
  return value;
}
