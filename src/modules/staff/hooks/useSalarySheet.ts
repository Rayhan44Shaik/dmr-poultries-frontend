// src/modules/staff/hooks/useSalarySheet.ts
//
// Single-employee salary sheet — fully PostgreSQL/API backed. No localStorage.
// Source: GET /api/staff/salaries/:employeeId?month= for the record and the
// employee master for identity; writes go through the salary API (the backend
// recomputes gross / deductions / net and owns the lifecycle).

import { useState, useEffect, useCallback } from 'react';
import { apiGet, handleApiError } from '../../../api';
import { loadEmployees } from '../../masters/employees/services/employeeService';
import { updateSalary, paySalary, updateSalaryStatus } from '../services/salaryService';
import type { SalaryRecord } from '../types/staffDashboard';

export function useSalarySheet(employeeId: number | null, month: string) {
  const [employee, setEmployee] = useState<any>(null);
  const [salary, setSalary] = useState<SalaryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const loadData = useCallback(async () => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const employees = await loadEmployees().catch(() => []);
      setEmployee((employees as Array<{ id: number }>).find((e) => e.id === employeeId) ?? null);
      try {
        const { data } = await apiGet<SalaryRecord>(`/staff/salaries/${employeeId}`, {
          params: { month },
        });
        setSalary(data);
      } catch {
        // No record for this employee/month yet — the sheet starts empty.
        setSalary(null);
      }
    } catch (err) {
      setError(handleApiError(err));
      setEmployee(null);
      setSalary(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId, month]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const calculateNetSalary = useCallback(
    (data: {
      basicSalary: number;
      overtime: number;
      incentives: number;
      fuelAllowance: number;
      nightAllowance: number;
      leaveDeduction: number;
      advanceRecovery: number;
      loanEMI: number;
      latePenalty: number;
      otherDeductions: number;
    }) => {
      const gross =
        data.basicSalary +
        data.overtime +
        data.incentives +
        data.fuelAllowance +
        data.nightAllowance;
      const deductions =
        data.leaveDeduction +
        data.advanceRecovery +
        data.loanEMI +
        data.latePenalty +
        data.otherDeductions;
      return { gross, deductions, net: gross - deductions };
    },
    []
  );

  const saveSalary = useCallback(
    async (data: Omit<SalaryRecord, 'id' | 'createdAt' | 'totalGross' | 'totalDeductions' | 'netSalary'>) => {
      // The backend upsert is keyed on (employee_id, month) and recomputes
      // the totals; the preview totals below are display-only.
      const { gross, deductions, net } = calculateNetSalary(data);
      const record = await updateSalary({
        ...(salary ?? {}),
        ...data,
        id: salary?.id ?? '',
        totalGross: gross,
        totalDeductions: deductions,
        netSalary: net,
        createdAt: salary?.createdAt ?? '',
      } as SalaryRecord);
      setSalary(record);
      setIsEditing(false);
      return record;
    },
    [salary, calculateNetSalary]
  );

  const updateStatus = useCallback(
    async (status: 'Pending' | 'Paid', paymentDate?: string) => {
      if (!salary) return;
      const record =
        status === 'Paid'
          ? await paySalary(salary.id, {
              paymentDate: paymentDate ?? new Date().toISOString().split('T')[0],
              paymentMode: 'Bank Transfer',
            })
          : await updateSalaryStatus(salary.id);
      setSalary(record);
    },
    [salary]
  );

  const refresh = useCallback(() => {
    void loadData();
  }, [loadData]);

  return {
    employee,
    salary,
    loading,
    error,
    isEditing,
    setIsEditing,
    calculateNetSalary,
    saveSalary,
    updateStatus,
    refresh,
  };
}
