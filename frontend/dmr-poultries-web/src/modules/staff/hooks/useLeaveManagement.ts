// src/modules/staff/hooks/useLeaveManagement.ts

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  loadEmployees,
  loadLeaveRequests,
  saveLeaveRequests,
  getLeaveBalance,
  getAllLeaveBalances,
} from '../services/staffService';
import type { LeaveRequest, LeaveBalance } from '../types/staffDashboard';

type NotificationFn = (message: string, type?: 'success' | 'error' | 'info') => void;

export function useLeaveManagement(showNotification?: NotificationFn) {
  const notify = showNotification || ((msg: string) => console.log(msg));

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [search, setSearch] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    try {
      const empData = loadEmployees();
      const leaveData = loadLeaveRequests();
      setEmployees(empData);
      setLeaves(leaveData);
      setBalances(getAllLeaveBalances());
    } catch (error) {
      console.error('Failed to load leave data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredLeaves = useMemo(() => {
    let result = leaves;
    if (filter !== 'All') {
      result = result.filter((l) => l.status === filter);
    }
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.employeeName.toLowerCase().includes(query) ||
          l.type.toLowerCase().includes(query) ||
          l.status.toLowerCase().includes(query)
      );
    }
    return result.sort((a, b) => {
      if (a.status === 'Pending' && b.status !== 'Pending') return -1;
      if (b.status === 'Pending' && a.status !== 'Pending') return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [leaves, filter, search]);

  const stats = useMemo(() => ({
    pending: leaves.filter((l) => l.status === 'Pending').length,
    approved: leaves.filter((l) => l.status === 'Approved').length,
    rejected: leaves.filter((l) => l.status === 'Rejected').length,
    total: leaves.length,
  }), [leaves]);

  const totalBalances = useMemo(() => {
    return balances.reduce(
      (acc, b) => ({
        total: acc.total + b.total,
        used: acc.used + b.used,
        remaining: acc.remaining + b.remaining,
      }),
      { total: 0, used: 0, remaining: 0 }
    );
  }, [balances]);

  const addLeave = useCallback(
    (leave: Omit<LeaveRequest, 'id' | 'createdAt' | 'status'>) => {
      const newLeave: LeaveRequest = {
        ...leave,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        status: 'Pending',
      };
      const balance = getLeaveBalance(leave.employeeId);
      if (balance && leave.days > balance.remaining) {
        notify(`Insufficient leave balance. Available: ${balance.remaining} days`, 'error');
        return false;
      }
      const updated = [...leaves, newLeave];
      setLeaves(updated);
      saveLeaveRequests(updated);
      setBalances(getAllLeaveBalances());
      notify('Leave request submitted successfully!', 'success');
      return true;
    },
    [leaves, notify]
  );

  const approveLeave = useCallback(
    (id: string, approvedBy?: string) => {
      const leave = leaves.find((l) => l.id === id);
      if (!leave) return;
      const balance = getLeaveBalance(leave.employeeId);
      if (balance && leave.days > balance.remaining) {
        notify(`Cannot approve: Insufficient balance. Available: ${balance.remaining} days`, 'error');
        return;
      }
      const updated = leaves.map((l) =>
        l.id === id
          ? {
              ...l,
              status: 'Approved' as const,
              approvedAt: new Date().toISOString(),
              approvedBy: approvedBy || 'Admin',
            }
          : l
      );
      setLeaves(updated);
      saveLeaveRequests(updated);
      setBalances(getAllLeaveBalances());
      notify('Leave approved!', 'success');
    },
    [leaves, notify]
  );

  const rejectLeave = useCallback(
    (id: string, rejectionReason: string) => {
      if (!rejectionReason.trim()) {
        notify('Please provide a rejection reason.', 'error');
        return;
      }
      const updated = leaves.map((l) =>
        l.id === id
          ? {
              ...l,
              status: 'Rejected' as const,
              rejectionReason,
            }
          : l
      );
      setLeaves(updated);
      saveLeaveRequests(updated);
      notify('Leave rejected.', 'info');
    },
    [leaves, notify]
  );

  const deleteLeave = useCallback(
    (id: string) => {
      const leave = leaves.find((l) => l.id === id);
      if (leave?.status === 'Approved' || leave?.status === 'Rejected') {
        notify('Cannot delete approved/rejected leave.', 'error');
        return;
      }
      if (!window.confirm('Delete this leave request?')) return;
      const updated = leaves.filter((l) => l.id !== id);
      setLeaves(updated);
      saveLeaveRequests(updated);
      notify('Leave request deleted.', 'info');
    },
    [leaves, notify]
  );

  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  return {
    leaves: filteredLeaves,
    allLeaves: leaves,
    stats,
    balances,
    totalBalances,
    filter,
    setFilter,
    search,
    setSearch,
    loading,
    addLeave,
    approveLeave,
    rejectLeave,
    deleteLeave,
    refresh,
    employees,
  };
}