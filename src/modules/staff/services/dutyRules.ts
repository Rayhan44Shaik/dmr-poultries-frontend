import type { DutyAssignment, Employee, LeaveRequest } from '../types/staffDashboard';
import type { DutyPlannerWeek, UpsertAssignmentInput } from './dutyPlannerService';

export const DUTY_CORE_ROLES = ['Supervisor', 'Driver', 'Helper', 'Loader'] as const;
export type DutyEmployeeIdentity = Pick<Employee, 'id' | 'employeeName' | 'role' | 'department'> & Partial<Pick<Employee, 'status' | 'joiningDate' | 'employeeNo' | 'employeeNameTe'>>;

const normalize = (value: string) => value.trim().toLowerCase().replace(/[\u200b-\u200d\ufeff]/g, '').replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ');
const CORE_ALIASES: Record<string, string[]> = {
  Supervisor: ['supervisor', 'supervisors', 'సూపర్వైజర్', 'సూపర్ వైజర్'],
  Driver: ['driver', 'drivers', 'డ్రైవర్'],
  Helper: ['helper', 'helpers', 'సహాయకుడు', 'హెల్పర్'],
  Loader: ['loader', 'loaders', 'లోడర్'],
};

export function getCoreDutyRole(role: string): string | null {
  const normalized = normalize(role);
  for (const [canonical, aliases] of Object.entries(CORE_ALIASES)) {
    if (aliases.some((alias) => normalized === alias || normalized.split(' ').includes(alias))) return canonical;
  }
  return null;
}
export function isManualDutyRole(role: string): boolean { return getCoreDutyRole(role) !== null; }
export function isCollectionEmployee(employee: Pick<Employee, 'role' | 'department'>): boolean {
  if (isManualDutyRole(employee.role)) return false;
  return [employee.role, employee.department].some((value) => /collect|కలెక్టర్|వసూలు|వసూళ్లు/.test(normalize(value)));
}

/** Defaults fill missing entries only. Core crew stay manual; existing duties
 * remain intact. Approved leave is applied above these defaults by the resolver. */
export function getAutomaticDuty(employee: DutyEmployeeIdentity, date: string): string | null {
  if (isManualDutyRole(employee.role)) return null;
  if (employee.status && employee.status !== 'Active') return null;
  // Do not invent automatic attendance for an orphan historical assignment.
  if (employee.status == null && employee.employeeNo == null) return null;
  const joiningDate = employee.joiningDate?.slice(0, 10);
  if (joiningDate && /^\d{4}-\d{2}-\d{2}$/.test(joiningDate) && date < joiningDate) return null;
  const calendarDate = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== date) return null;
  const day = calendarDate.getUTCDay();
  if (day === 0) return 'WeeklyOff';
  return isCollectionEmployee(employee) ? 'Collection' : 'Office';
}

export function hasApprovedDutyLeave(leaves: LeaveRequest[], employeeId: number, date: string): boolean {
  return leaves.some((leave) => leave.status === 'Approved' && leave.employeeId === employeeId && leave.fromDate.slice(0, 10) <= date && leave.toDate.slice(0, 10) >= date);
}

export function resolveDutyCell(employee: DutyEmployeeIdentity, date: string, assignment: DutyAssignment | undefined, isLeave: boolean) {
  const assignedDutyType = assignment?.dutyType || null;
  const automaticType = assignedDutyType ? null : getAutomaticDuty(employee, date);
  return {
    date,
    dutyType: isLeave ? 'Rest' : assignedDutyType ?? automaticType,
    assignedDutyType,
    isLeave,
    automatic: !isLeave && !assignedDutyType && automaticType !== null,
    vehicleNo: assignment?.vehicleNo ?? '',
  };
}

export function getDutyPickerTypes(employee: Pick<Employee, 'role' | 'department'>): string[] {
  const core = getCoreDutyRole(employee.role);
  if (core === 'Supervisor') return ['Delivery', 'Office', 'Rest', 'WeeklyOff', 'Off'];
  if (core) return ['Delivery', 'Repair', 'Office', 'Rest', 'WeeklyOff', 'Off'];
  return isCollectionEmployee(employee)
    ? ['Collection', 'Office', 'Rest', 'WeeklyOff', 'Off']
    : ['Office', 'Rest', 'WeeklyOff', 'Off'];
}

export function getAutomaticDutyWrites(week: DutyPlannerWeek, leaves: LeaveRequest[], throughDate: string): UpsertAssignmentInput[] {
  const assigned = new Set(week.assignments.filter((entry) => !!entry.dutyType).map((entry) => `${entry.employeeId}|${entry.date}`));
  return week.employees.flatMap((employee) => week.days.flatMap(({ date }) => {
    if (date < week.weekStart || date > week.weekEnd || date > throughDate || assigned.has(`${employee.id}|${date}`) || hasApprovedDutyLeave(leaves, employee.id, date)) return [];
    const dutyType = getAutomaticDuty(employee, date);
    return dutyType ? [{ employeeId: employee.id, date, dutyType }] : [];
  }));
}

export class AutomaticDutySyncError extends Error {
  readonly week: DutyPlannerWeek;
  constructor(week: DutyPlannerWeek, options: { cause: unknown }) {
    super('Automatic duties could not be saved. Please retry.');
    this.name = 'AutomaticDutySyncError';
    this.week = week;
    // Kept for diagnostics; the UI shows a localized, non-sensitive message.
    Object.defineProperty(this, 'cause', { value: options.cause });
  }
}

/** Persist defaults through the normal assignment API, never a replace-all plan.
 * Call only for an editable week after its previous week is closed. Sequential
 * replies are authoritative snapshots; do not overwrite entries arriving in a
 * newer snapshot, and never continue after a lock, failure or cancelled load. */
export async function syncAutomaticDuties(
  initial: DutyPlannerWeek, leaves: LeaveRequest[], throughDate: string,
  save: (input: UpsertAssignmentInput) => Promise<DutyPlannerWeek>, signal?: AbortSignal,
): Promise<DutyPlannerWeek> {
  let week = initial;
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week.weekStart) || !/^\d{4}-\d{2}-\d{2}$/.test(week.weekEnd) || week.weekEnd < week.weekStart) throw new Error('Invalid duty week range');
    for (const input of getAutomaticDutyWrites(initial, leaves, throughDate)) {
      signal?.throwIfAborted();
      if (!['Open', 'Draft', ''].includes(week.status)) break;
      if (week.assignments.some((entry) => entry.employeeId === input.employeeId && entry.date === input.date && entry.dutyType)) continue;
      const updated = await save(input);
      if (updated.weekStart !== initial.weekStart) throw new Error('Invalid duty week response');
      if (!updated.assignments.some((entry) => entry.employeeId === input.employeeId && entry.date === input.date && entry.dutyType)) throw new Error('Automatic duty was not saved');
      week = updated;
    }
    signal?.throwIfAborted();
    return week;
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new AutomaticDutySyncError(week, { cause });
  }
}
