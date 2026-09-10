// src/modules/staff/hooks/useStaffDirectory.ts
//
// ============================================================================
// STAFF DIRECTORY HOOK — real employee list for the performance filter dropdown
// ============================================================================
// Feeds the Driver / Supervisor selector with the EXISTING real data source
// (GET /api/masters/employees via `employeeService.loadEmployees`), filtered to
// the requested department. No sample names, no localStorage.
//
// REQUEST HYGIENE
//   • One load per mount; identical concurrent loads share a single request
//     (module-level in-flight dedupe — StrictMode double-mount safe).
//   • 5-minute session cache, so navigating away and back does not re-fetch.
//   • Options are de-duplicated by id and sorted by name for a stable order.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { handleApiError, isCanceledError } from "../../../api/errors";
import {
  loadEmployees,
} from "../../masters/employees/services/employeeService";
import type { Employee } from "../../masters/employees/types/employee";

export interface StaffPersonOption {
  id: number;
  name: string;
  status: Employee["status"];
}

const DIRECTORY_TTL_MS = 5 * 60_000;
let directoryCache: { value: Employee[]; expiresAt: number } | null = null;
let directoryInflight: Promise<Employee[]> | null = null;

function sharedLoadEmployees(): Promise<Employee[]> {
  if (directoryCache && Date.now() <= directoryCache.expiresAt) {
    return Promise.resolve(directoryCache.value);
  }
  if (directoryInflight) return directoryInflight;
  directoryInflight = loadEmployees()
    .then((employees) => {
      directoryCache = { value: employees, expiresAt: Date.now() + DIRECTORY_TTL_MS };
      return employees;
    })
    .finally(() => {
      directoryInflight = null;
    });
  return directoryInflight;
}

export type StaffDirectoryDepartment = "Driver" | "Supervisor";

export function useStaffDirectory(department: StaffDirectoryDepartment) {
  // Warm-cache start: seed from the module snapshot synchronously (no request,
  // no effect-state cascade). A stale snapshot still seeds the list and is
  // silently revalidated by the effect below — stale-while-revalidate.
  const seeded = directoryCache?.value;
  const [options, setOptions] = useState<StaffPersonOption[]>(() =>
    seeded ? toOptions(seeded, department) : [],
  );
  const [loading, setLoading] = useState(!seeded);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const loadGen = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Initial + department load. Every state update happens inside the async
  // callbacks — the effect body itself never calls setState synchronously.
  // `sharedLoadEmployees` dedupes concurrent loads and serves a fresh cache,
  // so StrictMode's double-mount cannot duplicate the request either.
  useEffect(() => {
    const gen = ++loadGen.current;
    void sharedLoadEmployees()
      .then((employees) => {
        if (!mounted.current || gen !== loadGen.current) return;
        setOptions(toOptions(employees, department));
        setError(null);
      })
      .catch((cause) => {
        if (!mounted.current || isCanceledError(cause) || gen !== loadGen.current) return;
        setError(handleApiError(cause));
      })
      .finally(() => {
        if (!mounted.current || gen !== loadGen.current) return;
        setLoading(false);
      });
  }, [department]);

  /** Force a refetch (user-initiated — allowed to set state synchronously). */
  const reload = useCallback(() => {
    directoryCache = null;
    const gen = ++loadGen.current;
    setLoading(true);
    void sharedLoadEmployees()
      .then((employees) => {
        if (!mounted.current || gen !== loadGen.current) return;
        setOptions(toOptions(employees, department));
        setError(null);
      })
      .catch((cause) => {
        if (!mounted.current || isCanceledError(cause) || gen !== loadGen.current) return;
        setError(handleApiError(cause));
      })
      .finally(() => {
        if (!mounted.current || gen !== loadGen.current) return;
        setLoading(false);
      });
  }, [department]);

  return { options, loading, error, reload };
}

function toOptions(employees: Employee[], department: StaffDirectoryDepartment): StaffPersonOption[] {
  const seen = new Set<number>();
  return employees
    .filter((employee) => employee.department === department)
    .filter((employee) => {
      // Never duplicate an option for the same employee id.
      if (seen.has(employee.id)) return false;
      seen.add(employee.id);
      return true;
    })
    .sort((a, b) =>
      a.employeeName.localeCompare(b.employeeName, undefined, {
        sensitivity: "accent",
        numeric: true,
      }),
    )
    .map((employee) => ({
      id: employee.id,
      name: employee.employeeName,
      status: employee.status,
    }));
}
