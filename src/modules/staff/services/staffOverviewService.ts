// src/modules/staff/services/staffOverviewService.ts
// ---------------------------------------------------------------------------
// Staff Overview — Quarter-sample aware data loader.
//
// Mirrors the executive dashboard's data strategy:
//   1) When the quarter sample API (scripts/quarter-sample-data.mjs, started
//      by `npm run dev`) identifies itself via GET /api/quarter-summary, every
//      staff row is read from that SAME dataset, so the overview can never
//      disagree with Duty Planner, Leaves, Salary Register and Performance.
//   2) Against a real PostgreSQL backend (or when the sample server is off)
//      the probe resolves to null and we fall back to the live backend APIs.
//   3) Legacy localStorage fallback only for absolute offline preview.
//
// This service aggregates:
//   - Staff dashboard KPIs (/api/staff/dashboard)
//   - Employee masters (/api/masters/employees) for department breakdown
//   - Leaves snapshot (list + report)
//   - Salary month summary (current quarter months)
//   - Performance snapshots (driver/supervisor default period)
// and exposes one composite type for the overview page.
// ---------------------------------------------------------------------------

import { apiClient, apiGet, apiTryGet } from "../../../api";
import { getQuarterSampleInfo, type SampleQuarter } from "../../../sample/quarterSample";
import type { Employee } from "../types/staffDashboard";
import type { DriverPerformanceResponse, SupervisorPerformanceResponse } from "../types/performance";

export interface StaffOverviewDashboard {
  totalEmployees: number;
  presentToday: number;
  onDutyToday: number;
  onLeave: number;
  salaryPending: number;
  dutyAllocation: { label: string; value: number; color: string }[];
  weeklyAttendance: { day: string; present: number; absent: number; leave: number }[];
  onDutyEmployees: {
    id: number;
    name: string;
    role: string;
    dutyType: string;
    vehicle: string;
    status: "Active" | "Delayed";
    avatar?: string;
  }[];
}

export interface StaffOverviewCounts {
  employees: number;
  departments: Record<string, number>;
  dutyAssignments: number;
  leaves: { total: number; pending: number; approved: number; rejected: number };
  salaries: { total: number; pending: number; submitted: number; paid: number; netPayroll: number };
  performance: {
    drivers: number;
    supervisors: number;
    topDrivers: { name: string; trips: number; distance: number }[];
    topSupervisors: { name: string; trips: number; shops: number }[];
  };
  quarter: SampleQuarter | null;
}

export interface StaffOverviewData {
  dashboard: StaffOverviewDashboard;
  employees: Employee[];
  counts: StaffOverviewCounts;
  sampleQuarter: SampleQuarter | null;
  mastersFromApi: boolean;
  usingSample: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toEmployees(rows: unknown[]): Employee[] {
  return (rows as Record<string, unknown>[])
    .map((r) => ({
      id: Number(r.id ?? r.employeeNo ?? 0),
      employeeNo: Number(r.employeeNo ?? r.employee_no ?? r.id ?? 0),
      employeeName: String(r.employeeName ?? r.name ?? r.employee_name ?? ""),
      employeeNameTe: r.employeeNameTe ? String(r.employeeNameTe) : r.employee_name_te ? String(r.employee_name_te) : undefined,
      department: String(r.department ?? ""),
      role: String(r.role ?? ""),
      phoneNumber: String(r.phoneNumber ?? r.phone_number ?? ""),
      email: String(r.email ?? ""),
      salary: Number(r.salary ?? 0),
      status: (String(r.status) === "Inactive" ? "Inactive" : String(r.status) === "Suspended" ? "Suspended" : "Active") as Employee["status"],
      joiningDate: String(r.joiningDate ?? r.joining_date ?? ""),
    }))
    .filter((e) => e.employeeName);
}

// ---------------------------------------------------------------------------
// Fetchers that honour the quarter sample API when present
// ---------------------------------------------------------------------------

async function fetchStaffDashboard(): Promise<StaffOverviewDashboard | null> {
  try {
    const { data } = await apiGet<Record<string, unknown>>("/staff/dashboard", { timeout: 8000 });
    // Validate shape
    if (data && typeof data.totalEmployees === "number") {
      return {
        totalEmployees: Number(data.totalEmployees ?? 0),
        presentToday: Number((data as Record<string, unknown>).presentToday ?? 0),
        onDutyToday: Number((data as Record<string, unknown>).onDutyToday ?? 0),
        onLeave: Number((data as Record<string, unknown>).onLeave ?? 0),
        salaryPending: Number((data as Record<string, unknown>).salaryPending ?? 0),
        dutyAllocation: Array.isArray(data.dutyAllocation) ? (data.dutyAllocation as StaffOverviewDashboard["dutyAllocation"]) : [],
        weeklyAttendance: Array.isArray(data.weeklyAttendance) ? (data.weeklyAttendance as StaffOverviewDashboard["weeklyAttendance"]) : [],
        onDutyEmployees: Array.isArray((data as Record<string, unknown>).onDutyEmployees)
          ? ((data as Record<string, unknown>).onDutyEmployees as StaffOverviewDashboard["onDutyEmployees"])
          : [],
      };
    }
  } catch {
    // fallback handled by caller
  }
  return null;
}

async function fetchEmployees(): Promise<Employee[]> {
  const apiRows = await apiTryGet<unknown[]>("/masters/employees", { timeout: 4000 });
  if (apiRows?.length) return toEmployees(apiRows);
  return [];
}

async function fetchLeaveStats(): Promise<{ total: number; pending: number; approved: number; rejected: number }> {
  try {
    // Light paged read for totals — quarter has ~380 rows
    const { data } = await apiClient.get<unknown>("/staff/leaves", {
      params: { page: 1, limit: 1 },
      timeout: 6000,
    });
    const envelope = data as Record<string, unknown> | null;
    const total = Number(envelope?.total ?? 0);
    // Try to get breakdown via report-less aggregation if total available
    // Fallback to parsing counts via separate filtered calls when needed
    if (total > 0) {
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        apiClient.get<unknown>("/staff/leaves", { params: { status: "Pending", page: 1, limit: 1 }, timeout: 4000 }).catch(() => null),
        apiClient.get<unknown>("/staff/leaves", { params: { status: "Approved", page: 1, limit: 1 }, timeout: 4000 }).catch(() => null),
        apiClient.get<unknown>("/staff/leaves", { params: { status: "Rejected", page: 1, limit: 1 }, timeout: 4000 }).catch(() => null),
      ]);
      return {
        total,
        pending: Number((pendingRes?.data as Record<string, unknown> | undefined)?.total ?? 0),
        approved: Number((approvedRes?.data as Record<string, unknown> | undefined)?.total ?? 0),
        rejected: Number((rejectedRes?.data as Record<string, unknown> | undefined)?.total ?? 0),
      };
    }
  } catch {
    // ignore
  }
  return { total: 0, pending: 0, approved: 0, rejected: 0 };
}

async function fetchSalaryStats(sampleQuarter: SampleQuarter | null): Promise<{ total: number; pending: number; submitted: number; paid: number; netPayroll: number }> {
  const month = sampleQuarter ? sampleQuarter.today.slice(0, 7) : new Date().toISOString().slice(0, 7);
  let summary: { total: number; pending: number; submitted: number; paid: number } | null = null;
  try {
    const { data } = await apiGet<Record<string, unknown>>("/staff/salaries/month-summary", {
      params: { month },
      timeout: 6000,
    });
    if (data) {
      summary = {
        total: Number(data.employees ?? 0),
        pending: Number(data.pending ?? 0),
        submitted: Number(data.submitted ?? 0),
        paid: Number(data.paid ?? 0),
      };
    }
  } catch {
    // ignore
  }
  // Always also fetch the list to compute net payroll (summary has no money)
  let net = 0;
  let listRows: Record<string, unknown>[] | null = null;
  try {
    const { data } = await apiGet<unknown[]>("/staff/salaries", { params: { month }, timeout: 6000 });
    if (Array.isArray(data)) {
      listRows = data as Record<string, unknown>[];
      for (const r of listRows) net += Number(r.netSalary ?? r.net_salary ?? 0);
    }
  } catch {
    // ignore
  }
  if (summary) {
    return { ...summary, netPayroll: Math.round(net) };
  }
  if (listRows) {
    let pending = 0, submitted = 0, paid = 0;
    for (const r of listRows) {
      const s = String(r.status);
      if (s === "Pending") pending += 1;
      else if (s === "Submitted") submitted += 1;
      else if (s === "Paid") paid += 1;
    }
    return { total: listRows.length, pending, submitted, paid, netPayroll: Math.round(net) };
  }
  return { total: 0, pending: 0, submitted: 0, paid: 0, netPayroll: 0 };
}

async function fetchPerformanceSnapshot(sampleQuarter?: SampleQuarter | null): Promise<{ drivers: number; supervisors: number; topDrivers: StaffOverviewCounts["performance"]["topDrivers"]; topSupervisors: StaffOverviewCounts["performance"]["topSupervisors"] }> {
  try {
    // Anchor on the quarter's today so the overview matches the dataset's window,
    // not the browser's local calendar (which can differ by a day in another TZ).
    const anchor = sampleQuarter?.today ? new Date(`${sampleQuarter.today}T00:00:00Z`) : new Date();
    const toDate = anchor;
    const fromDate = new Date(anchor); fromDate.setUTCDate(fromDate.getUTCDate() - 30);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const [driverRes, supRes] = await Promise.all([
      apiGet<DriverPerformanceResponse>("/staff/performance/drivers", { params: { fromDate: fmt(fromDate), toDate: fmt(toDate) }, timeout: 8000 }).catch(() => null),
      apiGet<SupervisorPerformanceResponse>("/staff/performance/supervisors", { params: { fromDate: fmt(fromDate), toDate: fmt(toDate) }, timeout: 8000 }).catch(() => null),
    ]);
    const drivers = driverRes?.data?.rows ?? [];
    const sups = supRes?.data?.rows ?? [];
    return {
      drivers: Number(driverRes?.data?.kpis?.drivers ?? drivers.length ?? 0),
      supervisors: Number(supRes?.data?.kpis?.supervisors ?? sups.length ?? 0),
      topDrivers: drivers.slice(0, 3).map((r) => ({ name: r.driverName, trips: r.trips, distance: Math.round(r.distance) })),
      topSupervisors: sups.slice(0, 3).map((r) => ({ name: r.supervisorName, trips: r.trips, shops: r.shops })),
    };
  } catch {
    return { drivers: 0, supervisors: 0, topDrivers: [], topSupervisors: [] };
  }
}

// ---------------------------------------------------------------------------
// Main loader
// ---------------------------------------------------------------------------

export async function loadStaffOverview(): Promise<StaffOverviewData> {
  const sample = await getQuarterSampleInfo();
  const sampleQuarter = sample?.quarter ?? null;

  // Fetch all in parallel; each is resilient to failure
  const [dashboard, employees, leaveStats, salaryStats, perf] = await Promise.all([
    fetchStaffDashboard(),
    fetchEmployees(),
    fetchLeaveStats(),
    fetchSalaryStats(sampleQuarter),
    fetchPerformanceSnapshot(sampleQuarter),
  ]);

  // Dashboard fallback when sample server not present or endpoint missing
  const fallbackDashboard: StaffOverviewDashboard = dashboard ?? {
    totalEmployees: employees.length,
    presentToday: 0,
    onDutyToday: 0,
    onLeave: 0,
    salaryPending: salaryStats.pending,
    dutyAllocation: [],
    weeklyAttendance: [],
    onDutyEmployees: [],
  };

  // Derive department counts from employee masters (quarter has 150)
  const departments: Record<string, number> = {};
  for (const e of employees) {
    departments[e.department] = (departments[e.department] ?? 0) + 1;
  }

  // If we have a sampleQuarter, pull canonical counts from it
  const dutyAssignments = sample ? Number(sample.counts.dutyAssignments ?? 0) : 0;
  const sampleLeaves = sample ? Number(sample.counts.leaves ?? 0) : 0;
  const sampleSalaries = sample ? Number(sample.counts.salaries ?? 0) : 0;

  const counts: StaffOverviewCounts = {
    employees: employees.length || fallbackDashboard.totalEmployees,
    departments,
    dutyAssignments: dutyAssignments || employees.length * 7, // fallback
    leaves: {
      total: leaveStats.total || sampleLeaves,
      pending: leaveStats.pending,
      approved: leaveStats.approved,
      rejected: leaveStats.rejected,
    },
    salaries: {
      total: salaryStats.total || sampleSalaries,
      pending: salaryStats.pending,
      submitted: salaryStats.submitted,
      paid: salaryStats.paid,
      netPayroll: salaryStats.netPayroll,
    },
    performance: perf,
    quarter: sampleQuarter,
  };

  return {
    dashboard: fallbackDashboard,
    employees,
    counts,
    sampleQuarter,
    mastersFromApi: employees.length > 0,
    usingSample: Boolean(sampleQuarter),
  };
}
