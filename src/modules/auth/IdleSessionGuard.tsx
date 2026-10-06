// src/modules/auth/IdleSessionGuard.tsx
// -----------------------------------------------------------------------------
// Idle auto-logout: exactly 10 minutes of TRUE inactivity signs the user out.
//
// TRUE activity (resets the timer, locally AND on the server):
//   pointer/mouse interaction, keyboard interaction, touch interaction,
//   wheel, and meaningful form interaction (input/change/submit/click).
//
// These MUST NOT reset the timer: merely viewing a page, React rendering,
// API polling, background GETs, health checks, timer execution, route
// rendering, a tab becoming visible, or browser focus alone.
//
// Continuous form editing therefore never logs the user out, while reading a
// page without touching anything for 10+ minutes correctly does.
//
// Multi-tab: genuine activity in ANY tab resets the clock in EVERY tab of the
// same user (BroadcastChannel primary, storage-event fallback). Logout in one
// tab signs out all tabs (token clear + SESSION_LOGOUT event).
// -----------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { useAuth } from "../../providers/authContext";
import { useI18n } from "../../i18n";
import { activityPing } from "./authApi";
import { GENUINE_ACTIVITY_EVENTS, IDLE_TIMEOUT_MS, isGenuineActivityEvent } from "./idleActivity";
import {
  publishAuthEvent,
  readSharedActivity,
  subscribeAuthEvents,
} from "./authEvents";

export { isGenuineActivityEvent };
export { ACTIVITY_KEY as ACTIVITY_BROADCAST_KEY } from "./authEvents";

/** How long before the deadline the warning banner appears. */
const WARNING_BEFORE_MS = 60 * 1000;
/** UI/warning clears are coalesced; the activity timestamp itself is not. */
const RESET_THROTTLE_MS = 1000;
/** Genuine-activity pings to the server are throttled to this interval. */
const SERVER_PING_THROTTLE_MS = 60 * 1000;

/** sessionStorage flag the LoginPage reads to explain the signed-out state. */
export const IDLE_SIGNOUT_KEY = "dmr:signout-reason";

export default function IdleSessionGuard() {
  const { isAuthenticated, logout } = useAuth();
  const { t } = useI18n();

  // Initialised on mount inside the effect below (Date.now() is impure, so it
  // never belongs in render).
  const lastActivityRef = useRef<number>(0);
  const lastPingRef = useRef<number>(0);
  const warningActiveRef = useRef(false);
  const [warningSecondsLeft, setWarningSecondsLeft] = useState<number | null>(null);

  const endSession = useCallback(() => {
    publishAuthEvent("SESSION_EXPIRED");
    void logout("idle");
  }, [logout]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    // Fresh clock on every sign-in — a stale "last activity" from a previous
    // session must never log the next one straight back out. Adopt a newer
    // broadcast from a sibling tab when one exists.
    let seed = Date.now();
    try {
      const broadcast = readSharedActivity();
      if (broadcast != null && broadcast > seed - IDLE_TIMEOUT_MS && broadcast <= Date.now()) {
        seed = broadcast;
      }
    } catch {
      // storage unavailable — local clock only
    }
    lastActivityRef.current = seed;
    lastPingRef.current = 0;
    warningActiveRef.current = false;
    setWarningSecondsLeft(null);

    let throttled = false;
    const broadcastActivity = (now: number) => {
      publishAuthEvent("USER_ACTIVITY");
      // Throttled server ping: the ONLY request that extends the server-side
      // idle deadline. Polling, /auth/me, and timers never call it.
      if (now - lastPingRef.current >= SERVER_PING_THROTTLE_MS) {
        lastPingRef.current = now;
        activityPing();
      }
    };

    const markActivity = () => {
      // Always bump the idle clock — keyboard (Tab) and mouse must both count,
      // even when UI warning-clear is throttled.
      const now = Date.now();
      lastActivityRef.current = now;

      // During the final warning minute, clear the banner immediately.
      if (warningActiveRef.current) {
        warningActiveRef.current = false;
        setWarningSecondsLeft(null);
      } else if (throttled) {
        return;
      } else {
        throttled = true;
        window.setTimeout(() => {
          throttled = false;
        }, RESET_THROTTLE_MS);
        warningActiveRef.current = false;
        setWarningSecondsLeft(null);
      }
      broadcastActivity(now);
    };

    // Sibling-tab activity: another tab of the SAME user interacted, so this
    // tab's session is active too. Adopt newer timestamps only — a stale or
    // future value can never extend or shorten this tab's deadline wrongly.
    // Idempotent: duplicate delivery (channel + fallback) is harmless.
    const unsubscribe = subscribeAuthEvents((event) => {
      if (event.kind !== "USER_ACTIVITY") return;
      const at = event.at;
      const now = Date.now();
      if (!Number.isFinite(at) || at <= lastActivityRef.current) return;
      if (at > now) return;
      if (now - at >= IDLE_TIMEOUT_MS) return;
      lastActivityRef.current = at;
      if (warningActiveRef.current) {
        warningActiveRef.current = false;
        setWarningSecondsLeft(null);
      }
    });

    // capture: input inside modals, grids and React portals all bubbles to
    // window anyway, but capture guarantees nothing stops it — including Tab
    // handled by focusable controls that call preventDefault.
    // NOTE: focus/scroll/visibility are deliberately ABSENT (see idleActivity).
    const events: readonly string[] = GENUINE_ACTIVITY_EVENTS;
    const onActivity = () => markActivity();
    events.forEach((event) => window.addEventListener(event, onActivity, { capture: true, passive: true }));

    // One lightweight interval drives both the deadline check and the
    // warning countdown — cheaper than per-keystroke timer churn. On resume
    // after sleep the Date.now() math recalculates remaining time; focus or
    // visibility alone never writes the clock.
    const tick = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      const remaining = IDLE_TIMEOUT_MS - idleFor;
      if (remaining <= 0) {
        endSession();
        return;
      }
      const inWarning = remaining <= WARNING_BEFORE_MS;
      warningActiveRef.current = inWarning;
      setWarningSecondsLeft(inWarning ? Math.ceil(remaining / 1000) : null);
    }, 1000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity, { capture: true }));
      unsubscribe();
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
          // Stay signed in → full 10-minute restart from now.
          const now = Date.now();
          lastActivityRef.current = now;
          lastPingRef.current = now;
          warningActiveRef.current = false;
          setWarningSecondsLeft(null);
          activityPing();
          publishAuthEvent("USER_ACTIVITY");
        }}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
      >
        {t("auth.idle.stay")}
      </button>
    </div>
  );
}
