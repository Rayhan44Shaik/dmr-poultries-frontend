// src/routes/AuthGate.tsx
// -----------------------------------------------------------------------------
// The single authentication door of the app.
//
//   • while the session is being restored → branded splash
//   • no signed-in user                   → the sign-in screen ( LoginPage )
//   • signed in                           → the app, wrapped in the idle
//                                           session guard (10 min auto-logout)
// -----------------------------------------------------------------------------
import type { ReactNode } from "react";
import { useAuth } from "../providers/authContext";
import LoginPage from "../modules/auth/LoginPage";
import IdleSessionGuard from "../modules/auth/IdleSessionGuard";
import BrandSplash from "./BrandSplash";

export default function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <BrandSplash />;
  if (!isAuthenticated) return <LoginPage />;
  return (
    <>
      <IdleSessionGuard />
      {children}
    </>
  );
}
