import { createContext, useContext } from "react";
import type { AuthenticatedUser } from "../modules/auth/authApi";

export interface AuthContextValue {
  isAuthenticated: boolean;
  loading: boolean;
  user: AuthenticatedUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
