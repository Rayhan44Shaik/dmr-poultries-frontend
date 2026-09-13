import { memo } from 'react';
import { CalendarOff } from 'lucide-react';
import type { LeaveFilters } from '../../hooks/useLeaveManagement';

type LeaveStatusTab = 'All' | 'Pending' | 'Approved' | 'Rejected';

interface Props {
  status: LeaveFilters['status'];
  onStatusChange: (status: LeaveStatusTab) => void;
  /** Row count for the selected status — the chip beside the title. */
  count: number;
}

const STATUS_TABS: LeaveStatusTab[] = ['All', 'Pending', 'Approved', 'Rejected'];

/**
 * "Leave Request" table header — the Leave Management twin of the Duty Assign
 * table header: compact (text-sm semibold, no subtitle), a small sky logo tile
 * whose CalendarOff glyph hops continuously and unconditionally (no
 * `motion-safe:` guard — it must animate for every user).
 *
 * The status toggle is the TripRecentTable reference verbatim: a bordered
 * slate track with wide label-only tabs, the active tab wearing its status
 * colour (Pending orange, Approved green, Rejected light red), plus the
 * selected-status count chip beside the title.
 */
function LeaveTableHeader({ status, onStatusChange, count }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="flex min-w-0 shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100">
            <span className="inline-flex animate-[var(--animate-brand-hop)]">
              <CalendarOff className="text-sky-600" size={16} />
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-700">Leave Request</h3>
        </div>

        {/* Selected-status count beside the title (updates with the toggle). */}
        <span
          className="inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600 shadow-sm"
          title={String(status)}
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
                {tab}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(LeaveTableHeader);
