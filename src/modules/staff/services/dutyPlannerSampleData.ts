import type { Employee } from '../types/staffDashboard';
import { buildSampleDutyWeek } from './staffSampleData';

// Duty Planner-only examples for the automatic office/collection rules.
// Do not alter the shared sample roster used by Salary Register or other pages.
const OFFICE_EXAMPLES: Employee[] = [
  { id: 15, employeeNo: 115, employeeName: 'Lakshmi Rao', role: 'Accountant', department: 'Accounts', status: 'Active', joiningDate: '2020-01-01', phoneNumber: '', email: '', salary: 0 },
  { id: 16, employeeNo: 116, employeeName: 'Sai Kumar', role: 'Collector', department: 'Collection', status: 'Active', joiningDate: '2020-01-01', phoneNumber: '', email: '', salary: 0 },
];

export function buildDutyPlannerSampleWeek(weekStart: string) {
  const week = buildSampleDutyWeek(weekStart);
  return { ...week, employees: [...week.employees, ...OFFICE_EXAMPLES], allRoles: [...new Set([...week.allRoles, ...OFFICE_EXAMPLES.map((employee) => employee.role)])] };
}
