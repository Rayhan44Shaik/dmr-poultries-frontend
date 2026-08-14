// src/modules/operations/shop-sales/services/shopSalesApiService.ts
//
// Real PostgreSQL-backed API client for /api/operations/shop-sales.
// Replaces the previous localStorage-only shopSalesService/completedTripService,
// which read "shopSales"/"vehicleTrips" keys the real Trip List never wrote to.

import { apiDelete, apiGet, apiPut } from "../../../../api";
import type { ShopSale, ShopSaleFilters, ShopSaleUpdateInput } from "../types/shopSale";

const BASE = "/operations/shop-sales";

function toQuery(filters: ShopSaleFilters = {}): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.shopId) params.shopId = String(filters.shopId);
  if (filters.fromDate) params.fromDate = filters.fromDate;
  if (filters.toDate) params.toDate = filters.toDate;
  if (filters.status) params.status = filters.status;
  if (filters.includeDeleted) params.includeDeleted = "true";
  return params;
}

/** Shop-level sales, sourced from trip_deliveries + trips in PostgreSQL. */
async function listShopSales(filters: ShopSaleFilters = {}): Promise<ShopSale[]> {
  const result = await apiGet<ShopSale[]>(BASE, { params: toQuery(filters) });
  return Array.isArray(result.data) ? result.data : [];
}

/** Edits the same trip_deliveries row in place. Shop is immutable; amount is
 * always server-computed (weight × rate) — never send it. Backend rejects
 * the edit (409) once the trip's 10-day edit window has closed. */
async function updateShopSale(id: number, patch: ShopSaleUpdateInput): Promise<ShopSale> {
  const result = await apiPut<ShopSale, ShopSaleUpdateInput>(`${BASE}/${id}`, patch);
  return result.data;
}

/** Soft-deletes the sale (birds/weight/rate/amount are preserved for the
 * historical record). Allowed only within the 10-day edit window. */
async function deleteShopSale(id: number, reason?: string): Promise<{ id: number }> {
  const result = await apiDelete<{ id: number }>(`${BASE}/${id}`, {
    params: reason ? { reason } : undefined,
  });
  return result.data;
}

export const shopSalesApiService = {
  listShopSales,
  updateShopSale,
  deleteShopSale,
};
