import { memo } from 'react';
import { CalendarCheck2 } from 'lucide-react';
import { useDutyPlannerText } from '../../hooks/useDutyPlannerText';
import DutyDateFilter from './DutyDateFilter';

interface Props {
  dates: string[];
  value: string | null;
  onChange: (date: string | null) => void;
}

/**
 * "Duty Assign" table header. Compact — same heading size as the Recent Trip
 * Activity card — with a small static orange duty logo (no animation: the
 * icon is a marker, not a status, so it holds still while the table loads and
 * while it is read). The date-wise filter dropdown lives here, at table level
 * — small, simple and pinned to the right edge.
 */
function DutyTableHeader({ dates, value, onChange }: Props) {
  const { t } = useDutyPlannerText();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-2.5">
      <div className="group flex min-w-0 shrink-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100">
          <CalendarCheck2 className="text-orange-600" size={16} aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700">{t('dutyAssign')}</h3>
      </div>
      <DutyDateFilter dates={dates} value={value} onChange={onChange} />
    </div>
  );
}
export default memo(DutyTableHeader);
