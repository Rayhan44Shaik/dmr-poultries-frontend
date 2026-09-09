import { useCallback } from "react";
import { useMasterRecords, type MasterQuery } from "../../hooks/useMasterRecords";
import { createEmployee, updateEmployee, deleteEmployee, loadEmployees, mapEmployee, type EmployeeInput, bulkCreateEmployees } from "../services/employeeService";
const config = { path: "/masters/employees", load: loadEmployees, map: mapEmployee };
export function useEmployees(options?: MasterQuery) {
  const state = useMasterRecords(config, options);
  const { mutate } = state;
  const addEmployee = useCallback((input: EmployeeInput) => mutate(() => createEmployee(input)), [mutate]);
  const editEmployee = useCallback((id: number, input: EmployeeInput) => mutate(() => updateEmployee(id, input)), [mutate]);
  const removeEmployee = useCallback((id: number) => mutate(() => deleteEmployee(id)), [mutate]);
  const addEmployeesBulk = useCallback((inputs: EmployeeInput[]) => mutate(() => bulkCreateEmployees(inputs)), [mutate]);
  return { ...state, employees: state.rows, addEmployee, editEmployee, removeEmployee, addEmployeesBulk };
}
