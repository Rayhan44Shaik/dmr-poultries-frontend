import { memo } from 'react';
import { CalendarDays } from 'lucide-react';
import { formatDutyDate, formatDutyWeekday } from '../../services/dutyReport';
import { useDutyPlannerText } from '../../hooks/useDutyPlannerText';

interface Props {
  /** Every date in the current range. */
  dates: string[];
  /** Dates currently shown in the table (the rest are filtered out). */
  visible: string[];
  onToggleDate: (date: string) => void;
  onShowAll: () => void;
}

const chipBase = 'inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Date-wise table filter: one chip per date column of the active table.
 * Emerald chip = column shown, dimmed chip = column hidden. Works for the
 * week grid and the month/custom report tables alike — the last visible date
 * cannot be hidden so the table never loses all of its columns.
 */
function DutyDateFilter({ dates, visible, onToggleDate, onShowAll }: Props) {
  const { language, t } = useDutyPlannerText();
  const allVisible = visible.length === dates.length;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <CalendarDays size={13} className="shrink-0 text-emerald-500" />
        <span>{t('dates')}</span>
      </span>
      <div role="group" aria-label={t('dates')} className="flex min-w-0 flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onShowAll}
          aria-pressed={allVisible}
          className={`${chipBase} ${allVisible
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
        >
          {t('allDates')}
        </button>
        {dates.map((date) => {
          const shown = visible.includes(date);
          const lastVisible = shown && visible.length === 1;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onToggleDate(date)}
              disabled={lastVisible}
              aria-pressed={shown}
              title={formatDutyDate(date, language)}
              className={`${chipBase} ${shown
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'}`}
            >
              {formatDutyWeekday(date, language)} {date.slice(-2)}
            </button>
          );
        })}
      </div>
      {!allVisible && (
        <span className="ml-auto shrink-0 text-[11px] font-medium text-slate-400">
          {t('daysShown', { visible: visible.length, total: dates.length })}
        </span>
      )}
    </div>
  );
}
export default memo(DutyDateFilter);
