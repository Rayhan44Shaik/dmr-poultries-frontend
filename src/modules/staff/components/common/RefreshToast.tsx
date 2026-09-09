import React, { useEffect, useRef } from 'react';
import { push } from '../../../../ui/notifications/notificationStore';

interface RefreshToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
  isError?: boolean;
}

/**
 * Refresh/save feedback for the staff module.
 *
 * This used to be a fourth, independent toast renderer in the app: its own
 * `fixed top-4 right-4 z-50` shell, its own CheckCircle2/AlertCircle icons, its
 * own slide-in animation and its own auto-close timer — sitting alongside the
 * global NotificationHost and the EMI / Documents refresh toasts. Four
 * implementations of one idea, in four positions, with four visual treatments.
 *
 * It is now a thin adapter over the ONE global notification store, so staff
 * feedback looks, animates, times out and announces itself exactly like every
 * other notification in the ERP.
 *
 * The public props are unchanged, so none of the consuming pages needed edits.
 *
 * WHY THIS IS SAFE (and not a behaviour change)
 *   • The store dedupes by `tone::message` and REFRESHES THE TIMER on a repeat
 *     push rather than ignoring it — which is precisely the "restart the
 *     5-second countdown" semantic this component implemented locally.
 *   • `onClose` is still called after `duration`, so the parent's own
 *     `isVisible` state is released exactly as before.
 *   • The host is non-blocking, never steals focus, and is `aria-live`, matching
 *     the previous `role="alert"` + `aria-live="polite"` announcement.
 *   • It renders nothing itself, so it can no longer be clipped by an ancestor's
 *     overflow or stacking context — the host is portalled once in `App`.
 *
 * `onClose` is held in a ref and kept OUT of the effect deps: consumers pass an
 * inline arrow function, so depending on it would re-run the effect (and reset
 * the timer) on every parent render.
 */
const RefreshToast: React.FC<RefreshToastProps> = ({
  message,
  isVisible,
  onClose,
  duration = 5000,
  isError = false,
}) => {
  const closeRef = useRef(onClose);
  // Assigned in an effect, never during render: writing a ref while
  // rendering is unsafe under concurrent rendering (and is flagged by
  // the react-hooks compiler rules). This keeps the latest callback
  // without putting it in the deps below.
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isVisible) return;
    const text = (message ?? '').toString().trim();
    // Never announce an empty toast; release the parent state immediately.
    if (!text) {
      closeRef.current();
      return;
    }
    push(text, isError ? 'error' : 'success', { duration });
    const timer = window.setTimeout(() => closeRef.current(), duration);
    return () => window.clearTimeout(timer);
  }, [isVisible, message, duration, isError]);

  return null;
};

export default RefreshToast;
