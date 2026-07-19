// src/modules/staff/components/leave/LeaveTable.tsx

import { memo } from 'react';
import { CheckCircle, XCircle, Trash2, Eye } from 'lucide-react';
import type { LeaveRequest } from '../../types/staffDashboard';

interface LeaveTableProps {
  leaves: LeaveRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onDelete: (id: string) => void;
  onView?: (id: string) => void;
}

function LeaveTable({ leaves, onApprove, onReject, onDelete, onView }: LeaveTableProps) {
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Pending: 'bg-amber-100 text-amber-700 border-amber-200',
      Approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      Rejected: 'bg-rose-100 text-rose-700 border-rose-200',
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

  if (leaves.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        No leave requests found.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Employee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">From → To</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Days</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {leaves.map((leave) => (
              <tr key={leave.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{leave.employeeName}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(leave.type)}`}>
                    {leave.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {leave.fromDate} → {leave.toDate}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 text-center">{leave.days}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(leave.status)}`}>
                    {leave.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* View button */}
                    {onView && (
                      <button onClick={() => onView(leave.id)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition" title="View">
                        <Eye size={16} />
                      </button>
                    )}

                    {/* Approve (only for Pending) */}
                    {leave.status === 'Pending' && (
                      <button onClick={() => onApprove(leave.id)} className="p-1 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition" title="Approve">
                        <CheckCircle size={16} />
                      </button>
                    )}

                    {/* Reject (only for Pending) */}
                    {leave.status === 'Pending' && (
                      <button
                        onClick={() => {
                          const reason = prompt('Rejection reason:');
                          if (reason !== null) onReject(leave.id, reason);
                        }}
                        className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                        title="Reject"
                      >
                        <XCircle size={16} />
                      </button>
                    )}

                    {/* Delete (only for Pending) */}
                    {leave.status === 'Pending' && (
                      <button onClick={() => onDelete(leave.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default memo(LeaveTable);