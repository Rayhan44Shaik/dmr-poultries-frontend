// src/modules/staff/hooks/useStaffReports.ts

import { useState, useEffect, useCallback, useMemo } from 'react';

export type ReportType = 'employee' | 'duty' | 'leave' | 'salary_register' | 'performance';

export function useStaffReports() {
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const [filters, setFilters] = useState({
    reportType: 'employee' as ReportType,
    fromDate: firstDayOfMonth,
    toDate: today,
  });

  const [rawEmployees, setRawEmployees] = useState<any[]>([]);
  const [rawDuty, setRawDuty] = useState<any[]>([]);
  const [rawLeave, setRawLeave] = useState<any[]>([]);
  const [rawSalary, setRawSalary] = useState<any[]>([]);
  const [rawPerformance, setRawPerformance] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      const storedEmployees = JSON.parse(localStorage.getItem('dmr_staff_employees') || 'null') || [
        { id: 1, name: 'Ruhulla', department: 'Accounts', role: 'Senior Accountant', phone: '9988776655', email: 'ruhulla@dmr.com', address: 'Main Office, Guntur', joiningDate: '2023-01-15', licenseNo: '-' },
        { id: 2, name: 'Suresh', department: 'Accounts', role: 'Accountant', phone: '9988776656', email: 'suresh@dmr.com', address: 'Branch Office, Tenali', joiningDate: '2023-03-10', licenseNo: '-' },
        { id: 3, name: 'Ramesh', department: 'Accounts', role: 'Junior Accountant', phone: '9988776657', email: 'ramesh@dmr.com', address: 'Branch Office, Guntur', joiningDate: '2023-06-20', licenseNo: '-' },
        { id: 4, name: 'Kiran', department: 'Accounts', role: 'Accounts Assistant', phone: '9988776658', email: 'kiran@dmr.com', address: 'Main Office, Guntur', joiningDate: '2023-08-01', licenseNo: '-' },
      ];

      const storedDuty = JSON.parse(localStorage.getItem('dmr_staff_duties') || 'null') || [
        { id: 1, date: '2026-07-21', employeeName: 'Ruhulla', shift: 'Morning', duty: 'Audit & Reconciliation', status: 'Scheduled' },
        { id: 2, date: '2026-07-21', employeeName: 'Suresh', shift: 'Night', duty: 'Vehicle Dispatch Supervision', status: 'Completed' },
      ];

      const storedLeave = JSON.parse(localStorage.getItem('dmr_staff_leaves') || 'null') || [
        { id: 1, employeeName: 'Ruhulla', leaveType: 'Casual Leave', startDate: '2026-07-10', endDate: '2026-07-11', days: 2, status: 'Approved' },
        { id: 2, employeeName: 'Suresh', leaveType: 'Sick Leave', startDate: '2026-07-15', endDate: '2026-07-15', days: 1, status: 'Pending' },
      ];

      const storedSalary = JSON.parse(localStorage.getItem('dmr_staff_salaries') || 'null') || [
        { id: 1, employeeName: 'Ruhulla', month: 'July 2026', basicSalary: 45000, allowances: 5000, deductions: 2000, netSalary: 48000 },
        { id: 2, employeeName: 'Suresh', month: 'July 2026', basicSalary: 35000, allowances: 4000, deductions: 1500, netSalary: 37500 },
      ];

      const storedPerformance = JSON.parse(localStorage.getItem('dmr_staff_performance') || 'null') || [
        { id: 1, employeeName: 'Ruhulla', totalTasks: 45, efficiency: 95, rating: 'Excellent' },
        { id: 2, employeeName: 'Suresh', totalTasks: 38, efficiency: 90, rating: 'Good' },
      ];

      setRawEmployees(storedEmployees);
      setRawDuty(storedDuty);
      setRawLeave(storedLeave);
      setRawSalary(storedSalary);
      setRawPerformance(storedPerformance);
    } catch {
      setError('Failed to fetch report records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateFilters = useCallback((newFilters: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const getReportTitle = useCallback((type: ReportType) => {
    switch (type) {
      case 'employee': return 'Employee List';
      case 'duty': return 'Duty Planner Report';
      case 'leave': return 'Leave Report';
      case 'salary_register': return 'Salary Register';
      case 'performance': return 'Performance Report';
      default: return 'Report';
    }
  }, []);

  const data = useMemo(() => {
    const { reportType, fromDate, toDate } = filters;

    switch (reportType) {
      case 'employee':
        return rawEmployees.map((emp) => ({
          'ID': emp.id,
          'Employee Name': emp.name || emp.fullName || '-',
          'Department': emp.department || '-',
          'Role': emp.role || '-',
          'Phone Number': emp.phone || emp.phoneNumber || '-',
          'Email': emp.email || '-',
          'Address': emp.address || '-',
          'Joining Date': emp.joiningDate || '-',
          'Aadhar Number': '[Aadhaar Redacted]',
          'License No': emp.licenseNo || '-',
        }));

      case 'duty':
        return rawDuty
          .filter((d) => (!fromDate || d.date >= fromDate) && (!toDate || d.date <= toDate))
          .map((d) => ({
            'Date': d.date || '-',
            'Employee Name': d.employeeName || d.name || '-',
            'Shift': d.shift || '-',
            'Assigned Duty': d.duty || d.task || '-',
            'Status': d.status || 'Scheduled',
          }));

      case 'leave':
        return rawLeave
          .filter((l) => (!fromDate || l.startDate >= fromDate) && (!toDate || l.endDate <= toDate))
          .map((l) => ({
            'Employee Name': l.employeeName || l.name || '-',
            'Leave Type': l.leaveType || '-',
            'From Date': l.startDate || '-',
            'To Date': l.endDate || '-',
            'Days': l.days || 1,
            'Status': l.status || 'Pending',
          }));

      case 'salary_register':
        return rawSalary.map((s) => ({
          'Employee Name': s.employeeName || s.name || '-',
          'Month': s.month || '-',
          'Basic Salary': s.basicSalary || 0,
          'Allowances': s.allowances || 0,
          'Deductions': s.deductions || 0,
          'Net Salary': s.netSalary || 0,
        }));

      case 'performance':
        return rawPerformance.map((p) => ({
          'Employee Name': p.employeeName || '-',
          'Total Trips/Tasks': p.totalTasks || 0,
          'Efficiency': `${p.efficiency || 100}%`,
          'Rating': p.rating || 'Good',
        }));

      default:
        return [];
    }
  }, [filters, rawEmployees, rawDuty, rawLeave, rawSalary, rawPerformance]);

  return {
    filters,
    data,
    loading,
    error,
    updateFilters,
    refresh,
    getReportTitle,
  };
}