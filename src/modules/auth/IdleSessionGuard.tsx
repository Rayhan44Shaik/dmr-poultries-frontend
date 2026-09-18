// src/modules/auth/IdleSessionGuard.tsx
// -----------------------------------------------------------------------------
// Idle auto-logout.
//
// While a user is signed in, ANY of these reset a 10-minute timer:
//   mouse movement, mouse/touch presses, key presses, scrolling, wheel.
// If the timer ever completes — i.e. genuinely no input for 10 minutes — the
// session is ended and the app drops back to the sign-in screen, where a
// notice explains why. A visible warning banner appears for the final minute
// with a "Stay signed in" button, so reading a printed sheet next to the
// screen never ends in a surprise logout without a way back.
// -----------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { useAuth } from "../../providers/authContext";
import { useI18n } from "../../i18n";

/** Sign out after this much time with zero input. */
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
/** How long before the deadline the warning banner appears. */
const WARNING_BEFORE_MS = 60 * 1000;
/** Activity events are coalesced to at most one timer reset per second. */
const RESET_THROTTLE_MS = 1000;

/** sessionStorage flag the LoginPage reads to explain the signed-out state. */
export const IDLE_SIGNOUT_KEY = "dmr:signout-reason";

const ACTIVITY_EVENTS: readonly (keyof WindowEventMap)[] = [
  "pointermove",
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
];

export default function IdleSessionGuard() {
  const { isAuthenticated, logout } = useAuth();
  const { t } = useI18n();

  // Initialised on mount inside the effect below (Date.now() is impure, so it
  // never belongs in render).
  const lastActivityRef = useRef<number>(0);
  const [warningSecondsLeft, setWarningSecondsLeft] = useState<number | null>(null);

  const endSession = useCallback(() => {
    // The login page reads this to show the "signed out after 10 minutes of
    // inactivity" notice instead of a bare form.
    try {
      sessionStorage.setItem(IDLE_SIGNOUT_KEY, "idle");
    } catch {
      // ignore — the notice is cosmetic
    }
    void logout();
  }, [logout]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    // Fresh clock on every sign-in — a stale "last activity" from a previous
    // session must never log the next one straight back out. (The guard only
    // mounts while authenticated, so the banner state starts clean too.)
    lastActivityRef.current = Date.now();

    let throttled = false;
    const markActivity = () => {
      if (throttled) return;
      throttled = true;
      window.setTimeout(() => {
        throttled = false;
      }, RESET_THROTTLE_MS);
      lastActivityRef.current = Date.now();
      setWarningSecondsLeft(null);
    };

    // capture: input inside iframes-less modals, grids and React portals all
    // bubbles to window anyway, but capture guarantees nothing stops it.
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActivity, { capture: true, passive: true }));

    // One lightweight interval drives both the deadline check and the
    // warning countdown — cheaper than per-keystroke timer churn.
    const tick = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      const remaining = IDLE_TIMEOUT_MS - idleFor;
      if (remaining <= 0) {
        endSession();
        return;
      }
      setWarningSecondsLeft(remaining <= WARNING_BEFORE_MS ? Math.ceil(remaining / 1000) : null);
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActivity, { capture: true }));
      window.clearInterval(tick);
    };
  }, [isAuthenticated, endSession]);

  if (warningSecondsLeft == null) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-5 left-1/2 z-[95] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-amber-300 bg-white px-4 py-3 shadow-card-lg dark:border-amber-500/40 dark:bg-slate-900"
    >
      <Clock3 size={18} className="shrink-0 text-amber-500" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {t("auth.idle.warning", { seconds: warningSecondsLeft })}
      </p>
      <button
        type="button"
        onClick={() => {
          lastActivityRef.current = Date.now();
          setWarningSecondsLeft(null);
        }}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
      >
        {t("auth.idle.stay")}
      </button>
    </div>
  );
}
