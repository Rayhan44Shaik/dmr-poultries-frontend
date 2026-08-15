// src/modules/staff/components/salary/SalaryEdit.tsx

import { useState } from "react";
import { X, Pencil, Save } from "lucide-react";
import type { SalaryRecord } from "../../types/staffDashboard";

export type SalaryEditProps = {
  record: SalaryRecord;
  saving?: boolean;
  onClose: () => void;
  onSave: (id: string, components: Record<string, number>) => void;
  formatCurrency?: (amount: number) => string;
};

function Field({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (name: string, value: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        type="number"
        step="0.01"
        min={0}
        name={name}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(name, Number(e.target.value))}
        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

export function SalaryEdit({
  record,
  saving = false,
  onClose,
  onSave,
  formatCurrency = (amt) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amt || 0),
}: SalaryEditProps) {
  const [form, setForm] = useState<Record<string, number>>(() => ({
    basicSalary: record.basicSalary,
    overtime: record.overtime,
    incentives: record.incentives,
    fuelAllowance: record.fuelAllowance,
    nightAllowance: record.nightAllowance,
    leaveDeduction: record.leaveDeduction,
    advanceRecovery: record.advanceRecovery,
    loanEMI: record.loanEMI,
    latePenalty: record.latePenalty,
    otherDeductions: record.otherDeductions,
  }));

  const setField = (name: string, value: number) =>
    setForm((prev) => ({ ...prev, [name]: Number.isFinite(value) ? value : 0 }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(record.id, form);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Pencil size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Edit Salary Record</h3>
              <p className="text-xs text-slate-500">{record.employeeName} · {record.department}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Basic Salary</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={form.basicSalary}
              onChange={(e) => setField("basicSalary", Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Overtime" name="overtime" value={form.overtime} onChange={setField} />
            <Field label="Incentives" name="incentives" value={form.incentives} onChange={setField} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fuel Allowance" name="fuelAllowance" value={form.fuelAllowance} onChange={setField} />
            <Field label="Night Allowance" name="nightAllowance" value={form.nightAllowance} onChange={setField} />
          </div>

          <div className="border-t border-slate-100 pt-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-rose-600 mb-2">Deductions</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Leave" name="leaveDeduction" value={form.leaveDeduction} onChange={setField} />
              <Field label="Advance" name="advanceRecovery" value={form.advanceRecovery} onChange={setField} />
              <Field label="Loan EMI" name="loanEMI" value={form.loanEMI} onChange={setField} />
              <Field label="Late Penalty" name="latePenalty" value={form.latePenalty} onChange={setField} />
              <Field label="Other" name="otherDeductions" value={form.otherDeductions} onChange={setField} />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase">Current Net Salary (backend)</span>
            <span className="text-lg font-extrabold text-emerald-600">{formatCurrency(record.netSalary)}</span>
          </div>

          <p className="text-[11px] text-slate-400">
            Gross and net totals are recomputed by the backend on save. This record is editable only while Pending.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save size={15} /> {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
