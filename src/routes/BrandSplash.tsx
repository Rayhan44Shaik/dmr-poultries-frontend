// src/routes/BrandSplash.tsx
// -----------------------------------------------------------------------------
// The branded loading screen — hen + DMR Poultries wordmark on a clean WHITE
// background, emerald progress bar and soft drifting tints, so every wait in
// the app (session restore, page chunks) reads as one continuous branded
// screen. Mirrors the static boot splash baked into index.html 1:1 — the boot
// → React handoff is seamless.
// -----------------------------------------------------------------------------
import BrandMark from "../ui/BrandMark";
import { useI18n } from "../i18n";

const SPLASH_KEYFRAMES = `
  @keyframes dmr-splash-bob {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-10px) rotate(-2.5deg); }
  }
  @keyframes dmr-splash-drift-a {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
    50% { transform: translate(40px, 24px) scale(1.1); opacity: 0.9; }
  }
  @keyframes dmr-splash-drift-b {
    0%, 100% { transform: translate(0, 0) scale(1.05); opacity: 0.7; }
    50% { transform: translate(-44px, -26px) scale(0.94); opacity: 0.4; }
  }
  @keyframes dmr-splash-bar {
    0% { transform: translateX(-110%); }
    100% { transform: translateX(340%); }
  }
  @keyframes dmr-splash-dot {
    0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
    40% { opacity: 1; transform: translateY(-3px); }
  }
`;

export default function BrandSplash({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-white" role="status" aria-busy="true">
      {/* Scoped keyframes — this splash is the only user of these. */}
      <style>{SPLASH_KEYFRAMES}</style>

      {/* Soft emerald tints drifting over the white — visible movement without
          a coloured background. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute -left-28 -top-28 h-80 w-80 rounded-full bg-emerald-100/70 blur-3xl"
          style={{ animation: "dmr-splash-drift-a 7s ease-in-out infinite" }}
        />
        <div
          className="absolute -bottom-36 -right-24 h-96 w-96 rounded-full bg-teal-100/60 blur-3xl"
          style={{ animation: "dmr-splash-drift-b 9s ease-in-out infinite" }}
        />
      </div>

      {/* Brand: the hen, bobbing gently, above the wordmark. */}
      <div className="relative flex flex-col items-center px-6 text-center">
        <div style={{ animation: "dmr-splash-bob 1.9s ease-in-out infinite" }}>
          <BrandMark size="2xl" variant="plain" label="DMR Poultries" />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">DMR Poultries</h1>

        {/* Indeterminate progress — the visible pulse of the work behind it. */}
        <div className="mt-6 h-1 w-44 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full w-1/3 rounded-full bg-emerald-600"
            style={{ animation: "dmr-splash-bar 1.5s cubic-bezier(0.45, 0, 0.55, 1) infinite" }}
          />
        </div>

        <p className="mt-4 text-sm font-medium text-slate-500">
          {label ?? t("auth.restoring_session")}
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
