// src/modules/staff/components/leave/LeaveRequestForm.tsx

import { memo, useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';

interface LeaveRequestFormProps {
  employees: { id: number; name: string }[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

function LeaveRequestForm({ employees, onSubmit, onCancel }: LeaveRequestFormProps) {
  const [form, setForm] = useState({
    employeeId: employees.length > 0 ? employees[0].id : 0,
    employeeName: employees.length > 0 ? employees[0].name : '',
    type: 'Casual' as const,
    fromDate: '',
    toDate: '',
    days: 0,
    reason: '',
  });

  useEffect(() => {
    if (form.fromDate && form.toDate) {
      const from = new Date(form.fromDate);
      const to = new Date(form.toDate);
      const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      setForm((prev) => ({ ...prev, days: diff > 0 ? diff : 0 }));
    }
  }, [form.fromDate, form.toDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.days <= 0) {
      alert('Invalid date range.');
      return;
    }
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Plus size={16} className="text-blue-500" /> New Leave Request
        </h3>
        <button type="button" onClick={onCancel} className="p-1 hover:bg-slate-100 rounded">
          <X size={16} className="text-slate-500" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Employee</label>
          <select
            value={form.employeeId}
            onChange={(e) => {
              const id = Number(e.target.value);
              const emp = employees.find((e) => e.id === id);
              setForm((prev) => ({ ...prev, employeeId: id, employeeName: emp?.name || '' }));
            }}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-slate-50"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Leave Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as any }))}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-slate-50"
          >
            <option value="Casual">Casual</option>
            <option value="Sick">Sick</option>
            <option value="Emergency">Emergency</option>
            <option value="Annual">Annual</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
          <input
            type="date"
            value={form.fromDate}
            onChange={(e) => setForm((prev) => ({ ...prev, fromDate: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-slate-50"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
          <input
            type="date"
            value={form.toDate}
            onChange={(e) => setForm((prev) => ({ ...prev, toDate: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-slate-50"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Days</label>
          <input
            type="number"
            value={form.days}
            readOnly
            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-slate-100 text-slate-700"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Reason (optional)</label>
          <textarea
            value={form.reason}
            onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-slate-50"
            placeholder="Brief reason for leave..."
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-sm transition active:scale-95">Submit Request</button>
      </div>
    </form>
  );
}

export default memo(LeaveRequestForm);