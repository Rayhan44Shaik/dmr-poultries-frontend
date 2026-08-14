// src/modules/staff/services/staffApi.ts
// Axios client for the PostgreSQL-backed Staff / Duty Planner backend.
// Authoritative source is the backend (duty data is never localStorage).

import { apiClient } from "../../../api/client";

export interface DutyWeekDto {
  weekStart: string; weekEnd: string; status: string; lockReason?: string;
  days: { date: string; weekday: string }[];
  employees: { id: number; employeeNo: number; name: string; department: string; role: string; status: string; license: string; active: boolean; onApprovedLeave: string[] }[];
  assignments: { id: string; employeeId: number; employeeName: string; department: string; role: string; dutyType: string; date: string; vehicleId?: number | null; vehicleNo?: string | null }[];
  perEmployee: Record<number, { worked: number; delivery: number; repair: number; office: number; collection: number; weeklyOff: number; leave: number; weekOffDay: string | null }>;
  vehicles: { id: number; vehicleNo: string; vehicleNumber: string; active: boolean }[];
  trips: { id: number; tripNo: string; tripDate: string; vehicleId: number | null; driverId: number | null; supervisorId: number | null }[];
  maintenance: { id: number; vehicleId: number | null; vehicleNumber: string; serviceDate: string; serviceType: string; status: string }[];
  saturday: { required: number; assigned: number; shortage: number; status: string; requiredByRole: Record<string, number>; assignedByRole: Record<string, number>; availableByRole: Record<string, number> };
  validation: { ok: boolean; problems: string[] };
}

export interface AutoPlanDto {
  employeesAffected: number; delivery: number; repair: number; office: number; collection: number; weeklyOff: number;
  saturdayRequired: number; saturdayAssigned: number; saturdayShortage: number; conflicts: string[];
  rows: { employeeId: number; employeeName: string; department: string; role: string; date: string; dutyType: string; vehicleId?: number | null; vehicleNo?: string | null; proposed: boolean }[];
}

export const staffApi = {
  async getDutyWeek(weekStart: string): Promise<DutyWeekDto> { const res = await apiClient.get("/staff/duty-planner", { params: { weekStart } }); return res.data; },
  async getWeekStatus(weekStart: string) { const res = await apiClient.get("/staff/duty-planner/week/" + weekStart); return res.data; },
  async autoAssignPreview(weekStart: string): Promise<AutoPlanDto> { const res = await apiClient.post("/staff/duty-planner/auto-assign/preview", { weekStart }); return res.data; },
  async autoAssignApply(weekStart: string, plan?: AutoPlanDto, changedBy = "user") { const res = await apiClient.post("/staff/duty-planner/auto-assign/apply", { weekStart, plan, changedBy }); return res.data; },
  async assign(assignment: unknown, changedBy = "user") { const res = await apiClient.post("/staff/duty-planner/assign", { ...(assignment as object), changedBy }); return res.data; },
  async update(id: string, assignment: unknown, changedBy = "user") { const res = await apiClient.put("/staff/duty-planner/" + id, { ...(assignment as object), changedBy }); return res.data; },
  async remove(id: string, changedBy = "user") { const res = await apiClient.delete("/staff/duty-planner/" + id, { data: { changedBy } }); return res.data; },
  async submitWeek(weekStart: string, submittedBy = "user") { const res = await apiClient.post("/staff/duty-planner/submit", { weekStart, submittedBy }); return res.data; },
  async getAttendanceSummary(month: string) { const res = await apiClient.get("/staff/attendance/summary", { params: { month } }); return res.data; },
  async getEmployeeHistory(employeeId: number) { const res = await apiClient.get("/staff/employee/" + employeeId + "/history"); return res.data; },
};
