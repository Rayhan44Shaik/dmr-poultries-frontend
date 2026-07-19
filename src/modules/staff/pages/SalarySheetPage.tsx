// src/modules/staff/pages/SalarySheetPage.tsx

import { useState, useEffect } from 'react';
import { useSalarySheet } from '../hooks/useSalarySheet';
import { useEmployees } from '../../masters/employees/hooks/useEmployees';
import { useSafeNotification } from '../../../hooks/useSafeNotification';

type SalarySheetPageProps = { embedded?: boolean };

function SalarySheetPage({ embedded = false }: SalarySheetPageProps) {
  const { showNotification } = useSafeNotification();
  const { employees } = useEmployees();

  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [month, setMonth] = useState(defaultMonth);

  const {
    employee,
    salary,
    loading,
    isEditing,
    setIsEditing,
    calculateNetSalary,
    saveSalary,
    updateStatus,
  } = useSalarySheet(employeeId, month);

  const [formData, setFormData] = useState({
    basicSalary: 0,
    overtime: 0,
    incentives: 0,
    fuelAllowance: 0,
    nightAllowance: 0,
    leaveDeduction: 0,
    advanceRecovery: 0,
    loanEMI: 0,
    latePenalty: 0,
    otherDeductions: 0,
  });

  useEffect(() => {
    if (salary) {
      setFormData({
        basicSalary: salary.basicSalary || 0,
        overtime: salary.overtime || 0,
        incentives: salary.incentives || 0,
        fuelAllowance: salary.fuelAllowance || 0,
        nightAllowance: salary.nightAllowance || 0,
        leaveDeduction: salary.leaveDeduction || 0,
        advanceRecovery: salary.advanceRecovery || 0,
        loanEMI: salary.loanEMI || 0,
        latePenalty: salary.latePenalty || 0,
        otherDeductions: salary.otherDeductions || 0,
      });
    }
  }, [salary]);

  useEffect(() => {
    if (employees.length > 0 && employeeId === null) {
      setEmployeeId(employees[0].id);
    }
  }, [employees, employeeId]);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const handleSave = () => {
    if (!employeeId) {
      showNotification('Please select an employee.', 'error');
      return;
    }
    const result = calculateNetSalary(formData);
    const data = {
      employeeId,
      employeeName: employee?.employeeName || '',
      department: employee?.department || '',
      month,
      ...formData,
      status: 'Pending' as const,
      createdAt: salary?.createdAt || new Date().toISOString(),
    };
    saveSalary(data);
    showNotification('Salary saved successfully!', 'success');
  };

  const handleMarkPaid = () => {
    if (!salary) return;
    updateStatus('Paid');
    showNotification('Salary marked as Paid!', 'success');
  };

  const { gross, deductions, net } = calculateNetSalary(formData);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const content = (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Salary Sheet</h1>
          <p className="text-sm text-slate-500">Calculate and manage employee salary</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">
            Status: <span className={`font-medium ${salary?.status === 'Paid' ? 'text-green-600' : 'text-amber-600'}`}>
              {salary?.status || 'Not Created'}
            </span>
          </span>
          {salary?.status === 'Pending' && (
            <button
              onClick={handleMarkPaid}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium shadow-sm transition active:scale-95"
            >
              Mark as Paid
            </button>
          )}
        </div>
      </div>

      {/* Employee & Month Selection */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">Employee</label>
            <select
              value={employeeId || ''}
              onChange={(e) => setEmployeeId(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-slate-50"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.employeeName}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-slate-50"
            />
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="h-10 px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            {isEditing ? 'Cancel Edit' : 'Edit'}
          </button>
        </div>
      </div>

      {/* Salary Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Earnings */}
          <div className="p-4 border-b md:border-b-0 md:border-r border-slate-200">
            <h3 className="text-sm font-semibold text-blue-600 mb-3">Earnings</h3>
            <div className="space-y-3">
              {[
                { label: 'Basic Salary', field: 'basicSalary' },
                { label: 'Overtime', field: 'overtime' },
                { label: 'Incentives', field: 'incentives' },
                { label: 'Fuel Allowance', field: 'fuelAllowance' },
                { label: 'Night Allowance', field: 'nightAllowance' },
              ].map(({ label, field }) => (
                <div key={field} className="flex items-center gap-3">
                  <label className="text-sm text-slate-600 w-32">{label}</label>
                  <input
                    type="number"
                    value={formData[field as keyof typeof formData]}
                    onChange={(e) => handleInputChange(field as keyof typeof formData, e.target.value)}
                    disabled={!isEditing}
                    className={`flex-1 h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none ${!isEditing ? 'bg-slate-50' : 'bg-white'}`}
                  />
                </div>
              ))}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                <span className="text-sm font-semibold text-slate-700 w-32">Total Gross</span>
                <span className="text-lg font-bold text-blue-600">{formatCurrency(gross)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div className="p-4">
            <h3 className="text-sm font-semibold text-rose-600 mb-3">Deductions</h3>
            <div className="space-y-3">
              {[
                { label: 'Leave Deduction', field: 'leaveDeduction' },
                { label: 'Advance Recovery', field: 'advanceRecovery' },
                { label: 'Loan EMI', field: 'loanEMI' },
                { label: 'Late Penalty', field: 'latePenalty' },
                { label: 'Other Deductions', field: 'otherDeductions' },
              ].map(({ label, field }) => (
                <div key={field} className="flex items-center gap-3">
                  <label className="text-sm text-slate-600 w-32">{label}</label>
                  <input
                    type="number"
                    value={formData[field as keyof typeof formData]}
                    onChange={(e) => handleInputChange(field as keyof typeof formData, e.target.value)}
                    disabled={!isEditing}
                    className={`flex-1 h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none ${!isEditing ? 'bg-slate-50' : 'bg-white'}`}
                  />
                </div>
              ))}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                <span className="text-sm font-semibold text-slate-700 w-32">Total Deductions</span>
                <span className="text-lg font-bold text-rose-600">{formatCurrency(deductions)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Net Salary */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-slate-800">Net Salary Payable</span>
            <span className="text-2xl font-bold text-emerald-600">{formatCurrency(net)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={handleSave}
            disabled={!isEditing}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition active:scale-95 ${
              isEditing
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {salary ? 'Update Salary' : 'Save Salary'}
          </button>
        </div>
      </div>
    </div>
  );

  if (embedded) return content;
  return content;
}

export default SalarySheetPage;