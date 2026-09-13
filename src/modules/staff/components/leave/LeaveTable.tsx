// src/modules/staff/components/leave/LeaveTable.tsx

import { memo, useState, useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  X,
  Calendar,
  Hash,
  User,
  Building2,
  CalendarOff,
  CalendarRange,
  Sun,
  MessageSquareText,
  Activity,
  Settings,
} from 'lucide-react';
import type { LeaveRequest } from '../../types/staffDashboard';
import { usePendingDelete } from '../../../../hooks/usePendingDelete';
import { PendingDeleteNotification } from '../../../../components/common/PendingDeleteNotification';
import { ActionTooltip } from '../../../../ui/ActionTooltip';
import { uiActionIconMotionClass } from '../../../../shared/ui/uiTokens';

interface LeaveTableProps {
  leaves: LeaveRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onDelete: (id: string) => void;
  onCancel: (id: string) => void;
  /** Serial-number offset for the "#" column (page-aware). */
  startIndex?: number;
}

function LeaveTable({
  leaves,
  onApprove,
  onReject,
  onDelete,
  onCancel,
  startIndex = 0,
}: LeaveTableProps) {
  const { requestDelete, cancel, pendingItems } = usePendingDelete(onDelete);
  const [viewEmployeeModal, setViewEmployeeModal] = useState<{
    employeeName: string;
    employeeId: number | string;
  } | null>(null);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  /** Leave number in the trip-number format: LEV-YYYYMMDD-NNN. */
  const leaveNumber = (leave: LeaveRequest) => {
    if (leave.leaveNo) return leave.leaveNo;
    const month = leave.createdAt.slice(0, 7).replace('-', '') || 'UNKNOWN';
    const compactId = leave.id.replace(/-/g, '');
    return `LEV-${month}-${compactId.slice(-12).toUpperCase()}`;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Pending: 'bg-amber-100 text-amber-700 border-amber-200',
      Approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      Rejected: 'bg-rose-100 text-rose-700 border-rose-200',
      Cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    return styles[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Casual: 'text-blue-600 bg-blue-50',
      Sick: 'text-rose-600 bg-rose-50',
      Emergency: 'text-orange-600 bg-orange-50',
      Annual: 'text-purple-600 bg-purple-50',
    };
    return colors[type] || '';
  };

  // Filter leaves for the modal view based on employee, year, and month
  const employeeLeaveHistory = useMemo(() => {
    if (!viewEmployeeModal) return [];
    return leaves.filter((leave) => {
      const matchesEmployee =
        leave.employeeId === viewEmployeeModal.employeeId ||
        leave.employeeName === viewEmployeeModal.employeeName;
      if (!matchesEmployee) return false;
      if (!leave.fromDate) return false;
      const leaveDate = new Date(leave.fromDate + 'T00:00:00');
      if (leaveDate.getFullYear() !== selectedYear) return false;
      if (selectedMonth !== 'all' && leaveDate.getMonth() !== Number(selectedMonth)) return false;
      return true;
    });
  }, [leaves, viewEmployeeModal, selectedYear, selectedMonth]);

  const totalDaysTaken = useMemo(() => {
    return employeeLeaveHistory.reduce((sum, l) => {
      return l.status === 'Approved' ? sum + (l.days || 0) : sum;
    }, 0);
  }, [employeeLeaveHistory]);

  if (leaves.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-sm font-medium text-slate-500">No leave requests found</p>
      </div>
    );
  }

  const th = 'px-4 py-3 text-[11px] font-bold uppercase tracking-wider';

  return (
    <>
      {/* No card chrome here — the page wrapper (border + LeaveTableHeader)
          provides it; this only scrolls the grid. */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm border-collapse">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
            <tr className="whitespace-nowrap">
              <th className={`${th} w-10 text-center`}>#</th>
              <th className={`${th} text-left`}>
                <span className="flex items-center gap-1.5">
                  <Hash size={13} className="shrink-0 text-slate-400" />
                  <span>Leave No.</span>
                </span>
              </th>
              <th className={`${th} text-left`}>
                <span className="flex items-center gap-1.5">
                  <User size={13} className="shrink-0 text-emerald-500" />
                  <span>Employee</span>
                </span>
              </th>
              <th className={`${th} text-left`}>
                <span className="flex items-center gap-1.5">
                  <Building2 size={13} className="shrink-0 text-indigo-500" />
                  <span>Department</span>
                </span>
              </th>
              <th className={`${th} text-left`}>
                <span className="flex items-center gap-1.5">
                  <CalendarOff size={13} className="shrink-0 text-purple-500" />
                  <span>Leave Type</span>
                </span>
              </th>
              <th className={`${th} text-left`}>
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} className="shrink-0 text-blue-500" />
                  <span>From</span>
                </span>
              </th>
              <th className={`${th} text-left`}>
                <span className="flex items-center gap-1.5">
                  <CalendarRange size={13} className="shrink-0 text-cyan-500" />
                  <span>To</span>
                </span>
              </th>
              <th className={`${th} text-center`}>
                <span className="flex items-center justify-center gap-1.5">
                  <Sun size={13} className="shrink-0 text-amber-500" />
                  <span>Days</span>
                </span>
              </th>
              <th className={`${th} text-left`}>
                <span className="flex items-center gap-1.5">
                  <MessageSquareText size={13} className="shrink-0 text-slate-400" />
                  <span>Reason</span>
                </span>
              </th>
              <th className={`${th} text-center`}>
                <span className="flex items-center justify-center gap-1.5">
                  <Activity size={13} className="shrink-0 text-sky-500" />
                  <span>Status</span>
                </span>
              </th>
              <th className={`${th} text-right`}>
                <span className="flex items-center justify-end gap-1.5">
                  <Settings size={13} className="shrink-0 text-slate-400" />
                  <span>Action</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leaves.map((leave, index) => (
              <tr
                key={leave.id}
                className={`transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'} hover:bg-slate-50/60`}
              >
                <td className="w-10 px-4 py-3 text-center text-xs font-medium text-slate-500">
                  {startIndex + index + 1}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs font-bold text-slate-900 tabular-nums">
                  {leaveNumber(leave)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-700">{leave.employeeName}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{leave.department || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${getTypeColor(leave.type)}`}>
                    {leave.type}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-600">{leave.fromDate}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-600">{leave.toDate}</td>
                <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">{leave.days}</td>
                <td className="max-w-[160px] truncate px-4 py-3 text-xs text-slate-500" title={leave.reason}>
                  {leave.reason || '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusBadge(leave.status)}`}>
                    {leave.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* View — the TripRecentTable reference tile, verbatim. */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedYear(new Date().getFullYear());
                        setSelectedMonth('all');
                        setViewEmployeeModal({
                          employeeName: leave.employeeName,
                          employeeId: leave.employeeId,
                        });
                      }}
                      className="group relative flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600 shadow-sm transition-all hover:bg-violet-500 hover:text-white active:scale-95"
                      aria-label={`View leave history for ${leave.employeeName}`}
                    >
                      <span className={`inline-flex ${uiActionIconMotionClass.view}`}><Eye size={14} /></span>
                      <ActionTooltip label="View leave history" />
                    </button>
                    {leave.status === 'Pending' && (
                      <button
                        type="button"
                        onClick={() => onApprove(leave.id)}
                        className="group relative flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-sm transition-all hover:bg-emerald-500 hover:text-white active:scale-95"
                        aria-label={`Approve leave for ${leave.employeeName}`}
                      >
                        <span className={`inline-flex ${uiActionIconMotionClass.approve}`}><CheckCircle size={14} /></span>
                        <ActionTooltip label="Approve" />
                      </button>
                    )}
                    {leave.status === 'Approved' && (
                      <button
                        type="button"
                        onClick={() => { if (window.confirm(`Cancel approved leave for ${leave.employeeName}?`)) onCancel(leave.id); }}
                        className="group relative flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 shadow-sm transition-all hover:bg-slate-500 hover:text-white active:scale-95"
                        aria-label={`Cancel leave for ${leave.employeeName}`}
                      >
                        <span className={`inline-flex ${uiActionIconMotionClass.close}`}><XCircle size={14} /></span>
                        <ActionTooltip label="Cancel leave" />
                      </button>
                    )}
                    {leave.status === 'Pending' && (
                      <button
                        type="button"
                        onClick={() => {
                          const reason = prompt('Rejection reason:');
                          if (reason !== null) onReject(leave.id, reason);
                        }}
                        className="group relative flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shadow-sm transition-all hover:bg-rose-500 hover:text-white active:scale-95"
                        aria-label={`Reject leave for ${leave.employeeName}`}
                      >
                        <span className={`inline-flex ${uiActionIconMotionClass.reject}`}><XCircle size={14} /></span>
                        <ActionTooltip label="Reject" />
                      </button>
                    )}
                    {leave.status === 'Pending' && (
                      <button
                        type="button"
                        onClick={() => requestDelete(leave.id, { label: `Deleting leave for ${leave.employeeName}` })}
                        className="group relative flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shadow-sm transition-all hover:bg-rose-500 hover:text-white active:scale-95"
                        aria-label={`Delete leave for ${leave.employeeName}`}
                      >
                        <span className={`inline-flex ${uiActionIconMotionClass.delete}`}><Trash2 size={14} /></span>
                        <ActionTooltip label="Delete" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Employee Leave History Modal */}
      {viewEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Leave History: {viewEmployeeModal.employeeName}
                </h3>
                <p className="text-xs text-slate-500">
                  Approved leaves taken for selected year & month
                </p>
              </div>
              <button
                onClick={() => setViewEmployeeModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Controls */}
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-slate-500" />
                <span className="text-xs font-medium text-slate-600">Filter By:</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-medium bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-medium bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="all">All Months</option>
                  <option value="0">January</option>
                  <option value="1">February</option>
                  <option value="2">March</option>
                  <option value="3">April</option>
                  <option value="4">May</option>
                  <option value="5">June</option>
                  <option value="6">July</option>
                  <option value="7">August</option>
                  <option value="8">September</option>
                  <option value="9">October</option>
                  <option value="10">November</option>
                  <option value="11">December</option>
                </select>
              </div>
            </div>

            {/* Modal Body / Table */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl p-3">
                <span className="text-xs font-semibold text-blue-800">Total Approved Leave Days:</span>
                <span className="text-sm font-bold text-blue-900 bg-white px-2.5 py-1 rounded-md shadow-xs">
                  {totalDaysTaken} Days
                </span>
              </div>

              {employeeLeaveHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No leave requests found for the selected year and month.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">From → To</th>
                        <th className="px-3 py-2 font-medium text-center">Days</th>
                        <th className="px-3 py-2 font-medium text-center">Status</th>
                        <th className="px-3 py-2 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                      {employeeLeaveHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5">
                            <span className={`inline-block px-2 py-0.5 rounded-full font-medium ${getTypeColor(item.type)}`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {item.fromDate} → {item.toDate}
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold">{item.days}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full font-medium border ${getStatusBadge(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-500 italic max-w-[150px] truncate">
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
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setViewEmployeeModal(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <PendingDeleteNotification items={pendingItems} onCancel={cancel} />
    </>
  );
}

export default memo(LeaveTable);
