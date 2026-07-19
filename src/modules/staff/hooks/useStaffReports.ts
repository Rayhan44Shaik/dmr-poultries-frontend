// src/modules/staff/hooks/useStaffReports.ts

import { useState, useEffect, useCallback } from 'react';
import {
  // loadEmployees,   // ❌ removed – not used
  loadLeaveRequests,
  loadSalaryRecords,
  loadAdvanceLoans,
  loadDutyAssignments,
  loadAttendanceRecords,
} from '../services/staffService';

type ReportType = 'employees' | 'attendance' | 'duty-planner' | 'leave' | 'salary' | 'salary-register' | 'advance-loan' | 'performance';

interface ReportFilters {
  reportType: ReportType;
  fromDate: string;
  toDate: string;
}

export function useStaffReports() {
  const [filters, setFilters] = useState<ReportFilters>({
    reportType: 'employees',
    fromDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
  });
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      let result: any[] = [];
      const { reportType, fromDate, toDate } = filters; // ✅ reportType is used in switch

      switch (reportType) {
        case 'employees': {
          const employees = JSON.parse(localStorage.getItem('dmr-employees') || '[]');
          result = employees.filter((e: any) => e.status === 'Active');
          break;
        }
        case 'attendance': {
          const records = loadAttendanceRecords();
          result = records;
          break;
        }
        case 'duty-planner': {
          const assignments = loadDutyAssignments();
          result = assignments.filter(a => a.date >= fromDate && a.date <= toDate);
          break;
        }
        case 'leave': {
          const leaves = loadLeaveRequests();
          result = leaves.filter(l => l.fromDate >= fromDate && l.toDate <= toDate);
          break;
        }
        case 'salary': {
          const salaries = loadSalaryRecords();
          result = salaries.filter(s => s.month >= fromDate.substring(0, 7) && s.month <= toDate.substring(0, 7));
          break;
        }
        case 'salary-register': {
          const salaries = loadSalaryRecords();
          const grouped = new Map<string, { count: number; total: number }>();
          salaries.forEach(s => {
            if (!grouped.has(s.month)) grouped.set(s.month, { count: 0, total: 0 });
            const entry = grouped.get(s.month)!;
            entry.count++;
            entry.total += s.netSalary;
          });
          result = Array.from(grouped.entries()).map(([month, d]) => ({
            month,
            employees: d.count,
            totalNet: d.total,
          }));
          break;
        }
        case 'advance-loan': {
          const records = loadAdvanceLoans();
          result = records.filter(r => r.issuedDate >= fromDate && r.issuedDate <= toDate);
          break;
        }
        case 'performance': {
          const trips = JSON.parse(localStorage.getItem('vehicleTrips') || '[]');
          const completed = trips.filter((t: any) => t.status === 'Completed' && t.tripDate >= fromDate && t.tripDate <= toDate);
          const driverMap = new Map<string, { trips: number; weight: number; birds: number }>();
          completed.forEach((t: any) => {
            const name = t.driverName || 'Unknown';
            if (!driverMap.has(name)) driverMap.set(name, { trips: 0, weight: 0, birds: 0 });
            const entry = driverMap.get(name)!;
            entry.trips++;
            entry.weight += t.totalWeight || 0;
            entry.birds += t.totalBirds || 0;
          });
          result = Array.from(driverMap.entries()).map(([driver, d]) => ({
            driver,
            trips: d.trips,
            weight: d.weight,
            birds: d.birds,
          }));
          break;
        }
        default:
          result = [];
      }
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateFilters = useCallback((newFilters: Partial<ReportFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  const getReportTitle = useCallback((type: ReportType) => {
    const titles: Record<ReportType, string> = {
      'employees': 'Employee List',
      'attendance': 'Attendance Report',
      'duty-planner': 'Duty Planner Report',
      'leave': 'Leave Report',
      'salary': 'Salary Report',
      'salary-register': 'Salary Register Summary',
      'advance-loan': 'Advance & Loan Summary',
      'performance': 'Performance Evaluation Report',
    };
    return titles[type] || 'Report';
  }, []);

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