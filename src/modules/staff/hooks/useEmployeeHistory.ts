// src/modules/staff/hooks/useEmployeeHistory.ts
//
// Employee history — fully PostgreSQL/API backed. No localStorage.
// Source: GET /api/staff/employee/:id/history (duties, leaves, trips,
// repairs, advances) plus the employee master for identity.

import { useState, useEffect, useCallback } from 'react';
import { apiGet, handleApiError } from '../../../api';
import { loadEmployees } from '../../masters/employees/services/employeeService';
import type { HistoryEvent, EmployeeHistoryStats } from '../types/staffDashboard';

interface EmployeeHistoryResponse {
  employeeId: number;
  duties: Array<{ date: string; dutyType: string; vehicleNo: string | null; department: string; role: string }>;
  leaves: Array<{ from: string; to: string; status: string }>;
  trips: Array<{ tripNo: string; tripDate: string; vehicleNo: string | null; status: string }>;
  repairs: Array<{ date: string; serviceType: string; vehicleNo: string | null; status: string }>;
  advances: Array<{ type: string; principal: number; issuedDate: string; status: string }>;
}

export function useEmployeeHistory(employeeId: number | null) {
  const [employee, setEmployee] = useState<any>(null);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [stats, setStats] = useState<EmployeeHistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [employees, { data }] = await Promise.all([
        loadEmployees().catch(() => []),
        apiGet<EmployeeHistoryResponse>(`/staff/employee/${employeeId}/history`),
      ]);
      const emp = (employees as Array<{ id: number }>)?.find((e) => e.id === employeeId) ?? null;
      setEmployee(emp);

      const historyEvents: HistoryEvent[] = [];
      for (const t of data.trips ?? []) {
        historyEvents.push({
          id: `trip-${t.tripNo}`,
          date: t.tripDate,
          module: 'Trips',
          event: `Trip ${t.tripNo} ${t.status}`,
          details: t.vehicleNo ? `Vehicle ${t.vehicleNo}` : '',
          icon: 'truck',
        });
      }
      for (const d of data.duties ?? []) {
        historyEvents.push({
          id: `duty-${d.date}`,
          date: d.date,
          module: 'Duty',
          event: `${d.dutyType} duty`,
          details: d.vehicleNo ? `Vehicle ${d.vehicleNo}` : d.department,
          icon: 'calendar',
        });
      }
      (data.leaves ?? []).forEach((l, index) => {
        historyEvents.push({
          id: `leave-${index}-${l.from}`,
          date: l.from,
          module: 'Leave',
          event: `Leave ${l.status}`,
          details: `${l.from} to ${l.to}`,
          icon: 'calendar',
        });
      });
      for (const r of data.repairs ?? []) {
        historyEvents.push({
          id: `repair-${r.date}-${r.serviceType}`,
          date: r.date,
          module: 'Vehicle',
          event: `${r.serviceType} ${r.status}`,
          details: r.vehicleNo ? `Vehicle ${r.vehicleNo}` : '',
          icon: 'truck',
        });
      }
      for (const a of data.advances ?? []) {
        historyEvents.push({
          id: `advance-${a.issuedDate}-${a.type}`,
          date: a.issuedDate,
          module: 'Advance',
          event: `${a.type} ${a.status}`,
          details: `₹${Number(a.principal).toLocaleString()}`,
          icon: 'rupee',
        });
      }
      historyEvents.sort((a, b) => b.date.localeCompare(a.date));
      setEvents(historyEvents);
      setStats({
        totalTrips: (data.trips ?? []).length,
        totalDistance: 0,
        totalBirds: 0,
        totalWeight: 0,
      });
    } catch (err) {
      setError(handleApiError(err));
      setEmployee(null);
      setEvents([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const refresh = useCallback(() => {
    void loadData();
  }, [loadData]);

  return {
    employee,
    events,
    stats,
    loading,
    error,
    refresh,
  };
}
