import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { currentUserRequest, loginRequest, logoutRequest, type AuthenticatedUser } from '../modules/auth/authApi';
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
    let active = true;
    currentUserRequest().then((value) => { if (active) setUser(value); }).catch(() => undefined)
      .finally(() => { if (active) setLoading(false); });
    const expired = () => setUser(null);
    window.addEventListener('dmr:auth-expired', expired);
    return () => { active = false; window.removeEventListener('dmr:auth-expired', expired); };
  }, []);

  const isAuthenticated = !!user;

  const login = useCallback(async (username: string, password: string) => {
    const session = await loginRequest(username, password);
    setUser(session.user);
  }, []);

  const logout = useCallback(async () => {
    try { await logoutRequest(); } finally { setUser(null); }
  }, []);

  const value = useMemo(() => ({ isAuthenticated, loading, user, login, logout }), [isAuthenticated, loading, login, logout, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

