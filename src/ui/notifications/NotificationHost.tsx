/**
 * =============================================================================
 * NOTIFICATION HOST — the single renderer for every notification in the app
 * =============================================================================
 * Mounted ONCE (see App.tsx). Reads the framework-agnostic store in
 * `./notificationStore` and renders soft, non-blocking toasts.
 *
 * DESIGN DECISIONS
 *   • Subtle: white surface + coloured leading icon and hairline border, rather
 *     than a fully saturated coloured slab. Four stacked saturated green/red
 *     slabs read as alarms; this reads as system feedback.
 *   • Non-blocking: fixed position, `pointer-events: none` on the viewport and
 *     `auto` on the toast itself, so the page underneath stays clickable and
 *     nothing reflows when a toast appears or disappears.
 *   • Accessible: the viewport is a labelled region; each toast is
 *     `role="status"` (polite) for success/info and `role="alert"` (assertive)
 *     for warning/error. Focus is NEVER moved into a toast — screen readers
 *     announce it while keyboard users keep their place in the page.
 *   • Responsive: full-width column on phones, top-right stack from `sm` up.
 *   • Stable: items are keyed by id, so a new toast never remounts the existing
 *     ones and never restarts their entrance animation.
 * =============================================================================
 */

import { useEffect, useSyncExternalStore } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useI18n } from "../../i18n";
import {
  dismiss,
  dismissAll,
  getSnapshot,
  subscribe,
  type NotificationItem,
  type NotificationTone,
} from "./notificationStore";
import {
  uiToastClass,
  uiToastCloseClass,
  uiToastIconClass,
  uiToastMessageClass,
  uiToastViewportClass,
  type StatusTone,
} from "../../shared/ui/uiTokens";

const ICONS: Record<NotificationTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

/** Notification tone → design-system badge tone (error is the `danger` name). */
const TONE: Record<NotificationTone, StatusTone> = {
  success: "success",
  error: "danger",
  warning: "warning",
  info: "info",
};

function Toast({ item, closeLabel }: { item: NotificationItem; closeLabel: string }) {
  const Icon = ICONS[item.tone];
  const tone = TONE[item.tone];
  const assertive = item.tone === "error" || item.tone === "warning";

  return (
    <div
      className={uiToastClass(tone)}
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <Icon
        size={18}
        strokeWidth={2}
        aria-hidden="true"
        className={`mt-0.5 shrink-0 ${uiToastIconClass[tone]}`}
      />

      <div className="min-w-0 flex-1 pt-0.5">
        <p className={uiToastMessageClass}>{item.message}</p>
        {item.description ? (
          <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
            {item.description}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => dismiss(item.id)}
        className={uiToastCloseClass}
        aria-label={closeLabel}
        title={closeLabel}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}

export default function NotificationHost() {
  const { t } = useI18n();
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const hasItems = items.length > 0;

  /* Escape clears the stack, but only while something is visible — so it can
     never shadow a dialog's or menu's own Escape handling. Listeners are
     bubble-phase on purpose: a modal handles Escape first and may call
     preventDefault() to keep the notification stack untouched. */
  useEffect(() => {
    if (!hasItems) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      dismissAll();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hasItems]);

  if (!hasItems) return null;

  return (
    <div
      className={uiToastViewportClass}
      role="region"
      aria-label={t("notification.region")}
    >
      {items.map((item) => (
        <Toast key={item.id} item={item} closeLabel={t("common.close")} />
      ))}
    </div>
  );
}
