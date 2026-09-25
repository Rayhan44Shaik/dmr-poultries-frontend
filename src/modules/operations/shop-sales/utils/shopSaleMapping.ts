// src/modules/operations/shop-sales/utils/shopSaleMapping.ts
// Pure mapper between the backend Shop Sale row (camelCase, PostgreSQL) and
// the frontend ShopSale shape. No axios/React imports — unit-testable with
// node:test. The backend response is authoritative: saleNo (the Shop Sales
// number, e.g. TR-20260820-001-S01) and the editability/lock fields are
// mapped verbatim and never re-derived.

import type { ShopSale } from "../types/shopSale";

/** Raw shape returned by GET/PUT /operations/shop-sales (backend ShopSale, camelCase). */
export interface ApiShopSale {
  id: number;
  saleNo: string;
  saleDate: string;
  /** Original per-shop Step 4 delivery capture timestamp. */
  deliveryTime?: string | null;
  shopId: number | null;
  shopName: string;
  subShopName?: string;
  birdTypeId: number | null;
  birdType: string;
  tripId: number | null;
  tripNo: string;
  shopNo?: string;
  vehicleNo: string | null;
  farmName: string | null;
  birds: number;
  weight: number;
  rate: number;
  amount: number;
  mortality: number;
  /** Server-computed trip-wide bird validation facts for Shop Sales editing. */
  tripPickupBirds?: number | null;
  maxEditableBirds?: number | null;
  tripDeliveredBirds?: number | null;
  tripMortalityBirds?: number | null;
  unassignedBirds?: number | null;
  assignmentComplete?: boolean | null;
  assignmentLockTripId?: number | null;
  assignmentLockTripNo?: string | null;
  assignmentLockUnassignedBirds?: number | null;
  remarks: string;
  status: string;
  deleted: boolean;
  deletedReason: string | null;
  tripDeleted: boolean;
  editable: boolean;
  lockReason?: string | null;
  windowExpiresAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** Backend-authoritative Rate Entry lock / 10-day correction state. */
  rateCompleted?: boolean;
  rateLockedAt?: string | null;
  rateLockedBy?: string | null;
  correctionWindowExpired?: boolean;
  correctionWindowClosesAt?: string | null;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Hide Step 4's internal order-tracking token and keep the operator's note. */
export function displayStep4Remark(value: unknown): string {
  return String(value ?? "")
    .replace(/\[ORDER\]\s*O:[^\s|]+/gi, "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" | ");
}

/** Maps one backend ShopSale row onto the existing frontend ShopSale shape —
 * every field the components read (totalBirds, totalWeight, remark, etc.)
 * keeps its exact name and type; the real numeric ids, the Shop Sales
 * number and lock state are carried alongside additively. */
export function mapApiSaleToShopSale(row: ApiShopSale): ShopSale {
  return {
    id: String(row.id),
    saleNo: row.saleNo ?? "",
    tripId: row.tripId == null ? "" : String(row.tripId),
    tripNo: row.tripNo,
    tripDate: row.saleDate,
    deliveryTime: row.deliveryTime ?? null,
    shopId: row.shopId == null ? "" : String(row.shopId),
    shopNo: row.shopNo ?? "",
    shopName: row.shopName,
    subShopName: row.subShopName?.trim() || undefined,
    birdType: row.birdType,
    totalBirds: num(row.birds),
    totalWeight: num(row.weight),
    rate: row.rate,
    amount: num(row.amount),
    remark: displayStep4Remark(row.remarks),
    status: row.status === "Approved" ? "Completed" : "Pending",
    numericId: row.id,
    numericTripId: row.tripId,
    numericShopId: row.shopId,
    mortality: num(row.mortality),
    tripPickupBirds: row.tripPickupBirds ?? null,
    maxEditableBirds: row.maxEditableBirds ?? null,
    tripDeliveredBirds: row.tripDeliveredBirds ?? null,
    tripMortalityBirds: row.tripMortalityBirds ?? null,
    unassignedBirds: row.unassignedBirds ?? null,
    assignmentComplete: row.assignmentComplete ?? null,
    assignmentLockTripId: row.assignmentLockTripId ?? null,
    assignmentLockTripNo: row.assignmentLockTripNo ?? null,
    assignmentLockUnassignedBirds: row.assignmentLockUnassignedBirds ?? null,
    birdTypeId: row.birdTypeId,
    editable: row.editable,
    windowExpiresAt: row.windowExpiresAt,
    tripDeleted: row.tripDeleted,
    lockReason: row.lockReason ?? null,
    rateCompleted: row.rateCompleted,
    rateLockedAt: row.rateLockedAt,
    rateLockedBy: row.rateLockedBy,
    correctionWindowExpired: row.correctionWindowExpired,
    correctionWindowClosesAt: row.correctionWindowClosesAt,
  };
}
