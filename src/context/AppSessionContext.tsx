import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import type { SessionUser } from '../../shared/contracts';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

interface AppSessionContextValue {
  session: SessionUser | null;
  loading: boolean;
  setSession: (session: SessionUser | null) => void;
  clearSession: () => Promise<void>;
}

const AppSessionContext = createContext<AppSessionContextValue | undefined>(undefined);

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      const requestVersion = ++requestVersionRef.current;

      try {
        const response = await api.getSession();

        if (!cancelled && requestVersionRef.current === requestVersion) {
          setSessionState(response.user);
        }
      } catch {
        if (!cancelled && requestVersionRef.current === requestVersion) {
          setSessionState(null);
        }
      } finally {
        if (!cancelled && requestVersionRef.current === requestVersion) {
          setLoading(false);
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadSession();
    });

    void loadSession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  function setSession(nextSession: SessionUser | null) {
    requestVersionRef.current += 1;
    setSessionState(nextSession);
    setLoading(false);
  }

  async function clearSession() {
    requestVersionRef.current += 1;

    try {
      await api.logout();
    } finally {
      setSessionState(null);
      setLoading(false);
    }
  }

  return (
    <AppSessionContext.Provider
      value={{
        session,
        loading,
        setSession,
        clearSession,
      }}
    >
      {children}
    </AppSessionContext.Provider>
  );
}

export function useAppSession() {
  const context = useContext(AppSessionContext);
  if (!context) {
    throw new Error('useAppSession must be used within AppSessionProvider.');
  }

  return context;
}
