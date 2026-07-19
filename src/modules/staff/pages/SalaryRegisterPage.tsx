// src/modules/staff/pages/SalaryRegisterPage.tsx

import { useState, useMemo } from 'react';
import { useSalaryRegister } from '../hooks/useSalaryRegister';
import { useSafeNotification } from '../../../hooks/useSafeNotification';

type SalaryRegisterPageProps = { embedded?: boolean };

function SalaryRegisterPage({ embedded = false }: SalaryRegisterPageProps) {
  const { showNotification } = useSafeNotification();

  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const [month, setMonth] = useState(defaultMonth);
  const [department, setDepartment] = useState('');

  const {
    records,
    totals,
    filter,
    setFilter,
    loading,
    updateStatus,
    refresh,
    employees,
  } = useSalaryRegister(month, department);

  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department).filter(Boolean));
    return Array.from(depts);
  }, [employees]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleMarkPaid = (id: string) => {
    if (window.confirm('Mark this salary as paid?')) {
      updateStatus(id, 'Paid');
      showNotification('Salary marked as paid!', 'success');
    }
  };

  const content = (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Salary Register</h1>
        <p className="text-sm text-slate-500">Company-wide payroll ledger</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white"
            >
              <option value="All">All</option>
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
          <button
            onClick={refresh}
            className="h-10 px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Employees</p>
          <p className="text-xl font-bold text-slate-800">{totals.totalEmployees}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Net Salary</p>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(totals.totalNetSalary)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Pending</p>
          <p className="text-xl font-bold text-amber-600">{totals.pendingCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Paid</p>
          <p className="text-xl font-bold text-green-600">{totals.paidCount}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">Loading...</div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">No salary records found.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Department</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Net Salary</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Payment Date</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {records.map((record, index) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-600">{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{record.employeeName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{record.department}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-slate-800">
                      {formatCurrency(record.netSalary)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        record.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-center">
                      {record.paymentDate || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {record.status === 'Pending' && (
                        <button
                          onClick={() => handleMarkPaid(record.id)}
                          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium transition active:scale-95"
                        >
                          Pay Now
                        </button>
                      )}
                      {record.status === 'Paid' && (
                        <span className="text-xs text-slate-400">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) return content;
  return content;
}

export default SalaryRegisterPage;