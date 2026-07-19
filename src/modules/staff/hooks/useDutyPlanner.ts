// src/modules/staff/hooks/useDutyPlanner.ts

import { useState, useEffect, useCallback } from 'react'; // ✅ removed useMemo
import {
  loadEmployees,
  // loadDutyAssignments,   // ❌ not used directly – it's used inside getDutyPlannerData
  saveDutyAssignments,
  // getShiftConfigs,       // ❌ not used in hook – used in components
  getDutyPlannerData,
} from '../services/staffService';
import type { DutyAssignment, DutyPlannerFilters } from '../types/staffDashboard';

type NotificationFn = (message: string, type?: 'success' | 'error' | 'info') => void;

export function useDutyPlanner(showNotification?: NotificationFn) {
  const notify = showNotification || console.log;

  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const defaultWeekStart = new Date(today);
  defaultWeekStart.setDate(today.getDate() + diffToMonday);
  const defaultWeekStartStr = defaultWeekStart.toISOString().split('T')[0];

  const [filters, setFilters] = useState<DutyPlannerFilters>({
    department: '',
    role: '',
    weekStart: defaultWeekStartStr,
  });

  const [assignments, setAssignments] = useState<DutyAssignment[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [weekDays, setWeekDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ employeeId: number; date: string } | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    try {
      const { employees: emp, assignments: ass, weekDays: days } = getDutyPlannerData(
        filters.weekStart,
        filters.department,
        filters.role
      );
      setEmployees(emp);
      setAssignments(ass);
      setWeekDays(days);
    } catch (error) {
      console.error('Failed to load duty planner data:', error);
      notify('Failed to load duty planner data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getAssignment = useCallback(
    (employeeId: number, date: string): DutyAssignment | undefined => {
      return assignments.find(a => a.employeeId === employeeId && a.date === date);
    },
    [assignments]
  );

  const updateAssignment = useCallback(
    (employeeId: number, date: string, dutyType: DutyAssignment['dutyType'], vehicleNo?: string) => {
      const dateObj = new Date(date);
      if (dateObj.getDay() === 6 && (dutyType === 'Rest' || dutyType === 'WeeklyOff')) {
        notify('Saturday is compulsory duty!', 'error');
        return false;
      }

      const existing = assignments.find(a => a.employeeId === employeeId && a.date === date);
      const employee = employees.find(e => e.id === employeeId);
      if (!employee) return false;

      let updated: DutyAssignment[];
      if (existing) {
        updated = assignments.map(a =>
          a.id === existing.id ? { ...a, dutyType, vehicleNo: vehicleNo || a.vehicleNo } : a
        );
      } else {
        const newAssignment: DutyAssignment = {
          id: Date.now().toString(),
          employeeId,
          employeeName: employee.employeeName,
          department: employee.department,
          role: employee.role,
          dutyType,
          date,
          vehicleNo,
        };
        updated = [...assignments, newAssignment];
      }

      setAssignments(updated);
      saveDutyAssignments(updated);
      notify('Duty updated!', 'success');
      return true;
    },
    [assignments, employees, notify]
  );

  const autoAssign = useCallback(() => {
    const newAssignments: DutyAssignment[] = [...assignments];
    let changed = 0;

    employees.forEach((emp) => {
      weekDays.forEach((date) => {
        const dateObj = new Date(date);
        const dayOfWeek = dateObj.getDay(); // 1=Mon, 6=Sat, 0=Sun
        let dutyType: DutyAssignment['dutyType'] = 'Rest';

        if (dayOfWeek === 6) {
          dutyType = 'Office';
        } else if (dayOfWeek === 0) {
          dutyType = 'WeeklyOff';
        } else {
          if (emp.department === 'Driver' || emp.role === 'Driver') {
            dutyType = 'Driver';
          } else if (emp.department === 'Delivery' || emp.role === 'Delivery') {
            dutyType = 'Delivery';
          } else if (emp.department === 'Repair' || emp.role === 'Repair') {
            dutyType = 'Repair';
          } else {
            dutyType = 'Office';
          }
        }

        const existing = newAssignments.find(a => a.employeeId === emp.id && a.date === date);
        if (existing) {
          if (existing.dutyType !== dutyType) {
            existing.dutyType = dutyType;
            changed++;
          }
        } else {
          newAssignments.push({
            id: Date.now().toString() + '-' + emp.id + '-' + date,
            employeeId: emp.id,
            employeeName: emp.employeeName,
            department: emp.department,
            role: emp.role,
            dutyType,
            date,
          });
          changed++;
        }
      });
    });

    setAssignments(newAssignments);
    saveDutyAssignments(newAssignments);
    notify(`Auto-assigned ${changed} duties.`, 'success');
  }, [employees, weekDays, assignments, notify]);

  const moveWeek = useCallback((direction: -1 | 1) => {
    const current = new Date(filters.weekStart);
    current.setDate(current.getDate() + direction * 7);
    const newWeekStart = current.toISOString().split('T')[0];
    setFilters(prev => ({ ...prev, weekStart: newWeekStart }));
  }, [filters.weekStart]);

  const resetFilters = useCallback(() => {
    setFilters({ department: '', role: '', weekStart: defaultWeekStartStr });
  }, [defaultWeekStartStr]);

  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  return {
    employees,
    assignments,
    weekDays,
    loading,
    filters,
    setFilters,
    getAssignment,
    updateAssignment,
    autoAssign,
    moveWeek,
    resetFilters,
    selectedCell,
    setSelectedCell,
    showPicker,
    setShowPicker,
    refresh,
  };
}