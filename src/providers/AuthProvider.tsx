import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { currentUserRequest, loginRequest, logoutRequest, type AuthenticatedUser } from '../modules/auth/authApi';
import { AuthContext } from './authContext';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

