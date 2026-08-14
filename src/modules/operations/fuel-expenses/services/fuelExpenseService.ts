// src/modules/operations/fuel-expenses/services/fuelExpenseService.ts
//
// Real PostgreSQL-backed API client for /api/operations/fuel-expenses.
// Replaces the previous localStorage-only implementation, which is why
// Trip Step 5 fuel never appeared here even though the backend was already
// syncing it into the fuel_expenses table.

import { apiDelete, apiGet, apiPatch, apiPost, apiPut, handleApiError } from "../../../../api";
import type { FuelExpense, FuelExpenseFilters, FuelExpenseInput } from "../types/fuelExpense";

const BASE = "/operations/fuel-expenses";

function toQuery(filters: FuelExpenseFilters = {}): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (filters.fromDate) params.fromDate = filters.fromDate;
  if (filters.toDate) params.toDate = filters.toDate;
  if (filters.vehicleId) params.vehicleId = filters.vehicleId;
  if (filters.driverId) params.driverId = filters.driverId;
  if (filters.sourceType && filters.sourceType !== "ALL") params.sourceType = filters.sourceType;
  if (filters.status && filters.status !== "ALL") params.status = filters.status;
  if (filters.search) params.search = filters.search;
  return params;
}

async function getAll(filters: FuelExpenseFilters = {}): Promise<FuelExpense[]> {
  const result = await apiGet<FuelExpense[]>(BASE, { params: toQuery(filters) });
  return Array.isArray(result.data) ? result.data : [];
}

async function getById(id: string): Promise<FuelExpense | null> {
  try {
    const result = await apiGet<FuelExpense>(`${BASE}/${id}`);
    return result.data;
  } catch (error) {
    handleApiError(error);
    return null;
  }
}

async function create(payload: FuelExpenseInput): Promise<FuelExpense> {
  const result = await apiPost<FuelExpense, FuelExpenseInput>(BASE, payload);
  return result.data;
}

async function update(id: string, payload: Partial<FuelExpenseInput>): Promise<FuelExpense> {
  const result = await apiPut<FuelExpense, Partial<FuelExpenseInput>>(`${BASE}/${id}`, payload);
  return result.data;
}

async function approve(id: string, approvedBy?: string): Promise<FuelExpense> {
  const result = await apiPost<FuelExpense>(`${BASE}/${id}/approve`, { approvedBy });
  return result.data;
}

async function reject(id: string, reason: string, rejectedBy?: string): Promise<FuelExpense> {
  const result = await apiPost<FuelExpense>(`${BASE}/${id}/reject`, { reason, rejectedBy });
  return result.data;
}

async function remove(id: string, reason?: string): Promise<void> {
  await apiDelete(`${BASE}/${id}`, { params: reason ? { reason } : undefined });
}

// Backed by the universal vehicle meter validator (backend/src/utils/vehicleMeterLedger.ts)
// via GET /api/fleet/vehicles/:vehicleId/latest-meter — the vehicle's latest
// accepted reading across Trips, Fuel, AND Maintenance, not just this
// vehicle's own approved fuel bills. This is a hint only; the backend is
// still the source of truth and rejects an out-of-order reading on submit
// regardless of what this returns.
async function getLatestMeterReading(vehicleId: number): Promise<number> {
  try {
    const result = await apiGet<{ meter: number } | null>(
      `/fleet/vehicles/${vehicleId}/latest-meter`
    );
    return result.data?.meter ?? 0;
  } catch (error) {
    handleApiError(error);
    return 0;
  }
}

// Deprecated no-op kept only so anything still importing apiPatch-based
// status changes fails loudly instead of silently hitting a removed route.
async function updateStatus(): Promise<never> {
  throw new Error("fuelExpenseService.updateStatus is removed — use approve()/reject() instead.");
}

export const fuelExpenseService = {
  getAll,
  getById,
  create,
  update,
  approve,
  reject,
  remove,
  getLatestMeterReading,
  updateStatus,
};
