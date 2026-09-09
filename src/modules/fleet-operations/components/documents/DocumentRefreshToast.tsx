import { memo, useEffect, useRef } from 'react';
import { useI18n } from '../../../../i18n';
import { push } from '../../../../ui/notifications/notificationStore';

interface DocumentRefreshToastProps {
  show: boolean;
  /** Bumped on every refresh so the 5-second timer restarts from zero. */
  eventId: number;
  onDismiss: () => void;
}

/** Auto-close delay requested for the Permits & Documents refresh toast. */
const AUTO_CLOSE_MS = 5_000;

/**
 * "Refreshed" feedback for the Permits & Documents tab.
 *
 * This was a near-verbatim copy of `EmiRefreshToast` — its own portal, its own
 * `fixed top-4 right-4 z-[90]` emerald shell, its own CheckCircle2 glyph and its
 * own timer — and a fourth toast renderer in the app beside the global
 * NotificationHost. It is now an adapter over the ONE global store, so both
 * fleet tabs and every other module announce a refresh identically.
 *
 * Props are unchanged; no consumer needed editing.
 *
 * `eventId` still restarts the countdown: the store refreshes the timer of an
 * already-visible identical message instead of stacking a duplicate, which is
 * exactly the semantic this component implemented by hand.
 *
 * `onDismiss` is ref'd and kept out of the deps so an inline callback from the
 * parent cannot restart the timer on every render.
 */
function DocumentRefreshToast({ show, eventId, onDismiss }: DocumentRefreshToastProps) {
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
    push(t('notification.data_refreshed'), 'success', { duration: AUTO_CLOSE_MS });
    const timer = window.setTimeout(() => dismissRef.current(), AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [show, eventId, t]);

  return null;
}

export default memo(DocumentRefreshToast);
