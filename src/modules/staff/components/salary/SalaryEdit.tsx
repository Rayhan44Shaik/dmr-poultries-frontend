// src/modules/staff/components/salary/SalaryEdit.tsx

import React, { useState, useEffect } from 'react';
import { X, Pencil, Save } from 'lucide-react';

export type SalaryEditProps = {
  record: any;
  isOpen?: boolean;
  onClose: () => void;
  onSave: (updatedRecord: any) => void;
  formatCurrency?: (amount: number) => string;
};

export function SalaryEdit({ 
  record, 
  isOpen = true, 
  onClose, 
  onSave, 
  formatCurrency = (amt) => `$${amt.toLocaleString()}` 
}: SalaryEditProps) {
  if (!isOpen || !record) return null;

  const [formData, setFormData] = useState({
    baseSalary: record.baseSalary || record.grossSalary || 0,
    leaveDeduction: record.leaveDeduction || record.totalDeductions || 0,
    latePenalty: record.latePenalty || 0,
    advanceRecovery: record.advanceRecovery || 0,
    netSalary: record.netSalary || 0,
    status: record.status || 'Pending',
  });

  // Keep form data updated when the active record changes
  useEffect(() => {
    if (record) {
      setFormData({
        baseSalary: record.baseSalary || record.grossSalary || 0,
        leaveDeduction: record.leaveDeduction || record.totalDeductions || 0,
        latePenalty: record.latePenalty || 0,
        advanceRecovery: record.advanceRecovery || 0,
        netSalary: record.netSalary || 0,
        status: record.status || 'Pending',
      });
    }
  }, [record]);

  // Auto-calculate net salary whenever components change
  useEffect(() => {
    const base = Number(formData.baseSalary) || 0;
    const deductions = Number(formData.leaveDeduction) || 0;
    const penalty = Number(formData.latePenalty) || 0;
    const advance = Number(formData.advanceRecovery) || 0;
    
    const calculatedNet = base - (deductions + penalty + advance);
    setFormData((prev) => ({ ...prev, netSalary: calculatedNet > 0 ? calculatedNet : 0 }));
  }, [formData.baseSalary, formData.leaveDeduction, formData.latePenalty, formData.advanceRecovery]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...record,
      ...formData,
      baseSalary: Number(formData.baseSalary),
      leaveDeduction: Number(formData.leaveDeduction),
      totalDeductions: Number(formData.leaveDeduction),
      latePenalty: Number(formData.latePenalty),
      advanceRecovery: Number(formData.advanceRecovery),
      netSalary: Number(formData.netSalary),
    });
    onClose();
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
              <p className="text-xs text-slate-500">{record.employeeName} ({record.department} - {record.role})</p>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Base Salary</label>
            <input
              type="number"
              name="baseSalary"
              value={formData.baseSalary}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Deductions</label>
              <input
                type="number"
                name="leaveDeduction"
                value={formData.leaveDeduction}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Late Penalty</label>
              <input
                type="number"
                name="latePenalty"
                value={formData.latePenalty}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Advance Recovery</label>
              <input
                type="number"
                name="advanceRecovery"
                value={formData.advanceRecovery}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase">Calculated Net Salary</span>
            <span className="text-lg font-extrabold text-emerald-600">{formatCurrency(formData.netSalary)}</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              <Save size={15} /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}