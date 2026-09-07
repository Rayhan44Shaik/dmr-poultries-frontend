// src/modules/staff/services/staffSampleData.ts
// ------------------------------------------------------------
// SAMPLE / DEMO DATA — Staff page only.
//
// This file exists so the Staff pages can be reviewed without a
// running backend. It is NOT part of the real data path: the hooks
// only fall back to it when the staff API is unreachable. It touches
// no backend, no database, and no other module.
//
// Everything here is generated locally and matches the exact shapes
// the real API returns.
// ------------------------------------------------------------

import type { Employee, SalaryRecord, LeaveRequest } from "../types/staffDashboard";
import type { DutyPlannerWeek } from "./dutyPlannerService";

const pad = (n: number) => String(n).padStart(2, "0");
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Monday of the week containing `date`. */
function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** The seven day labels for a Monday-anchored week. */
function weekDays(weekStart: string) {
  const start = mondayOf(new Date(weekStart + "T00:00:00"));
  const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return weekdayNames.map((weekday, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { date: toDateStr(d), weekday };
  });
}

/**
 * Sample employees. `id` doubles as a stable key; `employeeNo` is the
 * human-readable badge shown across the staff screens.
 */
const SAMPLE_EMPLOYEES: Employee[] = [
  { id: 1,  employeeNo: 101, employeeName: "Karthik Reddy",  department: "Operations", role: "Supervisor", phoneNumber: "+91 98480 11111", email: "karthik.reddy@dmrpoultries.com",  salary: 32000, status: "Active", joiningDate: "2021-04-05" },
  { id: 2,  employeeNo: 102, employeeName: "Suresh Kumar",   department: "Fleet",      role: "Driver",     phoneNumber: "+91 98480 22222", email: "suresh.kumar@dmrpoultries.com",    salary: 24000, status: "Active", joiningDate: "2020-09-14" },
  { id: 3,  employeeNo: 103, employeeName: "Ravi Teja",      department: "Fleet",      role: "Driver",     phoneNumber: "+91 98480 33333", email: "ravi.teja@dmrpoultries.com",       salary: 24000, status: "Active", joiningDate: "2022-01-10" },
  { id: 4,  employeeNo: 104, employeeName: "Mohan Das",      department: "Farm",       role: "Helper",     phoneNumber: "+91 98480 44444", email: "mohan.das@dmrpoultries.com",       salary: 18000, status: "Active", joiningDate: "2023-02-20" },
  { id: 5,  employeeNo: 105, employeeName: "Prakash Naidu",  department: "Farm",       role: "Helper",     phoneNumber: "+91 98480 55555", email: "prakash.naidu@dmrpoultries.com",   salary: 18000, status: "Active", joiningDate: "2023-06-01" },
  { id: 6,  employeeNo: 106, employeeName: "Arjun Singh",    department: "Operations", role: "Supervisor", phoneNumber: "+91 98480 66666", email: "arjun.singh@dmrpoultries.com",     salary: 33000, status: "Active", joiningDate: "2019-11-18" },
  { id: 7,  employeeNo: 107, employeeName: "Vijay Babu",     department: "Warehouse",  role: "Helper",     phoneNumber: "+91 98480 77777", email: "vijay.babu@dmrpoultries.com",      salary: 17500, status: "Active", joiningDate: "2024-03-11" },
  { id: 8,  employeeNo: 108, employeeName: "Naveen Kumar",   department: "Fleet",      role: "Driver",     phoneNumber: "+91 98480 88888", email: "naveen.kumar@dmrpoultries.com",    salary: 25000, status: "Active", joiningDate: "2021-08-23" },
  { id: 9,  employeeNo: 109, employeeName: "Ramesh Chandra", department: "Accounts",   role: "Helper",     phoneNumber: "+91 98480 99999", email: "ramesh.chandra@dmrpoultries.com",  salary: 19000, status: "Active", joiningDate: "2022-07-04" },
  { id: 10, employeeNo: 110, employeeName: "Deepak Verma",   department: "Operations", role: "Supervisor", phoneNumber: "+91 98481 00000", email: "deepak.verma@dmrpoultries.com",    salary: 32500, status: "Active", joiningDate: "2020-05-29" },
  { id: 11, employeeNo: 111, employeeName: "Ganesh Rao",     department: "Warehouse",  role: "Helper",     phoneNumber: "+91 98481 11111", email: "ganesh.rao@dmrpoultries.com",      salary: 17000, status: "Inactive", joiningDate: "2023-10-16" },
  { id: 12, employeeNo: 112, employeeName: "Sandeep Kumar",  department: "Fleet",      role: "Driver",     phoneNumber: "+91 98481 22222", email: "sandeep.kumar@dmrpoultries.com",   salary: 24500, status: "Active", joiningDate: "2022-12-01" },
  { id: 13, employeeNo: 113, employeeName: "Abdul Kareem",   department: "Warehouse",  role: "Loader",     phoneNumber: "+91 98482 33333", email: "abdul.kareem@dmrpoultries.com",    salary: 18500, status: "Active", joiningDate: "2023-04-17" },
  { id: 14, employeeNo: 114, employeeName: "Manoj Kumar",    department: "Fleet",      role: "Loader",     phoneNumber: "+91 98482 44444", email: "manoj.kumar@dmrpoultries.com",     salary: 19000, status: "Active", joiningDate: "2022-10-08" },
];

/**
 * Deterministic weekly schedules. A delivery trip lasts one day (or up to
 * ~24 hours, spilling into the next), so the days a crew member is out
 * simply show as consecutive "Duty" days — one or two. After a trip the
 * person gets a holiday or two (Rest), depending on orders and vehicle
 * availability. Each role has a few variants; the employee id picks one
 * so the grid doesn't look cloned.
 */
const SAMPLE_SCHEDULES: Record<string, string[][]> = {
  Supervisor: [
    ["Delivery", "Office", "Rest", "Delivery", "Office", "Delivery", "Rest"],
  ],
  Driver: [
    ["Delivery", "Delivery", "Rest", "Delivery", "Rest",   "Delivery", "Rest"],
    ["Delivery", "Rest",   "Delivery", "Delivery", "Rest", "Delivery", "Rest"],
    ["Rest",     "Delivery", "Delivery", "Rest",   "Delivery", "Delivery", "Rest"],
  ],
  Helper: [
    ["Office",   "Delivery", "Rest", "Delivery", "Office", "Delivery", "Rest"],
    ["Delivery", "Office",   "Rest", "Office",   "Delivery", "Delivery", "Rest"],
  ],
  Loader: [
    ["Delivery", "Delivery", "Rest", "Office",   "Delivery", "Delivery", "Rest"],
    ["Office",   "Delivery", "Rest", "Delivery", "Repair",   "Delivery", "Rest"],
  ],
};

function dutyForRole(role: string, dayIndex: number, employeeId: number): string {
  const variants = SAMPLE_SCHEDULES[role] ?? SAMPLE_SCHEDULES.Helper;
  const row = variants[employeeId % variants.length];
  return row[dayIndex];
}

const SAMPLE_VEHICLES: Record<string, string> = {
  "2": "AP 09 AB 1234",
  "3": "AP 09 CD 5678",
  "8": "AP 09 EF 9012",
  "12": "AP 09 GH 3456",
};

/** One "Other" (free-text) example so the demo shows the custom-duty style. */
const SAMPLE_CUSTOM_DUTY: { employeeId: number; dayIndex: number; dutyType: string } = {
  employeeId: 10, // Deepak Verma (Supervisor)
  dayIndex: 6, // Sunday
  dutyType: "Farm Visit",
};

/** One-off "Off" days (a separate day off — not the regular Weekly Off),
 *  swapped in for a Rest day so the purple Off style is visible in the demo. */
const SAMPLE_OFF_DAYS: { employeeId: number; dayIndex: number }[] = [
  { employeeId: 3, dayIndex: 4 }, // Ravi Teja (Driver) — Friday
  { employeeId: 9, dayIndex: 2 }, // Ramesh Chandra (Helper) — Wednesday
  { employeeId: 14, dayIndex: 2 }, // Manoj Kumar (Loader) — Wednesday
];

function buildAssignments(week: { date: string }[]): DutyPlannerWeek["assignments"] {
  const assignments: DutyPlannerWeek["assignments"] = [];
  SAMPLE_EMPLOYEES.forEach((emp) => {
    week.forEach((day, dayIndex) => {
      let dutyType: string = dutyForRole(emp.role, dayIndex, emp.id);
      if (emp.id === SAMPLE_CUSTOM_DUTY.employeeId && dayIndex === SAMPLE_CUSTOM_DUTY.dayIndex) {
        dutyType = SAMPLE_CUSTOM_DUTY.dutyType;
      }
      if (SAMPLE_OFF_DAYS.some((o) => o.employeeId === emp.id && o.dayIndex === dayIndex)) {
        dutyType = "Off";
      }
      assignments.push({
        id: `sample-${emp.id}-${dayIndex}`,
        employeeId: emp.id,
        employeeName: emp.employeeName,
        department: emp.department,
        role: emp.role,
        dutyType: dutyType as DutyPlannerWeek["assignments"][number]["dutyType"],
        date: day.date,
        vehicleNo: SAMPLE_VEHICLES[String(emp.id)],
      });
    });
  });
  return assignments;
}

/** Re-derive the Saturday summary (informational only — Saturday is an
 * ordinary day, nothing is compulsory). */
function refreshSaturday(week: DutyPlannerWeek): DutyPlannerWeek {
  const satDate = week.days[5]?.date;
  const satAssignments = week.assignments.filter((a) => a.date === satDate);
  const assigned = satAssignments.filter((a) => a.dutyType !== "Rest" && a.dutyType !== "WeeklyOff").length;
  return {
    ...week,
    saturday: {
      required: 0,
      assigned,
      shortage: 0,
      status: "Optional",
      requiredByRole: {},
      assignedByRole: {},
      availableByRole: {},
    },
  };
}

/**
 * Build a full `DutyPlannerWeek` (employees + one week of assignments)
 * from a sample roster, for the week that contains `weekStart`.
 */
/** Sample weeks closed via "Submit Week" this session (in-memory only). */
const SAMPLE_CLOSED_WEEKS = new Set<string>();

export function markSampleWeekClosed(weekStart: string): void {
  SAMPLE_CLOSED_WEEKS.add(weekStart);
}

/** Monday (ISO) of the current week. */
function currentWeekMondayISO(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function buildSampleDutyWeek(weekStart: string): DutyPlannerWeek {
  const days = weekDays(weekStart);
  const base: DutyPlannerWeek = {
    weekStart: days[0].date,
    weekEnd: days[days.length - 1].date,
    // Past sample weeks are already closed (as are weeks the user closed via
    // "Submit Week" this session); the current/future week is Open. This
    // keeps the "close the previous week first" rule demonstrable.
    status:
      SAMPLE_CLOSED_WEEKS.has(days[0].date) || days[0].date < currentWeekMondayISO()
        ? "Submitted"
        : "Open",
    allRoles: Array.from(new Set(SAMPLE_EMPLOYEES.map((e) => e.role))),
    days,
    employees: [...SAMPLE_EMPLOYEES],
    assignments: buildAssignments(days),
    saturday: {
      required: 0,
      assigned: 0,
      shortage: 0,
      status: "",
      requiredByRole: {},
      assignedByRole: {},
      availableByRole: {},
    },
    validation: { ok: true, problems: [] },
  };
  return refreshSaturday(base);
}

/* ==================================================================
   Local (in-memory) edits for sample mode — the backend is down, so
   picker changes are applied to the sample week itself.
================================================================== */
export function localUpsertAssignment(
  week: DutyPlannerWeek,
  employeeId: number,
  date: string,
  dutyType: DutyPlannerWeek["assignments"][number]["dutyType"]
): DutyPlannerWeek {
  const emp = week.employees.find((e) => e.id === employeeId);
  if (!emp) return week;
  const existing = week.assignments.find((a) => a.employeeId === employeeId && a.date === date);
  const assignments = existing
    ? week.assignments.map((a) => (a === existing ? { ...a, dutyType } : a))
    : [
        ...week.assignments,
        {
          id: `sample-${employeeId}-${date}`,
          employeeId,
          employeeName: emp.employeeName,
          department: emp.department,
          role: emp.role,
          dutyType,
          date,
          vehicleNo: SAMPLE_VEHICLES[String(employeeId)],
        },
      ];
  return refreshSaturday({ ...week, assignments });
}

export function localDeleteAssignment(week: DutyPlannerWeek, id: string): DutyPlannerWeek {
  return refreshSaturday({ ...week, assignments: week.assignments.filter((a) => a.id !== id) });
}

/* ==================================================================
   SAMPLE SALARY REGISTER — with an Attendance Summary derived from
   the sample duty assignments (the same link the backend makes
   between the Duty Planner and the salary register).
================================================================== */

/** Attendance counts for one employee from a duty week. Approved-leave
 *  days without any assignment count as leave days. */
function attendanceFrom(week: DutyPlannerWeek, employeeId: number, leaves: LeaveRequest[] = []) {
  const mine = week.assignments.filter((a) => a.employeeId === employeeId);
  const assignedDates = new Set(mine.map((a) => a.date));
  const weekDateSet = new Set(week.days.map((d) => d.date));
  let present = 0;
  let leave = 0;
  let weeklyOff = 0;
  mine.forEach((a) => {
    if (a.dutyType === "Rest") leave += 1;
    else if (a.dutyType === "WeeklyOff" || a.dutyType === "Off") weeklyOff += 1;
    else present += 1; // Duty / Office / Repair / Collection / custom "Other"
  });
  // Approved leave on a day with no assigned duty.
  for (const lv of leaves) {
    if (lv.status !== "Approved" || lv.employeeId !== employeeId) continue;
    for (const ds of leaveDateRange(lv.fromDate, lv.toDate)) {
      if (weekDateSet.has(ds) && !assignedDates.has(ds)) leave += 1;
    }
  }
  return {
    workingDays: mine.length,
    presentDays: present,
    leaveDays: leave,
    weeklyOffDays: weeklyOff,
  };
}

export function buildSampleSalaryRecords(month: string, weekStart?: string): SalaryRecord[] {
  const week = buildSampleDutyWeek(weekStart ?? toDateStr(mondayOf(new Date())));
  const weekLeaves = buildSampleLeaves(week.weekStart);
  const now = new Date().toISOString();
  return SAMPLE_EMPLOYEES.map((emp, i) => {
    const att = attendanceFrom(week, emp.id, weekLeaves);
    const basicSalary = emp.salary;
    const overtime = emp.role === "Driver" ? 1200 : 0;
    const incentives = emp.role === "Supervisor" ? 2000 : 0;
    const fuelAllowance = emp.role === "Driver" ? 1800 : 0;
    const nightAllowance = 0;
    const totalGross = basicSalary + overtime + incentives + fuelAllowance + nightAllowance;
    const leaveDeduction = Math.round((basicSalary / 30) * att.leaveDays);
    const advanceRecovery = i === 3 ? 1500 : 0;
    const loanEMI = i === 6 ? 2000 : 0;
    const latePenalty = 0;
    const otherDeductions = 0;
    const totalDeductions = leaveDeduction + advanceRecovery + loanEMI + latePenalty + otherDeductions;
    const netSalary = totalGross - totalDeductions;

    // A few varied statuses so the register filters have something to show.
    let status: SalaryRecord["status"] = "Pending";
    let paymentDate: string | null = null;
    let paymentRef: string | null = null;
    let paidAt: string | null = null;
    let submittedAt: string | null = null;
    let submittedBy: string | null = null;
    if (i === 0) {
      status = "Paid";
      paymentDate = month + "-28";
      paymentRef = "UPI/DMR/" + emp.employeeNo;
      paidAt = now;
      submittedAt = now;
      submittedBy = "Rubulla";
    } else if (i === 5) {
      status = "Submitted";
      submittedAt = now;
      submittedBy = "Rubulla";
    }

    return {
      id: `sample-salary-${emp.id}-${month}`,
      employeeId: emp.id,
      employeeName: emp.employeeName,
      department: emp.department,
      role: emp.role,
      month,
      basicSalary,
      overtime,
      incentives,
      fuelAllowance,
      nightAllowance,
      totalGross,
      leaveDeduction,
      advanceRecovery,
      loanEMI,
      latePenalty,
      otherDeductions,
      totalDeductions,
      netSalary,
      status,
      paymentDate,
      paymentRef,
      paidAt,
      submittedAt,
      submittedBy,
      createdAt: now,
      workingDays: att.workingDays,
      presentDays: att.presentDays,
      leaveDays: att.leaveDays,
      weeklyOffDays: att.weeklyOffDays,
    };
  });
}

export const SAMPLE_EMPLOYEE_LIST = SAMPLE_EMPLOYEES;

/* ==================================================================
   SAMPLE LEAVES — deterministic per week. Only APPROVED leaves are
   shown/used anywhere; the Pending one proves the filter works.
================================================================== */

function leaveDateRange(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const t = new Date(fromDate + "T00:00:00");
  const end = new Date(toDate + "T00:00:00");
  while (t <= end) {
    dates.push(toDateStr(t));
    t.setDate(t.getDate() + 1);
  }
  return dates;
}

/** Sample leave requests for the week containing `weekStart`. */
export function buildSampleLeaves(weekStart: string): LeaveRequest[] {
  const days = weekDays(weekStart);
  const d = (i: number) => days[i].date;
  const now = new Date().toISOString();
  return [
    { id: `sample-leave-4-${d(2)}`, employeeId: 4, employeeName: "Mohan Das", type: "Casual", fromDate: d(2), toDate: d(2), days: 1, status: "Approved", reason: "Personal work", createdAt: now, approvedBy: "Owner", approvedAt: now },
    { id: `sample-leave-5-${d(1)}`, employeeId: 5, employeeName: "Prakash Naidu", type: "Sick", fromDate: d(1), toDate: d(2), days: 2, status: "Approved", reason: "Fever", createdAt: now, approvedBy: "Owner", approvedAt: now },
    { id: `sample-leave-12-${d(4)}`, employeeId: 12, employeeName: "Sandeep Kumar", type: "Casual", fromDate: d(4), toDate: d(4), days: 1, status: "Approved", reason: "Family function", createdAt: now, approvedBy: "Owner", approvedAt: now },
    { id: `sample-leave-13-${d(4)}`, employeeId: 13, employeeName: "Abdul Kareem", type: "Annual", fromDate: d(4), toDate: d(4), days: 1, status: "Approved", reason: "Out of town", createdAt: now, approvedBy: "Owner", approvedAt: now },
    // Pending — must NOT appear in the planner or count anywhere.
    { id: `sample-leave-7-${d(0)}`, employeeId: 7, employeeName: "Vijay Babu", type: "Casual", fromDate: d(0), toDate: d(0), days: 1, status: "Pending", reason: "Personal work", createdAt: now },
  ];
}

/* ==================================================================
   MONTHLY DUTIES — "future analysis" view: every day of a month for
   every employee (same deterministic weekly pattern as the planner).
   A day shows its assigned duty; an APPROVED leave shows as Leave
   when nothing is assigned (an assigned duty always overrides the
   leave).
================================================================== */

export interface SampleMonthDutyCell {
  date: string;
  /** Effective display type: assignment, or "Rest" when on approved
   *  leave with no assignment, or null when nothing. */
  dutyType: string | null;
  /** True when the employee has an approved leave on this date
   *  (even when an assigned duty overrides it). */
  isLeave: boolean;
}

export interface SampleMonthDuties {
  year: number;
  /** 0-based month index. */
  month: number;
  days: { date: string; weekday: string; dayNum: number }[];
  byEmployee: Record<number, SampleMonthDutyCell[]>;
}

export function buildSampleMonthDuties(year: number, month: number): SampleMonthDuties {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const days: { date: string; weekday: string; dayNum: number }[] = [];
  for (let dayNum = 1; dayNum <= lastDay; dayNum++) {
    const dt = new Date(year, month, dayNum);
    days.push({ date: toDateStr(dt), weekday: dt.toLocaleDateString("en-IN", { weekday: "short" }), dayNum });
  }

  // Every Monday whose week touches this month.
  const first = new Date(year, month, 1);
  first.setDate(first.getDate() - first.getDay() + (first.getDay() === 0 ? -6 : 1));
  first.setHours(0, 0, 0, 0);
  const last = new Date(year, month, lastDay);
  const mondays: string[] = [];
  for (const m = new Date(first); m <= last; m.setDate(m.getDate() + 7)) {
    mondays.push(toDateStr(new Date(m)));
  }

  const assign = new Map<string, string>(); // `${empId}|${date}` -> dutyType
  const leaveDates = new Map<number, Set<string>>();
  for (const mon of mondays) {
    for (const a of buildSampleDutyWeek(mon).assignments) {
      assign.set(`${a.employeeId}|${a.date}`, a.dutyType);
    }
    for (const lv of buildSampleLeaves(mon)) {
      if (lv.status !== "Approved") continue;
      let set = leaveDates.get(lv.employeeId);
      if (!set) {
        set = new Set<string>();
        leaveDates.set(lv.employeeId, set);
      }
      for (const ds of leaveDateRange(lv.fromDate, lv.toDate)) set.add(ds);
    }
  }

  const byEmployee: Record<number, SampleMonthDutyCell[]> = {};
  for (const emp of SAMPLE_EMPLOYEES) {
    byEmployee[emp.id] = days.map(({ date }) => {
      const duty = assign.get(`${emp.id}|${date}`) ?? null;
      const isLeave = leaveDates.get(emp.id)?.has(date) ?? false;
      return { date, dutyType: duty ?? (isLeave ? "Rest" : null), isLeave };
    });
  }
  return { year, month, days, byEmployee };
}
