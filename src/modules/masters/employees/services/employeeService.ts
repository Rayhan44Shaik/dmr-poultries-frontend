import { initialEmployees } from "../data/employees";
import type { Employee } from "../types/employee";

const STORAGE_KEY = "dmr-employees";

export function getEmployees(): Employee[] {

  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(initialEmployees)
    );

    return initialEmployees;
  }

  return JSON.parse(data);

}

export function saveEmployees(
  employees: Employee[]
) {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(employees)
  );

}