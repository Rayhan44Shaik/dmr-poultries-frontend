// src/modules/staff/hooks/useDutyPlanner.ts

import { useState, useEffect, useCallback } from 'react';
import { 
  getDutyPlannerData, 
  loadDutyAssignments, 
  saveDutyAssignments 
} from '../services/staffService';
import type { Employee, DutyAssignment, DutyPlannerFilters } from '../types/staffDashboard';

const DEFAULT_ROLES = ['Supervisor', 'Driver', 'Helper'];

export function isDateLocked(dateStr: string): boolean {
  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);

  const day = targetDate.getDay();
  const diff = targetDate.getDate() - day + (day === 0 ? -6 : 1);
  const targetWeekMonday = new Date(targetDate);
  targetWeekMonday.setDate(diff);
  targetWeekMonday.setHours(0, 0, 0, 0);

  const now = new Date();
  const currDay = now.getDay();
  const currDiff = now.getDate() - currDay + (currDay === 0 ? -6 : 1);
  const currentWeekMonday = new Date(now);
  currentWeekMonday.setDate(currDiff);
  currentWeekMonday.setHours(0, 0, 0, 0);

  return targetWeekMonday.getTime() < currentWeekMonday.getTime();
}

export function useDutyPlanner(showNotification?: (msg: string, type: 'success' | 'error' | 'info') => void) {
  const getCurrentWeekMonday = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    const year = startOfWeek.getFullYear();
    const month = String(startOfWeek.getMonth() + 1).padStart(2, '0');
    const date = String(startOfWeek.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  };

  const [filters, setFilters] = useState<DutyPlannerFilters>({
    department: '',
    role: DEFAULT_ROLES, // Pre-selected by default
    weekStart: getCurrentWeekMonday(),
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<DutyAssignment[]>([]);
  const [weekDays, setWeekDays] = useState<string[]>([]);
  const [allRoles, setAllRoles] = useState<string[]>(DEFAULT_ROLES);
  const [loading, setLoading] = useState(false);

  const [selectedCell, setSelectedCell] = useState<{ employeeId: number; date: string } | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    try {
      const data = getDutyPlannerData(filters.weekStart, filters.role);
      setEmployees(data.employees);
      setAssignments(data.assignments);
      setWeekDays(data.weekDays);
      
      const mergedRoles = Array.from(new Set([...DEFAULT_ROLES, ...(data.allRoles || [])]));
      setAllRoles(mergedRoles);
    } catch (error) {
      console.error('Failed to load duty planner data', error);
    } finally {
      setLoading(false);
    }
  }, [filters.weekStart, filters.role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const moveWeek = useCallback((direction: -1 | 1) => {
    setFilters((prev) => {
      const d = new Date(prev.weekStart);
      d.setDate(d.getDate() + direction * 7);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      return { ...prev, weekStart: `${year}-${month}-${date}` };
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      department: '',
      role: DEFAULT_ROLES, // Resets back to default selected roles
      weekStart: getCurrentWeekMonday(),
    });
  }, []);

  const getAssignment = useCallback(
    (employeeId: number, date: string): DutyAssignment | undefined => {
      return assignments.find((a) => a.employeeId === employeeId && a.date === date);
    },
    [assignments]
  );

  const updateAssignment = useCallback(
    (employeeId: number, date: string, dutyType: DutyAssignment['dutyType']) => {
      if (isDateLocked(date)) {
        showNotification?.('Cannot edit duties for previous completed weeks.', 'error');
        return false;
      }

      const isSaturday = new Date(date).getDay() === 6;
      if (isSaturday && (dutyType === 'Rest' || dutyType === 'WeeklyOff')) {
        showNotification?.('Saturday is compulsory duty. Rest and Weekly Off cannot be assigned.', 'error');
        return false;
      }

      const allAssignments = loadDutyAssignments();
      const emp = employees.find((e) => e.id === employeeId);
      
      const existingIndex = allAssignments.findIndex(
        (a) => a.employeeId === employeeId && a.date === date
      );

      const newAssignment: DutyAssignment = {
        id: `${employeeId}-${date}`,
        employeeId,
        employeeName: emp?.employeeName || '',
        department: emp?.department || '',
        role: emp?.role || '',
        dutyType,
        date,
      };

      if (existingIndex !== -1) {
        allAssignments[existingIndex] = newAssignment;
      } else {
        allAssignments.push(newAssignment);
      }

      saveDutyAssignments(allAssignments);
      fetchData();
      showNotification?.('Duty assignment updated successfully', 'success');
      return true;
    },
    [employees, fetchData, showNotification]
  );

  return {
    employees,
    assignments,
    weekDays,
    loading,
    filters,
    setFilters,
    getAssignment,
    updateAssignment,
    moveWeek,
    resetFilters,
    selectedCell,
    setSelectedCell,
    showPicker,
    setShowPicker,
    allRoles,
  };
}