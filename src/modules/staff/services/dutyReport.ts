// Shared, date-range-aware Duty Planner report model. The screen and Excel
// export use the same cells and counting rules; no PDF-specific abbreviations.
import type { DutyAssignment, Employee, LeaveListFilters, LeaveListResult, LeaveRequest } from '../types/staffDashboard';
import type { DutyPlannerWeek } from './dutyPlannerService';

export interface DutyReportRange {
  fromDate: string;
  toDate: string;
}

export type DutyReportEmployee = Pick<Employee, 'id' | 'employeeName' | 'role' | 'department'> & {
  employeeNo?: number;
};

export interface DutyReportCell {
  date: string;
  /** An explicit assignment takes precedence over an approved leave. */
  dutyType: string | null;
  assignedDutyType: string | null;
  isLeave: boolean;
  vehicleNo: string;
}

export interface DutyReportData extends DutyReportRange {
  days: { date: string; weekday: string; dayNum: number }[];
  employees: DutyReportEmployee[];
  byEmployee: Record<number, DutyReportCell[]>;
  usingSampleData: boolean;
}

export interface DutyCounts {
  duty: number;
  leave: number;
  off: number;
  weeklyOff: number;
  noEntry: number;
  future: number;
}

export const DUTY_COUNT_COLUMNS = [
  { key: 'leave', label: 'Leave' },
  { key: 'off', label: 'Off' },
  { key: 'weeklyOff', label: 'Weekly Off' },
  { key: 'noEntry', label: 'No Entry' },
  { key: 'duty', label: 'Duty Count' },
] as const;

// Excel's real column limit, after employee identity and count columns. Do not
// silently truncate a user's custom range or impose a month/year boundary.
export const MAX_DUTY_REPORT_DAYS = 16_384 - 4 - DUTY_COUNT_COLUMNS.length;
const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parse a calendar date in UTC for arithmetic (never shift an Indian date). */
function dateValue(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1900-01-01') return NaN;
  const value = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(value) && new Date(value).toISOString().slice(0, 10) === date ? value : NaN;
}

export function getDutyRangeError({ fromDate, toDate }: DutyReportRange): string | null {
  if (!fromDate || !toDate) return 'Select both a from date and a to date.';
  const from = dateValue(fromDate);
  const to = dateValue(toDate);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 'Enter valid dates on or after 01 Jan 1900.';
  if (from > to) return 'The to date must be on or after the from date.';
  if ((to - from) / DAY_MS + 1 > MAX_DUTY_REPORT_DAYS) {
    return 'This range exceeds the Excel column limit. Please choose a shorter range.';
  }
  return null;
}

export function getDutyReportDays(range: DutyReportRange): DutyReportData['days'] {
  const error = getDutyRangeError(range);
  if (error) throw new Error(error);
  const days: DutyReportData['days'] = [];
  const end = dateValue(range.toDate);
  for (let value = dateValue(range.fromDate); value <= end; value += DAY_MS) {
    const date = new Date(value);
    days.push({ date: date.toISOString().slice(0, 10), weekday: WEEKDAYS[date.getUTCDay()], dayNum: date.getUTCDate() });
  }
  return days;
}

export function getDutyReportWeekStarts(range: DutyReportRange): string[] {
  const error = getDutyRangeError(range);
  if (error) throw new Error(error);
  const first = new Date(dateValue(range.fromDate));
  first.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7);
  const mondays: string[] = [];
  for (let value = first.getTime(); value <= dateValue(range.toDate); value += 7 * DAY_MS) {
    mondays.push(new Date(value).toISOString().slice(0, 10));
  }
  return mondays;
}

export function formatDutyDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

export function getDutyLabel(dutyType: string | null): string {
  const labels: Record<string, string> = {
    Delivery: 'Duty', Driver: 'Driver', Rest: 'Leave', Repair: 'Repair',
    Office: 'Office', OfficeDuty: 'Office Duty', Collection: 'Collection',
    WeeklyOff: 'Weekly Off', Off: 'Off',
  };
  return dutyType ? (Object.prototype.hasOwnProperty.call(labels, dutyType) ? labels[dutyType] : dutyType) : 'No Entry';
}

export function getDutyCountKey(cell: DutyReportCell, asOf: string): keyof DutyCounts {
  if (cell.date > asOf) return 'future';
  if (!cell.dutyType) return 'noEntry';
  if (cell.dutyType === 'Rest') return 'leave';
  if (cell.dutyType === 'Off') return 'off';
  if (cell.dutyType === 'WeeklyOff') return 'weeklyOff';
  return 'duty';
}

export function countDutyCells(cells: DutyReportCell[], asOf = todayStr()): DutyCounts {
  const counts: DutyCounts = { duty: 0, leave: 0, off: 0, weeklyOff: 0, noEntry: 0, future: 0 };
  for (const cell of cells) counts[getDutyCountKey(cell, asOf)] += 1;
  return counts;
}

export function filterDutyEmployees<T extends Pick<Employee, 'employeeName' | 'role'>>(
  employees: T[], roles: string[], search: string,
): T[] {
  const query = search.trim().toLocaleLowerCase();
  return employees.filter((employee) =>
    (!roles.length || roles.includes(employee.role)) &&
    (!query || employee.employeeName.toLocaleLowerCase().includes(query)),
  );
}

export function summarizeDutyReport(data: DutyReportData, employees: DutyReportEmployee[], asOf = todayStr()) {
  const byEmployee: Record<number, DutyCounts> = {};
  const totals = countDutyCells([], asOf);
  const dailyDuty: Record<string, number> = Object.fromEntries(data.days.map(({ date }) => [date, 0]));
  for (const employee of employees) {
    const cells = data.byEmployee[employee.id] ?? [];
    const counts = countDutyCells(cells, asOf);
    byEmployee[employee.id] = counts;
    for (const key of Object.keys(totals) as (keyof DutyCounts)[]) totals[key] += counts[key];
    for (const cell of cells) {
      if (getDutyCountKey(cell, asOf) === 'duty') dailyDuty[cell.date] += 1;
    }
  }
  return { byEmployee, totals, dailyDuty };
}

type DutyReportWeek = Pick<DutyPlannerWeek, 'weekStart' | 'employees' | 'assignments'>;

export function buildDutyReport(
  range: DutyReportRange, weeks: DutyReportWeek[], leaves: LeaveRequest[] = [], usingSampleData = false,
): DutyReportData {
  const days = getDutyReportDays(range);
  const employees = new Map<number, DutyReportEmployee>();
  const assignments = new Map<string, DutyAssignment>();
  for (const week of weeks) {
    for (const employee of week.employees) employees.set(employee.id, employee);
    for (const assignment of week.assignments) {
      if (assignment.date < range.fromDate || assignment.date > range.toDate) continue;
      assignments.set(`${assignment.employeeId}|${assignment.date}`, assignment);
      // Keep historical duties even if that employee is no longer on the
      // current roster. Do not invent a badge number for an unjoined record.
      if (!employees.has(assignment.employeeId)) {
        employees.set(assignment.employeeId, {
          id: assignment.employeeId, employeeName: assignment.employeeName,
          role: assignment.role, department: assignment.department,
        });
      }
    }
  }
  const approvedByEmployee = new Map<number, LeaveRequest[]>();
  for (const leave of leaves) {
    if (leave.status !== 'Approved' || leave.toDate < range.fromDate || leave.fromDate > range.toDate) continue;
    const approved = approvedByEmployee.get(leave.employeeId) ?? [];
    approved.push(leave);
    approvedByEmployee.set(leave.employeeId, approved);
  }
  const byEmployee: DutyReportData['byEmployee'] = {};
  for (const employee of employees.values()) {
    byEmployee[employee.id] = days.map(({ date }) => {
      const assignment = assignments.get(`${employee.id}|${date}`);
      const isLeave = (approvedByEmployee.get(employee.id) ?? []).some((leave) => leave.fromDate <= date && leave.toDate >= date);
      const assignedDutyType = assignment?.dutyType || null;
      return { date, dutyType: assignedDutyType ?? (isLeave ? 'Rest' : null), assignedDutyType, isLeave, vehicleNo: assignment?.vehicleNo ?? '' };
    });
  }
  return { ...range, days, employees: [...employees.values()], byEmployee, usingSampleData };
}

/** Read all approved leaves, not just the API's first page. */
export async function loadDutyReportLeaves(
  range: DutyReportRange,
  listPage: (filters: LeaveListFilters) => Promise<LeaveListResult>,
  signal?: AbortSignal,
): Promise<LeaveRequest[]> {
  const leaves: LeaveRequest[] = [];
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page += 1) {
    signal?.throwIfAborted();
    const result = await listPage({ ...range, status: 'Approved', page, limit: 200 });
    leaves.push(...result.items);
    totalPages = result.totalPages;
  }
  return leaves;
}

/** Fetch each intersecting week once, with bounded concurrency. Any failure
 * rejects the whole report, so an incomplete workbook is never downloaded. */
export async function loadDutyReportRange(range: DutyReportRange, source: {
  loadWeek: (weekStart: string) => Promise<DutyReportWeek>;
  loadLeaves: () => Promise<LeaveRequest[]>;
  usingSampleData: boolean;
}, signal?: AbortSignal): Promise<DutyReportData> {
  signal?.throwIfAborted();
  const mondays = getDutyReportWeekStarts(range);
  const loadWeeks = async () => {
    const weeks: DutyReportWeek[] = [];
    for (let i = 0; i < mondays.length; i += 4) {
      signal?.throwIfAborted();
      const batch = await Promise.all(mondays.slice(i, i + 4).map(async (monday) => {
        const week = await source.loadWeek(monday);
        if (week.weekStart !== monday) throw new Error(`Could not load duties for the week of ${monday}.`);
        return week;
      }));
      weeks.push(...batch);
    }
    return weeks;
  };
  const [weeks, leaves] = await Promise.all([loadWeeks(), source.loadLeaves()]);
  signal?.throwIfAborted();
  return buildDutyReport(range, weeks, leaves, source.usingSampleData);
}
