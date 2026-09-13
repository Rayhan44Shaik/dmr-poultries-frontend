import { memo } from 'react';
import { AlertCircle, CheckCircle2, Wand2 } from 'lucide-react';
import { formatDutyDate, formatDutyWeekday } from '../../services/dutyReport';
import { useDutyPlannerText } from '../../hooks/useDutyPlannerText';
import { dutyDisplayValue } from '../../i18n/dutyPlannerCopy';
import type { PendingDutyEmployee } from '../../hooks/useDutyPlanner';

interface Props {
  pending: PendingDutyEmployee[];
  unassignedCount: number;
  canEdit: boolean;
  saving?: boolean;
  /** Opens the shift picker straight on the missing (employee, day) cell. */
  onPickCell: (employeeId: number, date: string) => void;
  /** Backend auto-assign fills every pending cell it can plan. */
  onAutoAssign: () => void;
}

/**
 * "Pending duties" checker for the current week, laid out as a borderless
 * aligned table: Employee | missing-days count | day chips. Columns line up
 * across employees without visible table lines, and each employee's missing
 * days flow horizontally. A chip opens the shift picker directly on that
 * cell; Auto-assign asks the backend to plan the whole week at once.
 */
function PendingDutiesPanel({ pending, unassignedCount, canEdit, saving = false, onPickCell, onAutoAssign }: Props) {
  const { language, t } = useDutyPlannerText();
  const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
  return (
    <section id="duty-pending-panel" aria-label={t('pendingDuties')} className="overflow-hidden rounded-xl border border-amber-200/80 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-100 bg-amber-50/70 px-5 py-3.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
          {pending.length ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
        </span>
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold leading-tight text-slate-900">{t('pendingDuties')}</h3>
          <p className={`text-[11px] font-medium ${pending.length ? 'text-amber-700' : 'text-emerald-700'}`}>
            {pending.length ? t('pendingSummary', { cells: unassignedCount, employees: pending.length }) : t('ready')}
          </p>
        </div>
        {canEdit && pending.length > 0 && (
          <button
            type="button"
            onClick={onAutoAssign}
            disabled={saving}
            className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 text-xs font-semibold text-amber-700 transition hover:border-amber-400 hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Wand2 size={13} />{t('autoAssign')}
          </button>
        )}
      </header>
      {pending.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-6 text-sm font-medium text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />{t('ready')}
        </div>
      ) : (
        <div role="list" aria-label={t('pendingDuties')} className="max-h-96 overflow-y-auto px-5 py-4">
          {/* Borderless table: Employee | missing count | missing days —
              columns stay perfectly aligned across employees without any
              visible table lines; each employee's days flow horizontally
              with generous, even margins between rows and columns. */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(210px,260px)_auto_minmax(0,1fr)] sm:gap-x-6 sm:gap-y-3.5">
            {pending.map((row) => (
              <div key={row.employeeId} role="listitem" className="contents">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[11px] font-bold text-amber-700 ring-1 ring-inset ring-amber-200">{initials(row.employeeName)}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight text-slate-900">{row.employeeName}</p>
                    <p className="truncate text-[10px] font-medium leading-tight text-slate-400">{dutyDisplayValue(row.role, language)}</p>
                  </div>
                </div>
                <span title={t('missingDays')} className="inline-flex h-5 items-center justify-center self-center rounded-full bg-amber-100 px-1.5 text-[10px] font-bold tabular-nums text-amber-700">{row.missingDays.length}</span>
                <div role="group" aria-label={t('missingDays')} className="col-span-2 flex flex-wrap items-center gap-1.5 sm:col-span-1">
                  {row.missingDays.map((date) => (
                    <button
                      key={date}
                      type="button"
                      onClick={() => onPickCell(row.employeeId, date)}
                      disabled={!canEdit}
                      title={canEdit ? `${t('pendingPick')} · ${formatDutyDate(date, language)}` : t('readOnly')}
                      className="inline-flex h-6 items-center rounded-md border border-amber-200 bg-white px-1.5 text-[10.5px] font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {formatDutyWeekday(date, language)} {date.slice(-2)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
export default memo(PendingDutiesPanel);
