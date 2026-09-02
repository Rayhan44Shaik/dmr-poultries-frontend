// src/modules/operations/orders/ordersService.ts
// Orders module reference data + row-level operations.
//
// The three tabs read and write through the dedicated Orders backend module
// (`services/ordersApi.ts` → /api/orders), which owns every quantity rule,
// lock and status. This file only supplies the reference data the tables
// decorate rows with (Shop Master city / mobile, supervisor mobile) and the
// row actions that reuse the EXISTING trip services (delivery detail, PDF,
// WhatsApp) — no business logic, no parallel state.

import type { ShopDelivery, Trip } from "../../../shared/trip";
import { loadTripById } from "../vehicle-trips/services/tripHeaderApiService";
import { sendDeliveryWhatsApp } from "../vehicle-trips/services/deliveryWhatsAppService";
import { loadShops } from "../../masters/shops/services/shopService";
import { loadEmployees } from "../../masters/employees/services/employeeService";
import { buildOrdersTrip, rowsInSequence } from "./ordersUtils";
import type { OrdersTrip, ShopOrderQuantities } from "./types";
import type { OrderView } from "./services/ordersApi";

// ─── Reference data (shop city + mobile, supervisor mobiles) ────────────────

/**
 * Shop Master reference data per shop id. `city` is the Shop Master's CITY
 * column (the field formerly labelled "Village" in this workflow), `mobile`
 * is its registered phone number — never invented, empty when unset.
 */
export type ShopDirectory = Map<
  number,
  { shopName: string; city: string; mobile: string; ownerName: string }
>;
export type SupervisorDirectory = Map<string, string>; // name (lower) -> mobile

export async function loadShopDirectory(): Promise<ShopDirectory> {
  const shops = await loadShops().catch(() => []);
  const dir: ShopDirectory = new Map();
  for (const shop of shops) {
    dir.set(shop.id, {
      shopName: shop.shopName,
      city: shop.city,
      mobile: (shop.phoneNumber ?? "").trim(),
      ownerName: (shop.ownerName ?? "").trim(),
    });
  }
  return dir;
}

export async function loadSupervisorDirectory(): Promise<SupervisorDirectory> {
  const employees = await loadEmployees().catch(() => []);
  const dir: SupervisorDirectory = new Map();
  for (const emp of employees) {
    const name = emp.employeeName?.trim().toLowerCase();
    if (name && emp.phoneNumber) dir.set(name, emp.phoneNumber);
  }
  return dir;
}

export function supervisorMobileOf(trip: Trip, directory: SupervisorDirectory): string {
  const byId = directory.get(String(trip.supervisorId ?? ""));
  if (byId) return byId;
  return directory.get(trip.supervisorName?.trim().toLowerCase() ?? "") ?? "";
}

/** Shop CITY from the Shop Master (falls back to the shop name). */
export function cityOf(
  shopId: number,
  shopName: string,
  directory: ShopDirectory
): string {
  return directory.get(shopId)?.city ?? shopName ?? "";
}

/** Shop Mobile from the Shop Master only ("" when the master has none). */
export function shopMobileOf(shopId: number, directory: ShopDirectory): string {
  return directory.get(shopId)?.mobile ?? "";
}

/** Shop owner name from the Shop Master only ("" when the master has none). */
export function shopOwnerOf(shopId: number, directory: ShopDirectory): string {
  return directory.get(shopId)?.ownerName ?? "";
}

// ─── Trip-level detail (Delivery Tracking "View" / PDF / WhatsApp) ──────────

/**
 * Loads ONE trip and enriches it with the ORDERED quantities the Orders
 * backend holds, so the delivery detail sheet and the PDF compare the real
 * order against the real Step 4 capture. The order rows come from the
 * backend listing — never from a cached frontend copy.
 */
export async function loadOrdersTrip(tripId: number, orders: OrderView[]): Promise<OrdersTrip> {
  const trip = await loadTripById(tripId);
  const quantities: ShopOrderQuantities = new Map();
  for (const order of orders) {
    if (!order.assignments.some((a) => a.tripId === tripId)) continue;
    quantities.set(order.shopId, {
      boxes: order.requiredBoxes,
      birds: order.birds,
      weight: 0,
    });
  }
  return buildOrdersTrip(trip, quantities.size > 0 ? quantities : undefined);
}

// ─── WhatsApp — existing per-delivery mechanism, order-level usage ──────────

export type OrdersWhatsAppResult = {
  enabled: boolean;
  sent: number;
  failed: number;
  skipped: number;
  message?: string;
};

/**
 * Sends the order/assignment to the supervisor through the EXISTING
 * per-delivery WhatsApp service — the same mechanism Step 4 / Trip View use.
 * Sequential, so progress stays visible and one failure never stops the rest.
 *
 * NOTE: this is the row action inside Delivery Tracking. The AUTOMATIC
 * supervisor notification on Finish Assignment is fired by the BACKEND
 * (POST /orders/assignments with finish=true) — never from the browser.
 */
export async function sendOrdersWhatsApp(
  trip: Trip,
  supervisorMobile: string,
  onProgress?: (sent: number, total: number, shopName: string) => void
): Promise<OrdersWhatsAppResult> {
  const rows = rowsInSequence(trip).filter((r) => r.shopId > 0);
  if (rows.length === 0) {
    return { enabled: true, sent: 0, failed: 0, skipped: 0, message: "no_rows" };
  }

  const result: OrdersWhatsAppResult = { enabled: true, sent: 0, failed: 0, skipped: 0 };
  let sent = 0;
  for (const row of rows) {
    onProgress?.(sent, rows.length, row.shopName || "Shop");
    const outcome = await sendDeliveryWhatsApp({
      trip,
      delivery: { ...row, autoCaptureTime: row.autoCaptureTime } as ShopDelivery,
      shopWhatsApp: supervisorMobile || null,
    }).catch((error: unknown) => ({
      success: false,
      status: "failed" as const,
      message: error instanceof Error ? error.message : undefined,
    }));
    if (outcome.success) {
      result.sent += 1;
      sent += 1;
    } else {
      result.failed += 1;
      if (!result.message) result.message = outcome.message;
    }
  }
  onProgress?.(sent, rows.length, "");
  return result;
}
