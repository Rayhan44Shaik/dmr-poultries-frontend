import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { currentUserRequest, loginRequest, logoutRequest, type AuthenticatedUser } from '../modules/auth/authApi';
import { clearSession, getCachedUser, getStoredToken, setCachedUser } from '../modules/auth/tokenStore';
import { sweepWorkspaceCaches } from '../modules/auth/cacheSweep';
import { IDLE_SIGNOUT_KEY } from '../modules/auth/IdleSessionGuard';
import { beginSignOut, endSignOut, isSigningOut } from '../modules/auth/signOutGate';
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

/** A 401/403 means the session is definitively gone; anything else is a
 *  transient failure (proxy hiccup, timeout, server restart) that must NEVER
 *  bounce a signed-in user back to the sign-in screen. */
function isSessionInvalid(cause: unknown): boolean {
  const status = (cause as { status?: number } | null)?.status;
  return status === 401 || status === 403;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const navigate = useNavigate();
  // When the user last signed in IN this document (for the eviction guard:
  // "session expired" seconds after a fresh sign-in is always a lie).
  const lastAdoptedAtRef = useRef(0);
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

  /** Soft land on the sign-in screen — no full document reload (that caused
   *  BrandSplash ↔ LoginPage flicker). Caches are swept in-process instead. */
  const landOnSignIn = useCallback((reason?: "idle" | "expired") => {
    beginSignOut();
    clearSession();
    setLoading(false);
    setUser(null);
    if (reason) {
      try {
        sessionStorage.setItem(IDLE_SIGNOUT_KEY, reason);
      } catch {
        // notice is cosmetic
      }
    }
    sweepWorkspaceCaches();
    navigate("/", { replace: true });
    // Release the gate after the route has settled so late 401s stay quiet.
    window.setTimeout(() => endSignOut(), 1500);
  }, [navigate]);

  // The `dmr:auth-expired` listener is ALWAYS on for the life of the document:
  // a 401 from any endpoint lands here. Before evicting the user, the session
  // is RE-CHECKED against /auth/me — only a confirmed rejection ends it.
  useEffect(() => {
    if (demoMode) return undefined;
    let probing = false;
    const expired = () => {
      if (isSigningOut()) return;
      const token = getStoredToken();
      if (!token) {
        // Session already ended deliberately — stay on the sign-in screen.
        setLoading(false);
        setUser(null);
        return;
      }
      if (probing) return;
      probing = true;
      currentUserRequest()
        .then(() => {
          // Server confirms the session is ALIVE — the 401 was transient.
        })
        .catch((cause) => {
          if (isSigningOut()) return;
          if (!isSessionInvalid(cause)) return;
          const justSignedIn = Date.now() - lastAdoptedAtRef.current < 30_000;
          landOnSignIn(justSignedIn ? undefined : "expired");
        })
        .finally(() => {
          probing = false;
        });
    };
    window.addEventListener('dmr:auth-expired', expired);
    return () => window.removeEventListener('dmr:auth-expired', expired);
  }, [demoMode, landOnSignIn]);

  useEffect(() => {
    if (demoMode) return undefined;
    // No token → nothing to revalidate (sign-in screen / fresh document).
    if (!getStoredToken()) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    currentUserRequest()
      .then((value) => {
        if (!active || isSigningOut()) return;
        // Identity-stable update: re-setting an equivalent user would re-run
        // this effect (it depends on `user`) and loop /auth/me forever.
        setUser((prev) => (prev && prev.username === value.username && prev.role === value.role ? prev : value));
        setCachedUser(value);
      })
      .catch((cause) => {
        if (!active || isSigningOut()) return;
        if (isSessionInvalid(cause)) {
          landOnSignIn();
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
  }, [demoMode, user, landOnSignIn]);

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
    endSignOut();
    lastAdoptedAtRef.current = Date.now();
    setLoading(false);
    setCachedUser(value); // no-op-safe when storage is blocked (memory bag)
    setUser(value);
  }, []);

  const logout = useCallback(async (reason?: "idle" | "expired") => {
    beginSignOut();
    try {
      await logoutRequest();
    } catch {
      // Local clear still completes when the office is unavailable.
    } finally {
      try {
        if (reason) sessionStorage.setItem(IDLE_SIGNOUT_KEY, reason);
        else sessionStorage.removeItem(IDLE_SIGNOUT_KEY);
      } catch {
        // notice is cosmetic
      }
      clearSession();
      setLoading(false);
      setUser(null);
      sweepWorkspaceCaches();
      navigate("/", { replace: true });
      window.setTimeout(() => endSignOut(), 1500);
    }
  }, [navigate]);

  const value = useMemo(
    () => ({ isAuthenticated, loading, user, login, adoptSession, logout }),
    [isAuthenticated, loading, user, login, adoptSession, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
