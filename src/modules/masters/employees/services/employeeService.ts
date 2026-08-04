// src/modules/masters/employees/services/employeeService.ts
/**
 * Employees master — PostgreSQL via the shared Axios API foundation.
 * No localStorage in this module.
 */

import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  handleApiError,
} from "../../../../api";
import type { Employee } from "../types/employee";

const EMPLOYEES_PATH = "/masters/employees";

/** In-memory cache so legacy sync callers (other modules) keep working. */
let employeesCache: Employee[] = [];

export type EmployeeInput = Omit<Employee, "id" | "employeeNo"> & {
  employeeNo?: number;
};

function normalizeDate(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return "";
}

function normalizeStatus(status: unknown): Employee["status"] {
  return status === "Active" ? "Active" : "Inactive";
}

function mapEmployee(raw: Record<string, unknown>): Employee {
  return {
    id: Number(raw.id),
    employeeNo: Number(raw.employeeNo ?? raw.employee_no ?? 0),
    employeeName: String(raw.employeeName ?? raw.employee_name ?? ""),
    department: String(raw.department ?? ""),
    role: String(raw.role ?? ""),
    phoneNumber: String(raw.phoneNumber ?? raw.phone_number ?? ""),
    email: String(raw.email ?? ""),
    address: String(raw.address ?? ""),
    joiningDate: normalizeDate(
      (raw.joiningDate ?? raw.joining_date) as string | null | undefined
    ),
    aadharNumber: raw.aadharNumber
      ? String(raw.aadharNumber)
      : raw.aadhar_number
        ? String(raw.aadhar_number)
        : undefined,
    licenseNumber: raw.licenseNumber
      ? String(raw.licenseNumber)
      : raw.license_number
        ? String(raw.license_number)
        : undefined,
    salary: Number(raw.salary ?? 0),
    status: normalizeStatus(raw.status),
  };
}

function toPayload(input: EmployeeInput | Partial<Employee>): Record<string, unknown> {
  return {
    employeeNo: input.employeeNo,
    employeeName: input.employeeName?.trim(),
    department: input.department,
    role: input.role?.trim() ?? "",
    phoneNumber: input.phoneNumber?.trim() ?? "",
    email: input.email?.trim() ?? "",
    address: input.address?.trim() ?? "",
    joiningDate: input.joiningDate ? normalizeDate(input.joiningDate) || null : null,
    aadharNumber: input.aadharNumber?.trim() || null,
    licenseNumber: input.licenseNumber?.trim() || null,
    salary: Number(input.salary ?? 0),
    status: input.status ?? "Active",
  };
}

/** Sync snapshot for other modules — does not hit the network. */
export function getEmployees(): Employee[] {
  return employeesCache;
}

/**
 * @deprecated Prefer createEmployee / updateEmployee / deleteEmployee.
 * Kept so other modules that still call saveEmployees() do not break at import time.
 */
export function saveEmployees(employees: Employee[]): void {
  employeesCache = employees;
}

/** GET /api/masters/employees */
export async function loadEmployees(department?: string): Promise<Employee[]> {
  const { data } = await apiGet<Record<string, unknown>[]>(EMPLOYEES_PATH, {
    params: department ? { department } : undefined,
  });
  employeesCache = (data ?? []).map(mapEmployee);
  return employeesCache;
}

/** POST /api/masters/employees */
export async function createEmployee(input: EmployeeInput): Promise<Employee> {
  const { data } = await apiPost<Record<string, unknown>>(
    EMPLOYEES_PATH,
    toPayload(input)
  );
  const created = mapEmployee(data);
  employeesCache = [...employeesCache, created].sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName)
  );
  return created;
}

/** PUT /api/masters/employees/:id */
export async function updateEmployee(
  id: number,
  input: EmployeeInput | Partial<Employee>
): Promise<Employee> {
  const { data } = await apiPut<Record<string, unknown>>(
    `${EMPLOYEES_PATH}/${id}`,
    toPayload({ ...(input as EmployeeInput), employeeNo: input.employeeNo })
  );
  const updated = mapEmployee(data);
  employeesCache = employeesCache.map((e) => (e.id === id ? updated : e));
  return updated;
}

/** DELETE /api/masters/employees/:id */
export async function deleteEmployee(id: number): Promise<void> {
  await apiDelete(`${EMPLOYEES_PATH}/${id}`);
  employeesCache = employeesCache.filter((e) => e.id !== id);
}

/** Re-fetch list from PostgreSQL after mutations. */
export async function refreshEmployees(): Promise<Employee[]> {
  return loadEmployees();
}

export { handleApiError };
