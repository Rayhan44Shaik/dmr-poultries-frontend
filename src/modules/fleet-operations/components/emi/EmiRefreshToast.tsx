import { memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, X } from 'lucide-react';
import { useI18n } from '../../../../i18n';

interface Props {
  show: boolean;
  active: boolean;
  eventId: number;
  onDismiss: () => void;
}

function EmiRefreshToast({ show, active, eventId, onDismiss }: Props) {
  const { t } = useI18n();
  useEffect(() => {
    if (!show) return;
    if (!active) { onDismiss(); return; }
    const timer = window.setTimeout(onDismiss, 5_000);
    return () => window.clearTimeout(timer);
  }, [show, active, eventId, onDismiss]);

  if (!show || !active || typeof document === 'undefined') return null;
  return createPortal(
    <div
      key={eventId}
      role="status"
      aria-label={t('fleet.emi.refresh_notification')}
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-5 right-4 z-[90] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 shadow-lg"
    >
      <CheckCircle2 size={21} aria-hidden="true" className="shrink-0 text-emerald-600" />
      <span>{t('fleet.emi.refreshed_success')}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('common.close')}
        className="pointer-events-auto -mr-1 ml-1 shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}

export default memo(EmiRefreshToast);
