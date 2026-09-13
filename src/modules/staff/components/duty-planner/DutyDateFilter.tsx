import { memo } from 'react';
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
 * Date-wise column filter for the active table — rendered inline inside the
 * Duty Assign table header (table level, no separate filter card). Emerald
 * chip = column shown, dimmed chip = column hidden. The last visible date
 * cannot be hidden so the table never loses all of its columns.
 */
function DutyDateFilter({ dates, visible, onToggleDate, onShowAll }: Props) {
  const { language, t } = useDutyPlannerText();
  const allVisible = visible.length === dates.length;
  return (
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
      {!allVisible && (
        <span className="ml-1 shrink-0 text-[10.5px] font-medium text-slate-400">
          {t('daysShown', { visible: visible.length, total: dates.length })}
        </span>
      )}
    </div>
  );
}
export default memo(DutyDateFilter);
