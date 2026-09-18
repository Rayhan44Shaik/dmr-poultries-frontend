import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { currentUserRequest, loginRequest, logoutRequest, storeToken, type AuthenticatedUser } from '../modules/auth/authApi';
import { getStoredToken } from '../modules/auth/tokenStore';
import { sweepWorkspaceCaches } from '../modules/auth/cacheSweep';
import { AuthContext } from './authContext';

interface AuthProviderProps {
  children: ReactNode;
}

const DEMO_USER: AuthenticatedUser = {
  id: 0,
  username: 'demo',
  displayName: 'Demo Owner',
  role: 'OWNER',
  employeeId: null,
};

/**
 * End the SPA session by navigating the document. A full load guarantees every
 * module-level cache (approval snapshot, collection snapshot, trip service,
 * master caches) is rebuilt from scratch under the new identity — nothing
 * in-memory can cross from one user's session into the next.
 */
function hardNavigate(to: string): void {
  try {
    window.location.replace(to);
  } catch {
    // navigation blocked (sandboxed preview) — SPA fallback below still runs
  }
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  // Development-only preview bypass. It can be enabled for this server with
  // VITE_DEMO_MODE=1, or per URL with ?demo=1. Production always uses auth.
  const demoMode = import.meta.env.DEV && (
    import.meta.env.VITE_DEMO_MODE === '1' ||
    new URLSearchParams(window.location.search).get('demo') === '1'
  );
  const [user, setUser] = useState<AuthenticatedUser | null>(demoMode ? DEMO_USER : null);
  const [loading, setLoading] = useState(!demoMode);

  useEffect(() => {
    if (demoMode) return undefined;
    // No stored token → there is no session to restore. Skip the network
    // round-trip entirely so the sign-in screen appears the moment the app
    // boots (the branded splash only shows when a session may exist).
    if (!getStoredToken()) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    // Restores the session from the stored bearer token; an expired token
    // answers 401 and the app starts on the sign-in screen.
    currentUserRequest().then((value) => { if (active) setUser(value); }).catch(() => {
      storeToken(null);
      if (active) setUser(null);
    }).finally(() => { if (active) setLoading(false); });
    const expired = () => {
      storeToken(null);
      // A dead session mid-app: hard-navigate so no fetched data lingers.
      hardNavigate('/');
    };
    window.addEventListener('dmr:auth-expired', expired);
    return () => { active = false; window.removeEventListener('dmr:auth-expired', expired); };
  }, [demoMode]);

  const isAuthenticated = !!user;

  const login = useCallback(async (username: string, password: string) => {
    const session = await loginRequest(username, password);
    setUser(session.user);
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
      // Wipe every cached business dataset before the sign-in screen returns,
      // so the next identity — whoever it is — starts with nothing of this
      // user's data on the machine.
      sweepWorkspaceCaches();
      hardNavigate('/');
    }
  }, []);

  const value = useMemo(() => ({ isAuthenticated, loading, user, login, logout }), [isAuthenticated, loading, login, logout, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
