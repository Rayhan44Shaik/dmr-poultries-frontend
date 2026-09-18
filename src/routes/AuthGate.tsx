// src/routes/AuthGate.tsx
// -----------------------------------------------------------------------------
// The single authentication door of the app.
//
//   • while the session is being restored → splash
//   • no signed-in user                   → the sign-in screen ( LoginPage )
//   • signed in                           → the app, wrapped in the idle
//                                           session guard (10 min auto-logout)
// -----------------------------------------------------------------------------
import type { ReactNode } from "react";
import { useAuth } from "../providers/authContext";
import LoginPage from "../modules/auth/LoginPage";
import IdleSessionGuard from "../modules/auth/IdleSessionGuard";
import BrandMark from "../ui/BrandMark";
import { useI18n } from "../i18n";

function AuthSplash() {
  const { t } = useI18n();
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-slate-100" role="status" aria-busy="true">
      <BrandMark size="lg" variant="plain" />
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-500">{t("auth.restoring_session")}</p>
    </div>
  );
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <AuthSplash />;
  if (!isAuthenticated) return <LoginPage />;
  return (
    <>
      <IdleSessionGuard />
      {children}
    </>
  );
}
