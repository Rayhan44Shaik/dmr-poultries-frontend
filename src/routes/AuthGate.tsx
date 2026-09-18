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
    <div
      className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-950"
      role="status"
      aria-busy="true"
    >
      {/* Scoped keyframes — the splash is the only user of these. */}
      <style>{`
        @keyframes dmr-splash-bob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(-2.5deg); }
        }
        @keyframes dmr-splash-drift-a {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.55; }
          50% { transform: translate(46px, 28px) scale(1.12); opacity: 0.9; }
        }
        @keyframes dmr-splash-drift-b {
          0%, 100% { transform: translate(0, 0) scale(1.05); opacity: 0.8; }
          50% { transform: translate(-52px, -30px) scale(0.94); opacity: 0.45; }
        }
        @keyframes dmr-splash-breathe {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.5; }
          50% { transform: translateX(-50%) scale(1.18); opacity: 0.95; }
        }
        @keyframes dmr-splash-bar {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(340%); }
        }
        @keyframes dmr-splash-dot {
          0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>

      {/* Something is happening in the background: three slow-drifting emerald
          glows over the gradient, so the wait reads as work, not a freeze. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-400/25 blur-3xl"
          style={{ animation: "dmr-splash-drift-a 7s ease-in-out infinite" }}
        />
        <div
          className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-teal-400/20 blur-3xl"
          style={{ animation: "dmr-splash-drift-b 9s ease-in-out infinite" }}
        />
        <div
          className="absolute left-1/2 top-1/3 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl"
          style={{ animation: "dmr-splash-breathe 5s ease-in-out infinite" }}
        />
      </div>

      {/* Brand: the hen, bobbing gently, above the DMR Poultries wordmark. */}
      <div className="relative flex flex-col items-center px-6 text-center">
        <div style={{ animation: "dmr-splash-bob 1.9s ease-in-out infinite" }}>
          <BrandMark size="2xl" variant="plain" label="DMR Poultries" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">DMR Poultries</h1>

        {/* Indeterminate progress — the visible pulse of the session check. */}
        <div className="mt-6 h-1 w-44 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full w-1/3 rounded-full bg-gradient-to-r from-emerald-300 to-teal-200"
            style={{ animation: "dmr-splash-bar 1.5s cubic-bezier(0.45, 0, 0.55, 1) infinite" }}
          />
        </div>

        <p className="mt-4 text-sm font-medium text-emerald-100/80">
          {t("auth.restoring_session")}
          <span className="ml-1 inline-flex" aria-hidden="true">
            <span style={{ animation: "dmr-splash-dot 1.4s ease-in-out infinite" }}>.</span>
            <span style={{ animation: "dmr-splash-dot 1.4s ease-in-out 0.2s infinite" }}>.</span>
            <span style={{ animation: "dmr-splash-dot 1.4s ease-in-out 0.4s infinite" }}>.</span>
          </span>
        </p>
      </div>
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
