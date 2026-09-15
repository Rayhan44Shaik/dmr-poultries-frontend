import { memo } from 'react';
import { CalendarOff, MousePointerClick } from 'lucide-react';
import { useI18n } from '../../../../i18n';
import type { LeaveFilters } from '../../hooks/useLeaveManagement';

type LeaveStatusTab = 'All' | 'Pending' | 'Approved' | 'Rejected';

interface Props {
  status: LeaveFilters['status'];
  onStatusChange: (status: LeaveStatusTab) => void;
  /** Row count for the selected status — the chip beside the title. */
  count: number;
}

/**
 * The status values are the API's own (`All | Pending | Approved | Rejected`)
 * and are never translated — the LABEL is. That keeps the filter, the deep
 * links and the query string working identically in both languages.
 */
const STATUS_TABS: LeaveStatusTab[] = ['All', 'Pending', 'Approved', 'Rejected'];

/** Tab → dictionary key. `All` reuses the generic "All" copy. */
const TAB_KEY: Record<LeaveStatusTab, string> = {
  All: 'common.all',
  Pending: 'status.pending',
  Approved: 'status.approved',
  Rejected: 'status.rejected',
};

/**
 * "Leave Request" table header — the Leave Management twin of the Duty Assign
 * table header: compact (text-sm semibold, no subtitle) with a calm, completely
 * static sky logo tile. The CalendarOff glyph carries NO animation: a control
 * bar is a place to work, and a permanently hopping icon in the corner of the
 * table is noise, so the brand is stated once and then left alone.
 *
 * The status toggle is the TripRecentTable reference verbatim: a bordered
 * slate track with wide label-only tabs, the active tab wearing its status
 * colour (Pending orange, Approved green, Rejected light red), plus the
 * selected-status count chip beside the title.
 *
 * Everything here follows the project language switch — the switch itself lives
 * once, in the global header, so no page repeats a second toggle of its own.
 */
function LeaveTableHeader({ status, onStatusChange, count }: Props) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="flex min-w-0 shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100">
            <CalendarOff className="text-sky-600" size={16} />
          </div>
          <h3 className="text-sm font-semibold text-slate-700">{t('staff.leave.header_title')}</h3>
        </div>

        {/* Selected-status count beside the title (updates with the toggle). */}
        <span
          className="inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600 shadow-sm"
        >
          {count}
        </span>

        {/* Status toggle — the TripRecentTable reference styling. */}
        <div className="ml-2 flex items-center overflow-hidden rounded-lg border border-slate-200/80 bg-slate-50 p-0.5 shadow-sm">
          {STATUS_TABS.map((tab) => {
            const isActive = status === tab;
            const activeClass =
              tab === 'All'
                ? 'bg-white text-slate-700 shadow-sm'
                : tab === 'Pending'
                  ? 'bg-orange-50/80 text-orange-500 shadow-sm'
                  : tab === 'Approved'
                    ? 'bg-emerald-50/80 text-emerald-500 shadow-sm'
                    : 'bg-rose-50/80 text-rose-500 shadow-sm';
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onStatusChange(tab)}
                aria-pressed={isActive}
                className={`inline-flex items-center rounded-md px-5 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? activeClass
                    : 'bg-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-800'
                }`}
              >
                {t(TAB_KEY[tab])}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {/* Row-selection keyboard hint — click a row, then ArrowUp/ArrowDown to
            move, Enter to open. Clicking anywhere outside the grid deselects. */}
        <span className="hidden items-center gap-1.5 text-[11px] font-medium text-slate-400 xl:inline-flex">
          <MousePointerClick size={13} className="shrink-0" />
          <span>{t('staff.leave.hint')}</span>
        </span>
      </div>
    </div>
  );
}

export default memo(LeaveTableHeader);
