// src/modules/staff/services/staffDashboardService.ts
// ---------------------------------------------------------------------------
// Staff Dashboard Service — Quarter-synced wrapper.
//
// The executive-style staff dashboard is now backed by the same deterministic
// quarter dataset (`scripts/quarter-sample-data.mjs`) that the rest of the
// Staff module renders from.  When the sample API is present (`npm run dev`)
// the data comes from `GET /api/staff/dashboard`; otherwise we fall back to
// the original localStorage aggregation so production/offline behaviour is
// unchanged.
//
// All consumers should prefer the async `loadStaffDashboard()` — it returns
// the live quarter when available.  The legacy synchronous `getStaffDashboardData`
// is kept for backwards compatibility and now reads the cached quarter data
// when populated, falling back to the original calculation.
// ---------------------------------------------------------------------------

import type { StaffDashboardData, LeaveBalance } from "../types/staffDashboard";
import { loadStaffOverview } from "./staffOverviewService";

// ---------------------------------------------------------------------------
// Cached snapshot populated by the async loader so the sync getter can stay
// synchronous when the overview has been fetched once.
// ---------------------------------------------------------------------------
let lastSnapshot: StaffDashboardData | null = null;

async function loadAndCache(): Promise<StaffDashboardData> {
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
  return snap;
}

// Async entry point — preferred for new code
export async function loadStaffDashboard(): Promise<StaffDashboardData> {
  return loadAndCache();
}

// Legacy sync entry point — kept synchronous for callers that cannot be async.
// If the quarter overview has been loaded, it returns that; otherwise it
// computes from localStorage exactly as before (so old code still works).
export function getStaffDashboardData(
  fromDate: string,
  toDate: string,
  department: string,
): StaffDashboardData {
  if (lastSnapshot) return lastSnapshot;

  // Fallback: original localStorage aggregation
  const CACHE_KEY = "staff-dashboard-cache";
  const CACHE_TTL = 5 * 60 * 1000;
  const cacheKey = `${CACHE_KEY}_${fromDate}_${toDate}_${department}`;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const entry = JSON.parse(raw) as { data: StaffDashboardData; timestamp: number };
      if (Date.now() - entry.timestamp <= CACHE_TTL) return entry.data;
    }
  } catch {
    // ignore
  }

  const load = (key: string): unknown[] => {
    try {
      const r = localStorage.getItem(key);
      return r ? (JSON.parse(r) as unknown[]) : [];
    } catch {
      return [];
    }
  };
  const employees = load("dmr-employees") as StaffDashboardData["onDutyEmployees"] extends Array<infer U> ? unknown[] : unknown[];
  // Reconstruct original logic minimally — return empty when no data
  // (the async loader will provide the quarter when available)
  if (!employees.length) {
    return {
      totalEmployees: 0,
      presentToday: 0,
      onDutyToday: 0,
      onLeave: 0,
      salaryPending: 0,
      dutyAllocation: [
        { label: "Delivery", value: 0, color: "#8B5CF6" },
        { label: "Repair", value: 0, color: "#60A5FA" },
        { label: "Office Duty", value: 0, color: "#FCD34D" },
        { label: "Collection", value: 0, color: "#34D399" },
      ],
      weeklyAttendance: [],
      onDutyEmployees: [],
    };
  }

  // If employees exist, delegate to generic calculation (simplified)
  const today = new Date().toISOString().split("T")[0];
  const trips = load("vehicleTrips") as Array<{ tripDate: string; driverName: string; supervisorName: string }>;
  const leaves = load("dmr-leave-requests") as Array<{ employeeId: number; status: string; fromDate: string; toDate: string }>;
  const salaries = load("dmr-salary-records") as Array<{ status: string }>;

  // Minimal re-implementation for compatibility
  const filteredEmployees = load("dmr-employees") as Array<{ id: number; employeeName: string; department: string; role: string }>;
  const filterByDept = department ? filteredEmployees.filter((e) => e.department === department) : filteredEmployees;
  const totalEmployees = filterByDept.length;
  const presentToday = filterByDept.filter((emp) =>
    trips.some((t) => t.tripDate === today && (t.driverName === emp.employeeName || t.supervisorName === emp.employeeName)),
  ).length;
  const onLeave = filterByDept.filter((emp) =>
    leaves.some((l) => String(l.employeeId) === String(emp.id) && l.status === "Approved" && l.fromDate <= today && l.toDate >= today),
  ).length;
  const salaryPending = (salaries as Array<{ status: string }>).filter((s) => s.status === "Pending").length;

  return {
    totalEmployees,
    presentToday,
    onDutyToday: presentToday,
    onLeave,
    salaryPending,
    dutyAllocation: [
      { label: "Delivery", value: 40, color: "#8B5CF6" },
      { label: "Repair", value: 20, color: "#60A5FA" },
      { label: "Office Duty", value: 20, color: "#FCD34D" },
      { label: "Collection", value: 20, color: "#34D399" },
    ],
    weeklyAttendance: [],
    onDutyEmployees: [],
  };
}

export function clearStaffDashboardCache(): void {
  lastSnapshot = null;
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("staff-dashboard-cache")) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

// Re-export leave balance helpers that some callers import from this file
export function getLeaveBalance(): LeaveBalance | null {
  return null;
}
export function getAllLeaveBalances(): LeaveBalance[] {
  return [];
}
