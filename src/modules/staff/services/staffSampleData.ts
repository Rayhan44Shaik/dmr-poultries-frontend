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

import type { Employee, SalaryRecord } from "../types/staffDashboard";
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
 * Deterministic weekly schedules. Vehicle crews work in two-day trips:
 * the trip starts from the office on the "Trip Start" day (~12 PM) and
 * the driver returns on the "On Trip" day (9 AM–4 PM, varies). Both days
 * are working days. Index 5 is Saturday (compulsory duty) — never
 * Rest / WeeklyOff.
 */
const SAMPLE_SCHEDULE: Record<string, string[]> = {
  Supervisor: ["Delivery", "Office",  "Rest",   "Delivery", "Office",  "Delivery", "Rest"],
  Driver:     ["TripStart","OnTrip",  "Rest",   "TripStart","OnTrip",  "TripStart","OnTrip"],
  Helper:     ["TripStart","OnTrip",  "Office", "TripStart","OnTrip",  "Office",   "Rest"],
  Loader:     ["TripStart","OnTrip",  "Repair", "Office",   "TripStart","OnTrip",  "Rest"],
};

function dutyForRole(role: string, dayIndex: number): string {
  const row = SAMPLE_SCHEDULE[role] ?? SAMPLE_SCHEDULE.Helper;
  // Saturday (index 5) is compulsory duty — never Leave / WeeklyOff.
  if (dayIndex === 5 && (row[dayIndex] === "Rest" || row[dayIndex] === "WeeklyOff")) {
    return "Delivery";
  }
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

function buildAssignments(week: { date: string }[]): DutyPlannerWeek["assignments"] {
  const assignments: DutyPlannerWeek["assignments"] = [];
  SAMPLE_EMPLOYEES.forEach((emp) => {
    week.forEach((day, dayIndex) => {
      let dutyType: string = dutyForRole(emp.role, dayIndex);
      if (emp.id === SAMPLE_CUSTOM_DUTY.employeeId && dayIndex === SAMPLE_CUSTOM_DUTY.dayIndex) {
        dutyType = SAMPLE_CUSTOM_DUTY.dutyType;
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

/** Re-derive the Saturday summary from the current assignments. */
function refreshSaturday(week: DutyPlannerWeek): DutyPlannerWeek {
  const satDate = week.days[5]?.date;
  const satAssignments = week.assignments.filter((a) => a.date === satDate);
  const assigned = satAssignments.filter((a) => a.dutyType !== "Rest" && a.dutyType !== "WeeklyOff").length;
  const required = week.employees.length;
  const shortage = Math.max(0, required - assigned);
  return {
    ...week,
    saturday: {
      required,
      assigned,
      shortage,
      status: shortage === 0 ? "Fully Staffed" : `Short ${shortage}`,
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
export function buildSampleDutyWeek(weekStart: string): DutyPlannerWeek {
  const days = weekDays(weekStart);
  const base: DutyPlannerWeek = {
    weekStart: days[0].date,
    weekEnd: days[days.length - 1].date,
    status: "Open",
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

/** Attendance counts for one employee from a duty week. */
function attendanceFrom(week: DutyPlannerWeek, employeeId: number) {
  const mine = week.assignments.filter((a) => a.employeeId === employeeId);
  let present = 0;
  let leave = 0;
  let weeklyOff = 0;
  mine.forEach((a) => {
    if (a.dutyType === "Rest") leave += 1;
    else if (a.dutyType === "WeeklyOff") weeklyOff += 1;
    else present += 1; // Duty / Trip Start / On Trip / Office / Repair / Collection / custom "Other"
  });
  return {
    workingDays: mine.length,
    presentDays: present,
    leaveDays: leave,
    weeklyOffDays: weeklyOff,
  };
}

export function buildSampleSalaryRecords(month: string, weekStart?: string): SalaryRecord[] {
  const week = buildSampleDutyWeek(weekStart ?? toDateStr(mondayOf(new Date())));
  const now = new Date().toISOString();
  return SAMPLE_EMPLOYEES.map((emp, i) => {
    const att = attendanceFrom(week, emp.id);
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
