import { useEffect, useState } from "react";

import type { Employee } from "../types/employee";

import {
  getEmployees,
  saveEmployees as persistEmployees,
} from "../services/employeeService";

export function useEmployees() {

  const [employees, setEmployees] =
    useState<Employee[]>([]);

  useEffect(() => {

    setEmployees(getEmployees());

  }, []);

  const saveEmployees = (
    data: Employee[]
  ) => {

    setEmployees(data);

    persistEmployees(data);

  };

  return {

    employees,

    saveEmployees,

  };

}