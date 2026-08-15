/**
 * Shop Sales — PostgreSQL via shared Axios helpers. PostgreSQL (not
 * localStorage) is the single source of truth: a trip/delivery is only
 * ever "in Shop Sales" here because the backend's eligibility query
 * (rate_entry.locked = TRUE) says so.
 *
 * GET    /operations/shop-sales        -> eligible sales (Rate Entry locked, not soft-deleted)
 * PUT    /operations/shop-sales/:id    -> edit birds/weight/mortality/remarks/birdType only
 *                                          (rate/amount/shopId/shopName/tripId are backend-immutable
 *                                          once locked — see updateShopSale's diffing contract)
 * DELETE /operations/shop-sales/:id    -> soft-delete (kept for completeness; the existing Shop
 *                                          Sales table has no delete button today, so this is not
 *                                          currently invoked by any UI element)
 *
 * This is a NEW file — the existing (localStorage-backed) frontend
 * `services/shopSalesService.ts` is deliberately left untouched, because
 * it is also imported by the Reports module's Shop Ledger page
 * (`modules/reports/pages/ShopLedgerPage.tsx`), which is out of scope for
 * this phase. Only `useShopSales.ts` (the actual Shop Sales page hook)
 * is repointed at this file.
 */
import { apiDelete, apiGet, apiPut } from "../../../../api";
import type { ShopSale } from "../types/shopSale";

const SHOP_SALES_PATH = "/operations/shop-sales";

/** Raw shape returned by GET/PUT /operations/shop-sales (backend ShopSale, camelCase). */
interface ApiShopSale {
  id: number;
  saleNo: string;
  saleDate: string;
  shopId: number | null;
  shopName: string;
  birdTypeId: number | null;
  birdType: string;
  tripId: number | null;
  tripNo: string;
  vehicleNo: string | null;
  farmName: string | null;
  birds: number;
  weight: number;
  rate: number;
  amount: number;
  mortality: number;
  remarks: string;
  status: string;
  deleted: boolean;
  deletedReason: string | null;
  tripDeleted: boolean;
  editable: boolean;
  windowExpiresAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Maps one backend ShopSale row onto the existing frontend ShopSale
 * shape — every field the existing components already read (totalBirds,
 * totalWeight, remark, etc.) keeps its exact name and type; the real
 * numeric ids/lock state are carried alongside additively. */
function mapApiSaleToShopSale(row: ApiShopSale): ShopSale {
  return {
    id: String(row.id),
    tripId: row.tripId == null ? "" : String(row.tripId),
    tripNo: row.tripNo,
    tripDate: row.saleDate,
    shopId: row.shopId == null ? "" : String(row.shopId),
    shopName: row.shopName,
    birdType: row.birdType,
    totalBirds: num(row.birds),
    totalWeight: num(row.weight),
    rate: row.rate,
    amount: num(row.amount),
    remark: row.remarks,
    status: row.status === "Approved" ? "Completed" : "Pending",
    numericId: row.id,
    numericTripId: row.tripId,
    numericShopId: row.shopId,
    mortality: num(row.mortality),
    birdTypeId: row.birdTypeId,
    editable: row.editable,
    windowExpiresAt: row.windowExpiresAt,
  };
}

/** GET /operations/shop-sales — only trips whose Rate Entry is locked are
 * ever returned (backend-enforced eligibility; never re-derived here).
 * fromDate/toDate are sent to the backend (real filtering); shop-name text
 * search and sort order stay client-side in the hook, same as before. */
export async function listShopSales(filters: {
  fromDate?: string;
  toDate?: string;
} = {}): Promise<ShopSale[]> {
  const params: Record<string, string> = {};
  if (filters.fromDate) params.fromDate = filters.fromDate;
  if (filters.toDate) params.toDate = filters.toDate;
  const { data } = await apiGet<ApiShopSale[]>(SHOP_SALES_PATH, { params });
  return data.map(mapApiSaleToShopSale);
}

export interface ShopSalePatch {
  birds?: number;
  weight?: number;
  mortality?: number;
  remarks?: string;
  birdTypeId?: number | null;
  birdType?: string;
  /** Only ever included when the caller genuinely intends to attempt a
   * change to a locked field — the backend will reject it with 409. Never
   * sent just because the row happens to still carry its old value. */
  rate?: number;
  shopId?: number;
  shopName?: string;
  tripId?: number;
}

/** PUT /operations/shop-sales/:id */
export async function updateShopSale(id: number, patch: ShopSalePatch): Promise<ShopSale> {
  const { data } = await apiPut<ApiShopSale>(`${SHOP_SALES_PATH}/${id}`, patch);
  return mapApiSaleToShopSale(data);
}

/** DELETE /operations/shop-sales/:id — soft-delete. Not currently wired to
 * any UI control (the existing table has no delete button), provided for
 * completeness/future use. */
export async function deleteShopSale(id: number): Promise<void> {
  await apiDelete(`${SHOP_SALES_PATH}/${id}`);
}
