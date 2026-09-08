import { memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, X } from 'lucide-react';
import { useI18n } from '../../../../i18n';

interface DocumentRefreshToastProps {
  show: boolean;
  /** Bumped on every refresh so the 5-second timer restarts from zero. */
  eventId: number;
  onDismiss: () => void;
}

/** Auto-close delay requested for the Permits & Documents refresh toast. */
const AUTO_CLOSE_MS = 5_000;

/**
 * Top-right confirmation toast shown after a refresh, mirroring the EMI tab's
 * toast so both fleet tabs behave the same. Portalled to <body> so no ancestor
 * overflow or stacking context can clip it, and `pointer-events-none` on the
 * shell (with the close button re-enabled) so it never blocks the page.
 */
function DocumentRefreshToast({ show, eventId, onDismiss }: DocumentRefreshToastProps) {
  const { t } = useI18n();

  // The timer fires from a callback, never synchronously in the effect body.
  useEffect(() => {
    if (!show) return;
    const timer = window.setTimeout(onDismiss, AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [show, eventId, onDismiss]);

  if (!show || typeof document === 'undefined') return null;

  return createPortal(
    <div
      key={eventId}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed top-4 right-4 z-[90] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 shadow-lg"
    >
      <CheckCircle2 size={20} aria-hidden="true" className="shrink-0 text-emerald-600" />
      <span>{t('notification.data_refreshed')}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('common.close')}
        className="pointer-events-auto -mr-1 ml-1 shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}

export default memo(DocumentRefreshToast);
