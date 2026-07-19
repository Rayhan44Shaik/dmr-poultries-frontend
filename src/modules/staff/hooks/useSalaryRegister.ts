// src/modules/staff/hooks/useSalaryRegister.ts

import { useState, useEffect, useCallback, useMemo } from 'react';
import { loadEmployees, loadSalaryRecords, saveSalaryRecords } from '../services/staffService';
import type { SalaryRecord } from '../types/staffDashboard';

export function useSalaryRegister(month: string, department: string = '') {
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Paid'>('All');

  const loadData = useCallback(() => {
    setLoading(true);
    try {
      let empData = loadEmployees();
      if (department) {
        empData = empData.filter((e) => e.department === department);
      }
      setEmployees(empData);

      const allRecords = loadSalaryRecords();
      const filtered = allRecords.filter((r) => r.month === month);
      setRecords(filtered);
    } catch (error) {
      console.error('Failed to load salary register:', error);
    } finally {
      setLoading(false);
    }
  }, [month, department]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRecords = useMemo(() => {
    if (filter === 'All') return records;
    return records.filter((r) => r.status === filter);
  }, [records, filter]);

  const totals = useMemo(() => {
    return {
      totalEmployees: filteredRecords.length,
      totalNetSalary: filteredRecords.reduce((sum, r) => sum + r.netSalary, 0),
      pendingCount: filteredRecords.filter((r) => r.status === 'Pending').length,
      paidCount: filteredRecords.filter((r) => r.status === 'Paid').length,
    };
  }, [filteredRecords]);

  const updateStatus = useCallback(
    (id: string, status: 'Pending' | 'Paid') => {
      const allRecords = loadSalaryRecords();
      const updated = allRecords.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              paymentDate: status === 'Paid' ? new Date().toISOString().split('T')[0] : undefined,
            }
          : r
      );
      saveSalaryRecords(updated);
      setRecords(updated.filter((r) => r.month === month));
    },
    [month]
  );

  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  return {
    records: filteredRecords,
    allRecords: records,
    totals,
    filter,
    setFilter,
    loading,
    updateStatus,
    refresh,
    employees,
  };
}