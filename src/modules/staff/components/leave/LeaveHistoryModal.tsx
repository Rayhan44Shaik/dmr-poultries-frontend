// src/modules/staff/components/leave/LeaveHistoryModal.tsx

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Calendar,
  CalendarOff,
  CalendarRange,
  Sun,
  MessageSquareText,
  Activity,
  ArrowRight,
} from 'lucide-react';
import type { LeaveRequest } from '../../types/staffDashboard';
import { ActionTooltip } from '../../../../ui/ActionTooltip';
import { uiActionIconMotionClass } from '../../../../shared/ui/uiTokens';
import MasterDropdown from '../../../masters/components/MasterDropdown';

interface LeaveHistoryModalProps {
  /** The selected row. The page mounts this dialog only while one is selected,
   *  so its year/month filter always starts fresh. */
  leave: LeaveRequest;
  /** The loaded page of requests the history is filtered from. */
  leaves: LeaveRequest[];
  onClose: () => void;
}

/** Rolling year window for the history filter: five past years plus the
 *  coming one (in 2026: 2022-2027), so the future year is always offered. */
const MODAL_YEARS = (() => {
  const current = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => current - 4 + i);
})();

const MODAL_MONTHS = [
  { value: 'all', label: 'All Months' },
  { value: '0', label: 'January' },
  { value: '1', label: 'February' },
  { value: '2', label: 'March' },
  { value: '3', label: 'April' },
  { value: '4', label: 'May' },
  { value: '5', label: 'June' },
  { value: '6', label: 'July' },
  { value: '7', label: 'August' },
  { value: '8', label: 'September' },
  { value: '9', label: 'October' },
  { value: '10', label: 'November' },
  { value: '11', label: 'December' },
];

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-700 border-amber-200',
    Approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Rejected: 'bg-rose-100 text-rose-700 border-rose-200',
    Cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return styles[status] || 'bg-slate-100 text-slate-700 border-slate-200';
}

function getTypeColor(type: string) {
  const colors: Record<string, string> = {
    Casual: 'text-blue-600 bg-blue-50',
    Sick: 'text-rose-600 bg-rose-50',
    Emergency: 'text-orange-600 bg-orange-50',
    Annual: 'text-purple-600 bg-purple-50',
  };
  return colors[type] || '';
}

/**
 * "Leave History" dialog, opened by the View action for the selected row (and
 * by Enter / double-click on that row).
 *
 * It lives outside the table so the grid stays a plain grid and the modal only
 * exists while it is open. The header logo is a calm, static tile — same
 * no-animation rule as the table header — and focus moves into the dialog on
 * open, returns to the row that opened it on close, and Escape dismisses it.
 */
function LeaveHistoryModal({ leave, leaves, onClose }: LeaveHistoryModalProps) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  /** Whatever had focus before the dialog opened — the table row, normally. */
  const openerRef = useRef<HTMLElement | null>(null);

  // Runs once per open (the page keeps this component unmounted while closed):
  // focus moves into the dialog, and back to the row that opened it on close.
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => openerRef.current?.focus?.();
  }, []);

  // Filter the loaded requests down to this employee + year/month.
  const employeeLeaveHistory = useMemo(
    () =>
      leaves.filter((row) => {
        const matchesEmployee =
          row.employeeId === leave.employeeId || row.employeeName === leave.employeeName;
        if (!matchesEmployee) return false;
        if (!row.fromDate) return false;
        const leaveDate = new Date(row.fromDate + 'T00:00:00');
        if (leaveDate.getFullYear() !== selectedYear) return false;
        if (selectedMonth !== 'all' && leaveDate.getMonth() !== Number(selectedMonth)) return false;
        return true;
      }),
    [leaves, leave, selectedYear, selectedMonth],
  );

  const totalDaysTaken = useMemo(
    () =>
      employeeLeaveHistory.reduce(
        (sum, leave) => (leave.status === 'Approved' ? sum + (leave.days || 0) : sum),
        0,
      ),
    [employeeLeaveHistory],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-history-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        {/* Modal Header — calm static logo tile + dismiss twist X */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-100 bg-sky-50/70 shadow-inner">
              <CalendarOff className="text-sky-500" size={17} />
            </div>
            <div className="min-w-0">
              <h3 id="leave-history-title" className="truncate text-base font-bold tracking-tight text-slate-800">
                Leave History: {leave.employeeName}
              </h3>
              <p className="text-xs text-slate-500">Approved leaves taken for the selected year &amp; month</p>
            </div>
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close"
            className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 active:scale-95"
          >
            <span className={`inline-flex ${uiActionIconMotionClass.close}`}><X size={18} /></span>
          </button>
        </div>

        {/* Filter Controls — trips-list supervisor dropdowns (searchable,
            five rows visible, same font & colours, rotating chevron). */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-3.5">
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="shrink-0 text-emerald-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Filter By</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MasterDropdown
              hideLabel
              label="Year"
              value={String(selectedYear)}
              options={MODAL_YEARS.map((y) => ({ value: String(y), label: String(y) }))}
              onChange={(next) => setSelectedYear(Number(next))}
              className="w-28"
            />
            <MasterDropdown
              hideLabel
              label="Month"
              value={selectedMonth}
              options={MODAL_MONTHS}
              onChange={(next) => setSelectedMonth(next || 'all')}
              searchable
              className="w-40"
            />
          </div>
        </div>

        {/* Modal Body / Table */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 p-3">
            <span className="text-xs font-semibold text-blue-800">Total Approved Leave Days:</span>
            <span className="rounded-md bg-white px-2.5 py-1 text-sm font-bold text-blue-900 shadow-xs">
              {totalDaysTaken} Days
            </span>
          </div>

          {employeeLeaveHistory.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No leave requests found for the selected year and month.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-[13px]">
                <thead className="bg-slate-50/80 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <CalendarOff size={12} className="shrink-0 text-purple-500" />
                        <span>Type</span>
                      </span>
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="shrink-0 text-blue-500" />
                        <span>From</span>
                        <ArrowRight size={10} className="shrink-0 text-slate-400" />
                        <CalendarRange size={12} className="shrink-0 text-cyan-500" />
                        <span>To</span>
                      </span>
                    </th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider">
                      <span className="flex items-center justify-center gap-1.5">
                        <Sun size={12} className="shrink-0 text-amber-500" />
                        <span>Days</span>
                      </span>
                    </th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider">
                      <span className="flex items-center justify-center gap-1.5">
                        <Activity size={12} className="shrink-0 text-sky-500" />
                        <span>Status</span>
                      </span>
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <MessageSquareText size={12} className="shrink-0 text-slate-400" />
                        <span>Reason</span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {employeeLeaveHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${getTypeColor(item.type)}`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-600">
                        {item.fromDate} → {item.toDate}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">{item.days}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusBadge(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-xs italic text-slate-500">
                        {item.reason || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="group relative inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100"
          >
            <span className={`inline-flex text-slate-500 group-hover:text-rose-600 ${uiActionIconMotionClass.close}`}>
              <X size={14} />
            </span>
            Close
            <ActionTooltip label="Close" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default LeaveHistoryModal;
