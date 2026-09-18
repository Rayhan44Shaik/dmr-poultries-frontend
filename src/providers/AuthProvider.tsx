import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { currentUserRequest, loginRequest, logoutRequest, type AuthenticatedUser } from '../modules/auth/authApi';
import { clearSession, getCachedUser, getStoredToken, setCachedUser } from '../modules/auth/tokenStore';
import { sweepWorkspaceCaches } from '../modules/auth/cacheSweep';
import { IDLE_SIGNOUT_KEY } from '../modules/auth/IdleSessionGuard';
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

  // The `dmr:auth-expired` listener is ALWAYS on for the life of the document:
  // a 401 from any endpoint (a genuinely dead session) ends it and lands on a
  // fresh sign-in document. It NEVER overwrites the idle-signout reason — an
  // in-flight request 401ing right after the idle logout must not replace the
  // "signed out after 10 minutes of inactivity" note with "session expired".
  useEffect(() => {
    if (demoMode) return undefined;
    const expired = () => {
      try {
        if (sessionStorage.getItem(IDLE_SIGNOUT_KEY) !== "idle") {
          sessionStorage.setItem(IDLE_SIGNOUT_KEY, "expired");
        }
      } catch {
        // storage blocked — the notice is cosmetic
      }
      clearSession();
      setUser(null);
      hardNavigate('/');
    };
    window.addEventListener('dmr:auth-expired', expired);
    return () => window.removeEventListener('dmr:auth-expired', expired);
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) return undefined;
    // No token → nothing to revalidate (sign-in screen / fresh document).
    if (!getStoredToken()) return undefined;
    let active = true;
    currentUserRequest()
      .then((value) => {
        if (!active) return;
        // Identity-stable update: re-setting an equivalent user would re-run
        // this effect (it depends on `user`) and loop /auth/me forever.
        setUser((prev) => (prev && prev.username === value.username && prev.role === value.role ? prev : value));
        setCachedUser(value);
      })
      .catch((cause) => {
        if (!active) return;
        if (isSessionInvalid(cause)) {
          // Definitive: the server rejected this (stale) session. Clear it and
          // go to a fresh sign-in document QUIETLY — no "session expired"
          // note: the user did nothing wrong; a plain sign-in screen is the
          // honest state. The full reload also guarantees the next sign-in
          // starts with no module cache of this user.
          clearSession();
          setUser(null);
          hardNavigate("/");
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
    return () => { active = false; };
  }, [demoMode, user]);

  const isAuthenticated = !!user;

  const login = useCallback(async (username: string, password: string) => {
    const session = await loginRequest(username, password);
    setCachedUser(session.user);
    setUser(session.user);
    return session.user;
  }, []);

  /** Sign-in pages call this after a direct API login: the app mounts in THIS
   *  document (no reload) — the session cannot be lost in transit, even when
   *  the browser refuses to persist the token. */
  const adoptSession = useCallback((value: AuthenticatedUser) => {
    setCachedUser(value); // no-op-safe when storage is blocked (memory bag)
    setUser(value);
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

  const value = useMemo(() => ({ isAuthenticated, loading, user, login, adoptSession, logout }), [isAuthenticated, loading, login, adoptSession, logout, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
