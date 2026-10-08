/**
 * Shops master — PostgreSQL ONLY via shared Axios helpers.
 * Static/mock arrays and localStorage are not used as a data source.
 */

import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  handleApiError,
} from "../../../../api";
import { notifyShopDataChanged } from "../../../../shared/events/shopDataEvents";
import type { Shop } from "../types/shop";

const SHOPS_PATH = "/masters/shops";

/** Legacy browser keys that previously held mock shop lists. */
const LEGACY_STORAGE_KEYS = [
  "masters_shops",
  "dmr-shops",
  "dmr_poultries_shops_master_data",
] as const;

/** Cache filled exclusively by GET /api/masters/shops. */
let shopsCache: Shop[] = [];

export type ShopInput = Omit<Shop, "id" | "shopNo" | "currentBalance"> & {
  shopNo?: number;
};

function clearLegacyShopStorage(): void {
  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore storage access errors */
  }
}

function normalizeStatus(status: unknown): Shop["status"] {
  return status === "Active" ? "Active" : "Inactive";
}

export function mapShop(raw: Record<string, unknown>): Shop {
  return {
    id: Number(raw.id),
    shopNo: Number(raw.shopNo ?? raw.shop_no ?? 0),
    shopNumber: String(raw.shopNumber ?? raw.shop_number ?? ""),
    shopName: String(raw.shopName ?? raw.shop_name ?? ""),
    ownerName: String(raw.ownerName ?? raw.owner_name ?? ""),
    phoneNumber: String(raw.phoneNumber ?? raw.phone_number ?? ""),
    secondaryPhoneNumber: String(
      raw.secondaryPhoneNumber ?? raw.secondary_phone_number ?? "",
    ),
    whatsappNumber: String(raw.whatsappNumber ?? raw.whatsapp_number ?? ""),
    email: String(raw.email ?? "").trim(),
    city: String(raw.city ?? ""),
    address: String(raw.address ?? ""),
    latitude: raw.latitude != null ? Number(raw.latitude) : undefined,
    longitude: raw.longitude != null ? Number(raw.longitude) : undefined,
    paperRate: Number(raw.paperRate ?? raw.paper_rate ?? 0),
    associationType: String(raw.associationType ?? raw.association_type ?? ""),
    status: normalizeStatus(raw.status),
    openingBalance: Number(raw.openingBalance ?? raw.opening_balance ?? 0),
    currentBalance:
      raw.currentBalance != null
        ? Number(raw.currentBalance)
        : raw.current_balance != null
          ? Number(raw.current_balance)
          : 0,
  };
}

function toPayload(input: ShopInput | Partial<Shop>): Record<string, unknown> {
  return {
    shopNo: input.shopNo,
    shopNumber: input.shopNumber?.trim(),
    shopName: input.shopName?.trim(),
    ownerName: input.ownerName?.trim() ?? "",
    phoneNumber: input.phoneNumber?.trim() ?? "",
    secondaryPhoneNumber: input.secondaryPhoneNumber?.trim() ?? "",
    whatsappNumber: input.whatsappNumber?.trim() ?? "",
    email: input.email?.trim() ?? "",
    city: input.city?.trim() ?? "",
    address: input.address?.trim() ?? "",
    latitude: input.latitude != null ? Number(input.latitude) : null,
    longitude: input.longitude != null ? Number(input.longitude) : null,
    paperRate: Number(input.paperRate ?? 0),
    associationType: input.associationType?.trim() ?? "",
    status: input.status ?? "Active",
    openingBalance: Number(input.openingBalance ?? 0),
  };
}

function setCacheFromApi(
  rows: Record<string, unknown>[] | null | undefined,
): Shop[] {
  shopsCache = Array.isArray(rows) ? rows.map(mapShop) : [];
  return shopsCache;
}

/** Sync snapshot for other modules — reflects last successful API load only. */
export function getShops(): Shop[] {
  return shopsCache;
}

/** Alias used by consumers that still call shopService.getAll(). */
export function getAll(): Shop[] {
  return getShops();
}

/** GET /api/masters/shops — sole source of truth for the Shops table. */
export async function loadShops(): Promise<Shop[]> {
  clearLegacyShopStorage();
  const { data } = await apiGet<Record<string, unknown>[]>(SHOPS_PATH);
  return setCacheFromApi(data);
}

/** POST /api/masters/shops */
export async function createShop(input: ShopInput): Promise<Shop> {
  clearLegacyShopStorage();
  const { data } = await apiPost<Record<string, unknown>>(
    SHOPS_PATH,
    toPayload(input),
  );
  const saved = mapShop(data);
  notifyShopDataChanged({ shopId: saved.id, shopName: saved.shopName, reason: "created", source: "shop-master" });
  return saved;
}

/** POST /api/masters/shops/bulk */
export async function createShopsBulk(inputs: ShopInput[]): Promise<Shop[]> {
  clearLegacyShopStorage();
  const { data } = await apiPost<{ created: Record<string, unknown>[] }>(
    `${SHOPS_PATH}/bulk`,
    inputs.map(toPayload),
  );
  return data.created.map(mapShop);
}

export async function updateShopOpeningBalancesBulk(
  inputs: Array<{ shopNumber: string; shopName: string; openingBalance: number }>,
): Promise<Shop[]> {
  clearLegacyShopStorage();
  const { data } = await apiPost<{ updated: Record<string, unknown>[] }>(
    `${SHOPS_PATH}/opening-balances/bulk`,
    inputs,
  );
  return data.updated.map(mapShop);
}

/** PUT /api/masters/shops/:id */
export async function updateShop(
  id: number,
  input: ShopInput | Partial<Shop>,
): Promise<Shop> {
  clearLegacyShopStorage();
  const { data } = await apiPut<Record<string, unknown>>(
    `${SHOPS_PATH}/${id}`,
    toPayload({ ...(input as ShopInput), shopNo: input.shopNo }),
  );
  const saved = mapShop(data);
  notifyShopDataChanged({ shopId: saved.id, shopName: saved.shopName, reason: "updated", source: "shop-master" });
  return saved;
}

/** DELETE /api/masters/shops/:id */
export async function deleteShop(id: number): Promise<void> {
  clearLegacyShopStorage();
  await apiDelete(`${SHOPS_PATH}/${id}`);
  notifyShopDataChanged({ shopId: id, reason: "deleted", source: "shop-master" });
}

/** Always re-fetch from PostgreSQL. */
export async function refreshShops(): Promise<Shop[]> {
  return loadShops();
}

/** POST /api/masters/resolve-location — resolve URL/address to coordinates. */
export type ResolvedLocation = {
  latitude: number;
  longitude: number;
  /** Full line to store on the shop: "<place>, <address>". */
  address: string | null;
  placeName?: string | null;
  fullAddress?: string | null;
  plusCode?: string | null;
  precision?: "pin" | "viewport" | "geocoded";
  mapsUrl?: string | null;
};

export async function resolveLocation(
  input: string,
): Promise<ResolvedLocation> {
  const { data } = await apiPost<ResolvedLocation>(
    "/masters/resolve-location",
    { input },
  );
  return data;
}

/** Compatibility object for modules that import `shopService.getAll()`. */
export const shopService = {
  getAll,
};

export { handleApiError };
