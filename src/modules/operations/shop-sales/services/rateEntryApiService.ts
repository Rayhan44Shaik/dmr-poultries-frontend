// src/modules/operations/shop-sales/services/rateEntryApiService.ts
//
// Real PostgreSQL-backed API client for /api/operations/rate-entry.
// Replaces the previous localStorage-only completedTripService, which read
// a "vehicleTrips" key the real Trip List never wrote to — the reason
// completed trips never showed up here.

import { apiGet, apiPost, apiPut } from "../../../../api";
import type {
  RateEntryFilters,
  RateEntryInput,
  RateEntryRecord,
  RateEntryTripRow,
  RateEntryUpdateInput,
} from "../types/rateEntry";

const BASE = "/operations/rate-entry";

function toQuery(filters: RateEntryFilters = {}): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.search) params.search = filters.search;
  if (filters.rateStatus && filters.rateStatus !== "ALL") params.rateStatus = filters.rateStatus;
  if (filters.fromDate) params.fromDate = filters.fromDate;
  if (filters.toDate) params.toDate = filters.toDate;
  if (filters.vehicleNo) params.vehicleNo = filters.vehicleNo;
  if (filters.supervisorName) params.supervisorName = filters.supervisorName;
  return params;
}

/** Trips eligible for Rate Entry — status = Completed, not deleted —
 * each with its rate status/value if already entered. Source of truth is
 * PostgreSQL via the trips + rate_entry tables; no localStorage involved. */
async function getEligibleTrips(filters: RateEntryFilters = {}): Promise<RateEntryTripRow[]> {
  const result = await apiGet<RateEntryTripRow[]>(BASE, { params: toQuery(filters) });
  return Array.isArray(result.data) ? result.data : [];
}

/** Create-only. Backend rejects (409) a second create for the same trip —
 * use updateRate() to modify an already-entered rate. */
async function createRate(input: RateEntryInput): Promise<RateEntryRecord> {
  const result = await apiPost<RateEntryRecord, RateEntryInput>(BASE, input);
  return result.data;
}

/** Edits the existing rate_entry row in place (same id, same trip_id). */
async function updateRate(id: number, patch: RateEntryUpdateInput): Promise<RateEntryRecord> {
  const result = await apiPut<RateEntryRecord, RateEntryUpdateInput>(`${BASE}/${id}`, patch);
  return result.data;
}

export const rateEntryApiService = {
  getEligibleTrips,
  createRate,
  updateRate,
};
