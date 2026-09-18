import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { currentUserRequest, loginRequest, logoutRequest, type AuthenticatedUser } from '../modules/auth/authApi';
import { clearSession, getCachedUser, getStoredToken, setCachedUser } from '../modules/auth/tokenStore';
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

/** A 401/403 means the session is definitively gone; anything else is a
 *  transient failure (proxy hiccup, timeout, server restart) that must NEVER
 *  bounce a signed-in user back to the sign-in screen. */
function isSessionInvalid(cause: unknown): boolean {
  const status = (cause as { status?: number } | null)?.status;
  return status === 401 || status === 403;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  // Development-only preview bypass. It can be enabled for this server with
  // VITE_DEMO_MODE=1, or per URL with ?demo=1. Production always uses auth.
  const demoMode = import.meta.env.DEV && (
    import.meta.env.VITE_DEMO_MODE === '1' ||
    new URLSearchParams(window.location.search).get('demo') === '1'
  );

  // INSTANT restore: token + cached user → the app boots straight into the
  // session with no network and no splash. The /auth/me revalidation below
  // quietly corrects the record (role changes, revoked sessions).
  const [user, setUser] = useState<AuthenticatedUser | null>(() => {
    if (demoMode) return DEMO_USER;
    return getStoredToken() ? getCachedUser() : null;
  });
  // The splash only ever shows when a token exists but no cached user —
  // i.e. a browser that signed in before this optimisation existed.
  const [loading, setLoading] = useState(() => {
    if (demoMode) return false;
    return !!getStoredToken() && !getCachedUser();
  });

  useEffect(() => {
    if (demoMode) return undefined;
    // No token → `loading` already initialised false; nothing to restore.
    if (!getStoredToken()) return undefined;
    let active = true;
    currentUserRequest()
      .then((value) => {
        if (!active) return;
        setUser(value);
        setCachedUser(value);
      })
      .catch((cause) => {
        if (!active) return;
        if (isSessionInvalid(cause)) {
          // Definitive: the server rejected this session.
          clearSession();
          setUser(null);
        } else if (!getCachedUser()) {
          // No cached identity to keep showing — sign-in it is, but the
          // token is KEPT so a hiccup right after login doesn't loop.
          setUser(null);
        }
        // With a cached user: stay signed in; retry on the next boot.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const expired = () => {
      clearSession();
      setUser(null);
      hardNavigate('/');
    };
    window.addEventListener('dmr:auth-expired', expired);
    return () => { active = false; window.removeEventListener('dmr:auth-expired', expired); };
  }, [demoMode]);

  const isAuthenticated = !!user;

  const login = useCallback(async (username: string, password: string) => {
    const session = await loginRequest(username, password);
    setCachedUser(session.user);
    setUser(session.user);
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      clearSession();
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
