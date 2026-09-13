import { memo } from 'react';
import { CalendarOff } from 'lucide-react';

/**
 * "Leave Request" table header — the Leave Management twin of the Duty Assign
 * table header: compact (text-sm semibold, no subtitle), a small sky logo tile
 * whose CalendarOff glyph hops continuously and unconditionally (no
 * `motion-safe:` guard — it must animate for every user).
 */
function LeaveTableHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-2.5">
      <div className="flex min-w-0 shrink-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100">
          <span className="inline-flex animate-[var(--animate-brand-hop)]">
            <CalendarOff className="text-sky-600" size={16} />
          </span>
        </div>
        <h3 className="text-sm font-semibold text-slate-700">Leave Request</h3>
      </div>
    </div>
  );
}

export default memo(LeaveTableHeader);
