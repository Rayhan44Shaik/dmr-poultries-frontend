// src/modules/staff/hooks/useAttendanceRegister.ts

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  loadEmployees,
  loadAttendanceRecords,
  saveAttendanceRecords,
} from '../services/staffService';
import type { AttendanceRecord } from '../types/staffDashboard';

type NotificationFn = (message: string, type?: 'success' | 'error' | 'info') => void;

export function useAttendanceRegister(showNotification?: NotificationFn) {
  const notify = showNotification || console.log;

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [month, setMonth] = useState(defaultMonth);
  const [department, setDepartment] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    setLoading(true);
    try {
      const allEmployees = loadEmployees();
      let filtered = allEmployees;
      if (department) {
        filtered = filtered.filter((e) => e.department === department);
      }
      setEmployees(filtered);

      // ✅ Load all records – no unused filter variable
      const allRecords = loadAttendanceRecords();
      setRecords(allRecords);
    } catch (error) {
      console.error('Failed to load attendance data:', error);
      notify('Failed to load attendance data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [department, notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getEmployeeRecord = useCallback(
    (employeeId: number): AttendanceRecord => {
      const existing = records.find((r) => r.employeeId === employeeId);
      if (existing) return existing;

      const employee = employees.find((e) => e.id === employeeId);
      return {
        employeeId,
        employeeName: employee?.employeeName || 'Unknown',
        department: employee?.department || '',
        presentCount: 0,
        absentCount: 0,
        leaveCount: 0,
        halfDayCount: 0,
      };
    },
    [records, employees]
  );

  const updateDayStatus = useCallback(
    (employeeId: number, day: string, status: 'P' | 'A' | 'H' | 'L' | 'WO') => {
      const record = getEmployeeRecord(employeeId);
      const updatedRecord: AttendanceRecord = {
        ...record,
        [day]: status,
      };

      const days = Object.keys(updatedRecord).filter(
        (k) => !isNaN(Number(k)) && Number(k) >= 1 && Number(k) <= 31
      );
      let present = 0,
        absent = 0,
        leave = 0,
        half = 0;
      days.forEach((d) => {
        const val = updatedRecord[d];
        if (val === 'P') present++;
        else if (val === 'A') absent++;
        else if (val === 'L') leave++;
        else if (val === 'H') half++;
      });
      updatedRecord.presentCount = present;
      updatedRecord.absentCount = absent;
      updatedRecord.leaveCount = leave;
      updatedRecord.halfDayCount = half;

      const allRecords = loadAttendanceRecords();
      const index = allRecords.findIndex((r) => r.employeeId === employeeId);
      if (index !== -1) {
        allRecords[index] = updatedRecord;
      } else {
        allRecords.push(updatedRecord);
      }
      saveAttendanceRecords(allRecords);
      setRecords(allRecords);

      notify(`Attendance updated for ${updatedRecord.employeeName}`, 'success');
    },
    [getEmployeeRecord, notify]
  );

  const getDaysInMonth = useCallback((monthStr: string) => {
    const [year, mon] = monthStr.split('-').map(Number);
    return new Date(year, mon, 0).getDate();
  }, []);

  const dayNumbers = useMemo(() => {
    const totalDays = getDaysInMonth(month);
    return Array.from({ length: totalDays }, (_, i) => i + 1);
  }, [month, getDaysInMonth]);

  const getStatusColor = useCallback((status: string) => {
    const colors: Record<string, string> = {
      P: 'bg-green-500 text-white',
      A: 'bg-red-500 text-white',
      H: 'bg-amber-500 text-white',
      L: 'bg-blue-500 text-white',
      WO: 'bg-slate-300 text-slate-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-500';
  }, []);

  const getStatusLabel = useCallback((status: string) => {
    const labels: Record<string, string> = {
      P: 'Present',
      A: 'Absent',
      H: 'Half Day',
      L: 'Leave',
      WO: 'Weekly Off',
    };
    return labels[status] || status;
  }, []);

  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  const resetFilters = useCallback(() => {
    setDepartment('');
    setMonth(defaultMonth);
  }, [defaultMonth]);

  return {
    month,
    setMonth,
    department,
    setDepartment,
    employees,
    records,
    dayNumbers,
    loading,
    getEmployeeRecord,
    updateDayStatus,
    getStatusColor,   // kept for other uses (not used in page)
    getStatusLabel,
    refresh,
    resetFilters,
  };
}