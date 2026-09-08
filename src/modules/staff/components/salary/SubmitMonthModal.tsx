// src/modules/staff/components/salary/SubmitMonthModal.tsx

import { Send, X } from "lucide-react";

export type SubmitMonthModalProps = {
  monthLabel: string;
  pendingCount: number;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SubmitMonthModal({
  monthLabel,
  pendingCount,
  saving,
  onCancel,
  onConfirm,
}: SubmitMonthModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Send size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Review and Submit {monthLabel}?</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-slate-600">
          This will submit all eligible <strong>{pendingCount} Pending</strong> salary records for
          this month and trigger payslip delivery to employees with valid email addresses.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving || pendingCount === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? "Submitting..." : "Review and Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}