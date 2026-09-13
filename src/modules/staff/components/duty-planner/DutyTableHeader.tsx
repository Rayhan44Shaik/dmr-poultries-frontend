import { memo } from 'react';
import { CalendarCheck2 } from 'lucide-react';
import { useDutyPlannerText } from '../../hooks/useDutyPlannerText';
import DutyDateFilter from './DutyDateFilter';

interface Props {
  dates: string[];
  visible: string[];
  onToggleDate: (date: string) => void;
  onShowAll: () => void;
}

/**
 * "Duty Assign" table header, styled after the Rate Entry header card: a
 * 48px logo tile with the duty glyph (which hops on hover) beside the table
 * name. The date-wise column filter lives HERE, at table level — there is no
 * separate filter card above the table.
 */
function DutyTableHeader({ dates, visible, onToggleDate, onShowAll }: Props) {
  const { t } = useDutyPlannerText();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-b border-slate-100 px-5 py-4">
      <div className="group flex min-w-0 shrink-0 items-center gap-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100">
          <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-brand-hop)]">
            <CalendarCheck2 className="text-orange-600" size={26} />
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight text-slate-800">{t('dutyAssign')}</h2>
          <p className="truncate text-xs text-slate-500">{t('dutyAssignHint')}</p>
        </div>
      </div>
      <DutyDateFilter dates={dates} visible={visible} onToggleDate={onToggleDate} onShowAll={onShowAll} />
    </div>
  );
}
export default memo(DutyTableHeader);
