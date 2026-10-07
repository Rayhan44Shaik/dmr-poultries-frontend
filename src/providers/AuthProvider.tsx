import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { currentUserShared, loginRequest, logoutRequest, type AuthenticatedUser } from '../modules/auth/authApi';
import { clearSession, getCachedUser, getStoredToken, setCachedUser } from '../modules/auth/tokenStore';
import { sweepWorkspaceCaches } from '../modules/auth/cacheSweep';
import { IDLE_SIGNOUT_KEY } from '../modules/auth/IdleSessionGuard';
import { beginSignOut, endSignOut, isSigningOut } from '../modules/auth/signOutGate';
import { publishAuthEvent, subscribeAuthEvents } from '../modules/auth/authEvents';
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
  mustChangePassword: false,
};

/** Only a confirmed AUTH_* classification means the session is definitively
 *  gone — and even then only after the /auth/me re-check below confirms it.
 *  Anything else (timeout, 502/503/504, network, offline, 403, validation) is
 *  a transient or authorization failure that must NEVER bounce a signed-in
 *  user back to the sign-in screen. */
function isSessionInvalid(cause: unknown): boolean {
  const code = (cause as { code?: string } | null)?.code;
  if (typeof code === "string" && code) {
    return code === "AUTH_INVALID" || code === "AUTH_REVOKED" || code === "AUTH_EXPIRED";
  }
  // Legacy shape without a taxonomy code: only a bare 401 evicts. A 403 is
  // authorization (wrong role), never proof the session died.
  const status = (cause as { status?: number } | null)?.status;
  return status === 401;
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
  const [user, setUser] = useState<AuthenticatedUser | null>(() => demoMode ? DEMO_USER : null);
  // A restored token must be verified before mounting the dashboard. Mounting
  // first lets every dashboard hook fire with an expired/revoked token and
  // creates a large burst of 401s before /auth/me can redirect to sign-in.
  const [loading, setLoading] = useState(() => {
    if (demoMode) return false;
    return !demoMode;
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
  // The probe is SILENT (no loading splash, protected UI stays mounted) and
  // single-flight (one shared promise no matter how many 401s arrive).
  useEffect(() => {
    if (demoMode) return undefined;
    const expired = () => {
      if (isSigningOut()) return;
      currentUserShared()
        .then((value) => {
          // Server confirms the session is ALIVE — the 401 was transient.
          // Idempotent adopt: equivalent identity does not churn state.
          setCachedUser(value);
          setUser((prev) => (prev && prev.username === value.username && prev.role === value.role ? prev : value));
        })
        .catch((cause) => {
          if (isSigningOut()) return;
          if (!isSessionInvalid(cause)) return;
          const justSignedIn = Date.now() - lastAdoptedAtRef.current < 30_000;
          landOnSignIn(justSignedIn ? undefined : "expired");
        });
    };
    window.addEventListener('dmr:auth-expired', expired);
    return () => window.removeEventListener('dmr:auth-expired', expired);
  }, [demoMode, landOnSignIn]);

  // Cross-tab auth events (BroadcastChannel primary, storage fallback).
  // Logout/password-change/expiry elsewhere lands THIS tab immediately —
  // without waiting for its next API call to 401, and without loops
  // (handlers are idempotent: repeated delivery is a no-op once signed out).
  useEffect(() => {
    if (demoMode) return undefined;
    return subscribeAuthEvents((event) => {
      if (event.kind !== "SESSION_LOGOUT" && event.kind !== "SESSION_EXPIRED" && event.kind !== "PASSWORD_CHANGED") return;
      if (isSigningOut()) return;
      if (!getStoredToken() && !user) return;
      landOnSignIn(event.kind === "SESSION_EXPIRED" ? "expired" : undefined);
    });
  }, [demoMode, landOnSignIn, user]);

  // Cross-tab token-clear sync: when another tab signs out it clears the
  // shared token (storage event). This tab must follow immediately — without
  // waiting for its next API call to 401.
  useEffect(() => {
    if (demoMode) return undefined;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "dmr-auth-token") return;
      if (event.newValue) return; // a sign-in elsewhere; this tab keeps its session
      if (isSigningOut()) return;
      landOnSignIn();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [demoMode, landOnSignIn]);

  useEffect(() => {
    if (demoMode) return undefined;
    let active = true;
    currentUserShared()
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
    publishAuthEvent("SESSION_ESTABLISHED", session.user.username);
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
    publishAuthEvent("SESSION_ESTABLISHED", value.username);
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
      publishAuthEvent("SESSION_LOGOUT");
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
