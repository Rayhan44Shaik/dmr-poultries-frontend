// src/modules/staff/components/salary/SalaryView.tsx

import { X, FileText, CheckCircle2, Layers, ShieldAlert, Receipt } from 'lucide-react';

export type SalaryViewProps = {
  record: any;
  month?: string;
  onClose: () => void;
  onMarkPaid?: (id: string) => void;
  formatCurrency?: (amount: number) => string;
};

export function SalaryView({ 
  record, 
  month = 'Current Month', 
  onClose, 
  onMarkPaid, 
  formatCurrency = (amt) => `$${amt.toLocaleString()}` 
}: SalaryViewProps) {
  if (!record) return null;

  const roleStr = record.role || '';
  const lowerRole = roleStr.toLowerCase();
  
  // Only Supervisor, Driver, Helper are eligible for trips
  const eligibleForTrips = 
    lowerRole.includes('supervisor') || 
    lowerRole.includes('driver') || 
    lowerRole.includes('helper');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">{record.employeeName}</h3>
              <p className="text-xs text-slate-500">Comprehensive Payroll & Activity Sheets ({month})</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-xs text-slate-500 block mb-1">Employee ID</span>
            <span className="font-bold text-slate-800">#{record.employeeId}</span>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-xs text-slate-500 block mb-1">Department / Role</span>
            <span className="font-bold text-slate-800">{record.department} - {record.role}</span>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Layers size={14} className="text-blue-600" /> Integrated Operational Sheets
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100 flex items-start gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg mt-0.5">
                <FileText size={16} />
              </div>
              <div>
                <span className="text-xs font-semibold text-indigo-900 block">Duty Planner Sheet</span>
                <span className="text-xs text-indigo-700 block mt-0.5">Working Days: <strong className="text-indigo-900">{record.workingDays || 26} Days</strong></span>
                <span className="text-xs text-slate-500 block mt-1">Ref: {record.dutyPlannerRef}</span>
              </div>
            </div>

            <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100 flex items-start gap-3">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg mt-0.5">
                <Receipt size={16} />
              </div>
              <div>
                <span className="text-xs font-semibold text-blue-900 block">Trip List Sheet</span>
                <span className="text-xs text-blue-700 block mt-0.5">
                  Trips Completed:{' '}
                  <strong className="text-blue-900">
                    {eligibleForTrips ? `${record.tripsCompleted || 0} Trips` : '—'}
                  </strong>
                </span>
                <span className="text-xs text-slate-500 block mt-1">
                  {eligibleForTrips ? `Sheet: ${record.sourceTripList || 'N/A'}` : 'Note: Only Supervisor, Driver, Helper are eligible for trips.'}
                </span>
              </div>
            </div>

            <div className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-100 flex items-start gap-3">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-lg mt-0.5">
                <ShieldAlert size={16} />
              </div>
              <div>
                <span className="text-xs font-semibold text-rose-900 block">Deduction Sheet</span>
                <span className="text-xs text-rose-700 block mt-0.5">Leave Deductions: <strong className="text-rose-900">{formatCurrency(record.leaveDeduction || 0)}</strong></span>
                <span className="text-xs text-slate-500 block mt-0.5">Total Deductions: <strong className="text-rose-900">{formatCurrency(record.totalDeductions || 0)}</strong></span>
              </div>
            </div>

            <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-100 flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg mt-0.5">
                <ShieldAlert size={16} />
              </div>
              <div>
                <span className="text-xs font-semibold text-amber-900 block">Penalty Sheet</span>
                <span className="text-xs text-amber-700 block mt-0.5">Late Penalties: <strong className="text-amber-900">{formatCurrency(record.latePenalty || 0)}</strong></span>
                <span className="text-xs text-slate-500 block mt-1">Leaves Count: <strong className="text-amber-900">{record.leavesCount || 0} Days</strong></span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-emerald-50/60 border border-emerald-100 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-700 font-medium block">Net Salary Payable</span>
            <span className="text-xl font-extrabold text-emerald-800">{formatCurrency(record.netSalary)}</span>
          </div>
          {record.status === 'Pending' && onMarkPaid && (
            <button
              type="button"
              onClick={() => {
                onMarkPaid(record.id);
                onClose();
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              <CheckCircle2 size={15} /> Pay Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}