import type { DutyAssignment, Employee, LeaveRequest } from '../../src/modules/staff/types/staffDashboard';
import type { DutyPlannerWeek } from '../../src/modules/staff/services/dutyPlannerService';
import { getDutyReportDays } from '../../src/modules/staff/services/dutyReport';

export const TEST_TODAY = '2026-09-07';
export const TEST_EMPLOYEES: Employee[] = [
  { id: 1, employeeNo: 101, employeeName: 'Ravi Kumar', employeeNameTe: 'రవి కుమార్', role: 'Driver', department: 'Fleet' },
  { id: 2, employeeNo: 102, employeeName: 'Lakshmi Devi', employeeNameTe: 'లక్ష్మి దేవి', role: 'Supervisor', department: 'Operations' },
  { id: 3, employeeNo: 103, employeeName: 'Anil Accounts', employeeNameTe: 'అనిల్ అకౌంట్స్', role: 'Accountant', department: 'Accounts' },
  { id: 4, employeeNo: 104, employeeName: 'Mohan Helper', employeeNameTe: 'మోహన్ హెల్పర్', role: 'Helper', department: 'Farm' },
].map((employee) => ({ ...employee, status: 'Active', salary: 0, phoneNumber: '', email: '', joiningDate: '2020-01-01' }));

export function testAssignment(employeeId: number, date: string, dutyType: string): DutyAssignment {
  const employee = TEST_EMPLOYEES.find((e) => e.id === employeeId)!;
  return {
    id: `${employeeId}-${date}`, employeeId, date, dutyType,
    employeeName: employee.employeeName, role: employee.role, department: employee.department,
    vehicleNo: employee.role === 'Driver' ? 'AP 16 AB 1234' : undefined,
  };
}

export function testLeave(employeeId: number, fromDate: string, toDate = fromDate, status: LeaveRequest['status'] = 'Approved'): LeaveRequest {
  return {
    id: `leave-${employeeId}-${fromDate}-${status}`, employeeId,
    employeeName: TEST_EMPLOYEES.find((e) => e.id === employeeId)!.employeeName,
    fromDate, toDate, days: 1, status, type: 'Casual', createdAt: fromDate,
  };
}

export const TEST_LEAVES = [testLeave(2, '2026-09-01', '2026-09-02')];

export function testWeek(weekStart: string, overrides: Partial<DutyPlannerWeek> = {}): DutyPlannerWeek {
  const end = new Date(`${weekStart}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  const weekEnd = end.toISOString().slice(0, 10);
  const days = getDutyReportDays({ fromDate: weekStart, toDate: weekEnd });
  const types = ['Delivery', 'Rest', 'Off', 'WeeklyOff', 'Repair', 'OfficeDuty', 'Farm Visit — Vijayawada'];
  const assignments = days.flatMap(({ date }, index) => [
    testAssignment(1, date, types[index]),
    ...(index === 1 ? [] : [testAssignment(2, date, 'Delivery')]),
    testAssignment(3, date, 'Collection'),
  ]);
  return {
    weekStart, weekEnd, days, employees: TEST_EMPLOYEES, assignments,
    allRoles: [...new Set(TEST_EMPLOYEES.map((e) => e.role))],
    status: weekStart < TEST_TODAY ? 'Closed' : 'Open',
    saturday: { required: 0, assigned: 0, shortage: 0, status: '', requiredByRole: {}, assignedByRole: {}, availableByRole: {} },
    validation: { ok: true, problems: [] },
    ...overrides,
  };
}
