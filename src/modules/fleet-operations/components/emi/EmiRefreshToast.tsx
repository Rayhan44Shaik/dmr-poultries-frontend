import { memo, useEffect, useRef } from 'react';
import { useI18n } from '../../../../i18n';
import { push } from '../../../../ui/notifications/notificationStore';

interface Props {
  show: boolean;
  active: boolean;
  eventId: number;
  onDismiss: () => void;
}

/**
 * "Refreshed" feedback for the EMI tab.
 *
 * Previously a bespoke portalled toast (`fixed top-4 right-4 z-[90]`, its own
 * emerald shell, CheckCircle2 glyph and 5-second timer) — a near-verbatim copy
 * of `DocumentRefreshToast`, and a third toast renderer alongside the global
 * NotificationHost. It is now an adapter over the ONE global store, so the EMI
 * and Documents tabs and the rest of the ERP all announce refreshes identically.
 *
 * Props are unchanged; no consumer needed editing.
 *
 * The `eventId` bump is still what re-triggers the notification, and the store
 * refreshes the timer of an already-visible identical message instead of
 * stacking a second one — so repeated refreshes behave exactly as before,
 * without duplicate toasts.
 *
 * `onDismiss` is ref'd and kept out of the deps for the same reason as in the
 * staff `RefreshToast`: consumers pass an inline callback, and depending on it
 * would restart the timer on every parent render.
 */
function EmiRefreshToast({ show, active, eventId, onDismiss }: Props) {
  const { t } = useI18n();
  const dismissRef = useRef(onDismiss);
  // Assigned in an effect, never during render: writing a ref while
  // rendering is unsafe under concurrent rendering (and is flagged by
  // the react-hooks compiler rules). This keeps the latest callback
  // without putting it in the deps below.
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!show) return;
    // Preserve the original guard: only the active tab announces a refresh.
    if (!active) {
      dismissRef.current();
      return;
    }
    push(t('fleet.emi.refreshed_success'), 'success', { duration: 5_000 });
    const timer = window.setTimeout(() => dismissRef.current(), 5_000);
    return () => window.clearTimeout(timer);
    // `eventId` is the re-trigger; `t` is stable for the current locale.
  }, [show, active, eventId, t]);

  return null;
}

export default memo(EmiRefreshToast);
