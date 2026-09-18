import { createContext, useContext } from "react";
import type { AuthenticatedUser } from "../modules/auth/authApi";

export interface AuthContextValue {
  isAuthenticated: boolean;
  loading: boolean;
  user: AuthenticatedUser | null;
  /** Resolves with the signed-in user, so callers can route by role. */
  login: (username: string, password: string) => Promise<AuthenticatedUser>;
  /** Bring an already-authenticated user into the app IN this document —
   *  used right after a direct API sign-in, so no reload can lose the
   *  session (storage-blocked browsers would bounce back to sign-in). */
  adoptSession: (user: AuthenticatedUser) => void;
  logout: (reason?: "idle" | "expired") => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
