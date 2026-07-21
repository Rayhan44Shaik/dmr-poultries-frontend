// src/modules/masters/employees/services/employeeService.ts

import { initialEmployees } from "../data/employees";
import type { Employee } from "../types/employee";

const STORAGE_KEY = "dmr-employees";

export function getEmployees(): Employee[] {
  const data = localStorage.getItem(STORAGE_KEY);

  // If nothing is stored yet, initialize with the default list
  if (!data) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(initialEmployees)
    );
    return initialEmployees;
  }

  try {
    const storedEmployees: Employee[] = JSON.parse(data);

    // --- SCALABILITY SYNC MECHANISM ---
    // Check if any new employees were added to initialEmployees file
    // that don't exist in localStorage yet (matched by 'id').
    const storedIds = new Set(storedEmployees.map(emp => emp.id));
    const newEmployees = initialEmployees.filter(emp => !storedIds.has(emp.id));

    if (newEmployees.length > 0) {
      // Automatically merge new default rows while keeping existing data intact
      const updatedEmployees = [...storedEmployees, ...newEmployees];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEmployees));
      return updatedEmployees;
    }

    return storedEmployees;
  } catch (error) {
    // Fallback safety if localStorage JSON gets corrupted
    console.error("Failed to parse employees from localStorage, resetting to defaults.", error);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialEmployees));
    return initialEmployees;
  }
}

export function saveEmployees(
  employees: Employee[]
): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(employees)
  );
}