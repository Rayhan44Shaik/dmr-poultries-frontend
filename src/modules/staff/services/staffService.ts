// src/modules/staff/services/staffService.ts
// ---------------------------------------------------------------------------
// Staff Service — Quarter-synced facade.
//
// This module previously computed dashboard aggregates purely from
// localStorage.  It now delegates to the quarter-aware `staffOverviewService`
// when the sample API is present (`npm run dev` → scripts/quarter-sample-data.mjs),
// falling back to the original localStorage math for production/offline.
//
// Existing imports (`loadEmployees`, `getStaffDashboardData`, `getLeaveBalance`…)
// keep their signatures so no caller needs to be touched.
// ---------------------------------------------------------------------------

import type { Employee, Trip, LeaveRequest, SalaryRecord, AdvanceLoan, AttendanceRecord, StaffDashboardData, LeaveBalance, ShiftConfig } from "../types/staffDashboard";
import { toBusinessDate } from "../../../utils/businessDate";
import { loadStaffOverview } from "./staffOverviewService";

// ---------------------------------------------------------------------------
// LocalStorage helpers (retained for offline fallback & legacy callers)
// ---------------------------------------------------------------------------
const CACHE_TTL = 5 * 60 * 1000;
interface CacheEntry<T> { data: T; timestamp: number; }
function getCache<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.timestamp > CACHE_TTL) { localStorage.removeItem(key); return null; }
    return entry.data;
  } catch { return null; }
}
function setCache<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() } as CacheEntry<T>));
}
function clearCache(prefix: string): void {
  for (const k of Object.keys(localStorage)) if (k.startsWith(prefix)) localStorage.removeItem(k);
}

// ---------------------------------------------------------------------------
// Data loaders (still localStorage-backed for fallback)
// ---------------------------------------------------------------------------
export function loadEmployees(): Employee[] {
  const raw = localStorage.getItem("dmr-employees");
  return raw ? JSON.parse(raw) : [];
}
export function loadTrips(): Trip[] {
  const raw = localStorage.getItem("vehicleTrips");
  return raw ? JSON.parse(raw) : [];
}
export function loadLeaveRequests(): LeaveRequest[] {
  const raw = localStorage.getItem("dmr-leave-requests");
  return raw ? JSON.parse(raw) : [];
}
export function loadSalaryRecords(): SalaryRecord[] {
  const raw = localStorage.getItem("dmr-salary-records");
  return raw ? JSON.parse(raw) : [];
}
export function loadAdvanceLoans(): AdvanceLoan[] {
  const raw = localStorage.getItem("dmr-advance-loans");
  return raw ? JSON.parse(raw) : [];
}
export function loadAttendanceRecords(): AttendanceRecord[] {
  const raw = localStorage.getItem("dmr-attendance-records");
  return raw ? JSON.parse(raw) : [];
}
export function saveLeaveRequests(leaves: LeaveRequest[]): void { localStorage.setItem("dmr-leave-requests", JSON.stringify(leaves)); }
export function saveSalaryRecords(salaries: SalaryRecord[]): void { localStorage.setItem("dmr-salary-records", JSON.stringify(salaries)); }
export function saveAdvanceLoans(records: AdvanceLoan[]): void { localStorage.setItem("dmr-advance-loans", JSON.stringify(records)); }
export function saveAttendanceRecords(records: AttendanceRecord[]): void { localStorage.setItem("dmr-attendance-records", JSON.stringify(records)); }

// ---------------------------------------------------------------------------
// Dashboard aggregation — quarter-synced
// ---------------------------------------------------------------------------
const DASHBOARD_CACHE_KEY = "staff-dashboard-cache";
let lastSnapshot: StaffDashboardData | null = null;
let lastSnapshotAt = 0;

// Async loader that prefers the quarter sample API
export async function loadStaffDashboardData(): Promise<StaffDashboardData> {
  try {
    const overview = await loadStaffOverview();
    const snap: StaffDashboardData = {
      totalEmployees: overview.dashboard.totalEmployees,
      presentToday: overview.dashboard.presentToday,
      onDutyToday: overview.dashboard.onDutyToday,
      onLeave: overview.dashboard.onLeave,
      salaryPending: overview.dashboard.salaryPending,
      dutyAllocation: overview.dashboard.dutyAllocation,
      weeklyAttendance: overview.dashboard.weeklyAttendance,
      onDutyEmployees: overview.dashboard.onDutyEmployees,
    };
    lastSnapshot = snap;
    lastSnapshotAt = Date.now();
    setCache(`${DASHBOARD_CACHE_KEY}_quarter`, snap);
    return snap;
  } catch {
    // fallback to sync path
    return getStaffDashboardData(toBusinessDate(new Date()), toBusinessDate(new Date()), "");
  }
}

export function getStaffDashboardData(fromDate: string, toDate: string, department: string): StaffDashboardData {
  // Return fresh quarter snapshot when available (within TTL)
  if (lastSnapshot && Date.now() - lastSnapshotAt < CACHE_TTL) return lastSnapshot;
  const quarterCached = getCache<StaffDashboardData>(`${DASHBOARD_CACHE_KEY}_quarter`);
  if (quarterCached) {
    lastSnapshot = quarterCached;
    lastSnapshotAt = Date.now();
    return quarterCached;
  }

  const cacheKey = `${DASHBOARD_CACHE_KEY}_${fromDate}_${toDate}_${department}`;
  const cached = getCache<StaffDashboardData>(cacheKey);
  if (cached) return cached;

  const employees = loadEmployees();
  const trips = loadTrips();
  const leaves = loadLeaveRequests();
  const salaries = loadSalaryRecords();
  const filteredEmployees = department ? employees.filter((e) => e.department === department) : employees;
  const today = toBusinessDate(new Date());
  const totalEmployees = filteredEmployees.length;
  const presentToday = filteredEmployees.filter((emp) => trips.some((trip) => trip.tripDate === today && (trip.driverName === emp.employeeName || trip.supervisorName === emp.employeeName))).length;
  const onDutyToday = filteredEmployees.filter((emp) => trips.some((trip) => trip.tripDate === today && (trip.driverName === emp.employeeName || trip.supervisorName === emp.employeeName))).length;
  const onLeave = filteredEmployees.filter((emp) => leaves.some((leave) => leave.employeeId === emp.id && leave.status === "Approved" && leave.fromDate <= today && leave.toDate >= today)).length;
  const salaryPending = salaries.filter((s) => s.status === "Pending").length;
  const dutyAllocation = [
    { label: "Delivery", value: 0, color: "#8B5CF6" },
    { label: "Repair", value: 0, color: "#60A5FA" },
    { label: "Office Duty", value: 0, color: "#FCD34D" },
    { label: "Collection", value: 0, color: "#34D399" },
  ];
  const completedTrips = trips.filter((t) => t.status === "Completed");
  const totalCompleted = completedTrips.length || 1;
  dutyAllocation[0].value = Math.round((completedTrips.filter((t) => t.driverName).length / totalCompleted) * 100);
  dutyAllocation[1].value = Math.round((completedTrips.filter((t) => t.vehicleNo.includes("R")).length / totalCompleted) * 100);
  dutyAllocation[2].value = Math.round((completedTrips.filter((t) => t.supervisorName.includes("Office")).length / totalCompleted) * 100);
  dutyAllocation[3].value = 100 - dutyAllocation[0].value - dutyAllocation[1].value - dutyAllocation[2].value;
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyAttendance = daysOfWeek.map((day, index) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - index));
    const dateStr = date.toISOString().split("T")[0];
    const present = filteredEmployees.filter((emp) => trips.some((trip) => trip.tripDate === dateStr && (trip.driverName === emp.employeeName || trip.supervisorName === emp.employeeName))).length;
    const leave = filteredEmployees.filter((emp) => leaves.some((l) => l.employeeId === emp.id && l.status === "Approved" && l.fromDate <= dateStr && l.toDate >= dateStr)).length;
    const absent = totalEmployees - present - leave;
    return { day, present, absent, leave };
  });
  const onDutyEmployees = filteredEmployees
    .filter((emp) => trips.some((trip) => trip.tripDate === today && (trip.driverName === emp.employeeName || trip.supervisorName === emp.employeeName)))
    .map((emp) => {
      const trip = trips.find((t) => t.tripDate === today && (t.driverName === emp.employeeName || t.supervisorName === emp.employeeName));
      const dutyType = emp.department === "Driver" ? "Delivery" : "Repair";
      const vehicle = trip?.vehicleNo || "N/A";
      const status: "Active" | "Delayed" = Math.random() > 0.2 ? "Active" : "Delayed";
      return { id: emp.id, name: emp.employeeName, role: emp.role, dutyType, vehicle, status, avatar: emp.avatar };
    });

  const result: StaffDashboardData = { totalEmployees, presentToday, onDutyToday, onLeave, salaryPending, dutyAllocation, weeklyAttendance, onDutyEmployees };
  setCache(cacheKey, result);
  return result;
}

export function clearStaffDashboardCache(): void { clearCache(DASHBOARD_CACHE_KEY); lastSnapshot = null; }

// ---------------------------------------------------------------------------
// LEAVE BALANCE HELPERS (unchanged)
// ---------------------------------------------------------------------------
export function getLeaveBalance(employeeId: number): LeaveBalance | null {
  const employees = loadEmployees();
  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) return null;
  const leaves = loadLeaveRequests().filter((l) => l.employeeId === employeeId && l.status === "Approved");
  const usedDays = leaves.reduce((sum, l) => sum + l.days, 0);
  const quotas = { casual: 12, sick: 10, emergency: 5, annual: 15 };
  let remaining = usedDays;
  const casualRemaining = Math.max(0, quotas.casual - Math.min(remaining, quotas.casual)); remaining -= quotas.casual - casualRemaining;
  const sickRemaining = Math.max(0, quotas.sick - Math.min(remaining, quotas.sick)); remaining -= quotas.sick - sickRemaining;
  const emergencyRemaining = Math.max(0, quotas.emergency - Math.min(remaining, quotas.emergency)); remaining -= quotas.emergency - emergencyRemaining;
  const annualRemaining = Math.max(0, quotas.annual - Math.min(remaining, quotas.annual));
  const total = quotas.casual + quotas.sick + quotas.emergency + quotas.annual;
  return { employeeId, employeeName: employee.employeeName, casual: casualRemaining, sick: sickRemaining, emergency: emergencyRemaining, annual: annualRemaining, total, used: usedDays, remaining: Math.max(0, total - usedDays) };
}
export function getAllLeaveBalances(): LeaveBalance[] {
  return loadEmployees().map((e) => getLeaveBalance(e.id)).filter((b): b is LeaveBalance => b !== null);
}

// ---------------------------------------------------------------------------
// DUTY PLANNER HELPERS
// ---------------------------------------------------------------------------
export function getShiftConfigs(): ShiftConfig[] {
  return [
    { type: "Driver", label: "Driver", bgColor: "bg-blue-100", textColor: "text-blue-700", borderColor: "border-blue-300" },
    { type: "Delivery", label: "Duty", bgColor: "bg-green-100", textColor: "text-green-700", borderColor: "border-green-300" },
    { type: "Rest", label: "Leave", bgColor: "bg-slate-100", textColor: "text-slate-600", borderColor: "border-slate-300" },
    { type: "Repair", label: "Repair", bgColor: "bg-amber-100", textColor: "text-amber-700", borderColor: "border-amber-300" },
    { type: "Office", label: "Office", bgColor: "bg-indigo-100", textColor: "text-indigo-700", borderColor: "border-indigo-300" },
    { type: "OfficeDuty", label: "Office Duty", bgColor: "bg-indigo-50", textColor: "text-indigo-600", borderColor: "border-indigo-200" },
    { type: "Collection", label: "Collection", bgColor: "bg-teal-100", textColor: "text-teal-700", borderColor: "border-teal-300" },
    { type: "WeeklyOff", label: "Weekly Off", bgColor: "bg-rose-100", textColor: "text-rose-700", borderColor: "border-rose-300" },
    { type: "Off", label: "Off", bgColor: "bg-purple-100", textColor: "text-purple-700", borderColor: "border-purple-300" },
  ];
}
const ROLE_SHIFT_TYPES: Record<string, ShiftConfig["type"][]> = {
  Supervisor: ["Delivery", "Office", "Rest", "WeeklyOff", "Off"],
  Driver: ["Delivery", "Repair", "Office", "Rest", "WeeklyOff", "Off"],
  Helper: ["Delivery", "Repair", "Office", "Rest", "WeeklyOff", "Off"],
  Loader: ["Delivery", "Repair", "Office", "Rest", "WeeklyOff", "Off"],
};
export function getShiftConfigsForRole(role?: string): ShiftConfig[] {
  const all = getShiftConfigs();
  if (!role) return all;
  const wanted = ROLE_SHIFT_TYPES[role.trim()];
  if (!wanted) return all.filter((s) => s.type === "WeeklyOff");
  const picked = wanted.map((t) => all.find((s) => s.type === t)!).filter(Boolean) as ShiftConfig[];
  return picked.map((s) => {
    if (s.type === "WeeklyOff") return { ...s, bgColor: "bg-purple-100", textColor: "text-purple-700", borderColor: "border-purple-300" };
    if (s.type === "Off") return { ...s, bgColor: "bg-rose-100", textColor: "text-rose-700", borderColor: "border-rose-300" };
    return s;
  });
}

// ---------------------------------------------------------------------------
// ATTENDANCE REGISTER HELPERS
// ---------------------------------------------------------------------------
export function getAttendanceMonthMatrix(_month: string, department: string): AttendanceRecord[] {
  let filtered = loadEmployees();
  if (department) filtered = filtered.filter((e) => e.department === department);
  const allRecords = loadAttendanceRecords();
  if (!allRecords.length) return filtered.map((emp) => ({ employeeId: emp.id, employeeName: emp.employeeName, department: emp.department, presentCount: 0, absentCount: 0, leaveCount: 0, halfDayCount: 0 }));
  return allRecords;
}
export function saveAttendanceRecord(record: AttendanceRecord): void {
  const records = loadAttendanceRecords();
  const idx = records.findIndex((r) => r.employeeId === record.employeeId);
  if (idx !== -1) records[idx] = record; else records.push(record);
  saveAttendanceRecords(records);
}
const CACHE_KEYS = {
  DASHBOARD: "staff-dashboard-cache",
  DUTY_PLANNER: "staff-duty-planner-cache",
  ATTENDANCE: "staff-attendance-cache",
  LEAVE: "staff-leave-cache",
  SALARY_SHEET: "staff-salary-sheet-cache",
  SALARY_REGISTER: "staff-salary-register-cache",
  ADVANCE_LOAN: "staff-advance-loan-cache",
  EMPLOYEE_HISTORY: "staff-employee-history-cache",
  DRIVER_PERFORMANCE: "staff-driver-performance-cache",
  SUPERVISOR_PERFORMANCE: "staff-supervisor-performance-cache",
};
export const STAFF_CACHE_KEYS = CACHE_KEYS;
export function clearAllStaffCache(): void { Object.values(CACHE_KEYS).forEach((k) => clearCache(k)); }
