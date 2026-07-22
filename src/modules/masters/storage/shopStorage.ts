// D:\Development\DMR-Poultries-ERP\frontend\dmr-poultries-web\src\modules\masters\storage\shopStorage.ts

import { logAuditEvent } from "../../../utils/securityUtils";
import { StorageWrapper } from "../../../storage/storageWrapper";

const SHOP_STORAGE_KEY = "dmr_poultries_shops_master_data";

export interface Shop {
  id: number;
  shopNo: number;
  shopName: string;
  ownerName: string;
  village: string;
  phoneNumber: string;
  status: "Active" | "Inactive";
}

/**
 * Retrieves all stored shop records from offline browser storage using StorageWrapper.
 */
export function getStoredShops(): Shop[] {
  try {
    const data = StorageWrapper.get<Shop[]>(SHOP_STORAGE_KEY);
    return data || [];
  } catch (error) {
    console.error("Failed to parse shops from storage:", error);
    return [];
  }
}

/**
 * Persists the entire list of shop records into offline browser storage securely using StorageWrapper.
 */
export function persistShops(shops: Shop[]): void {
  try {
    StorageWrapper.set(SHOP_STORAGE_KEY, shops);
  } catch (error) {
    console.error("Failed to save shops to storage:", error);
  }
}

/**
 * Saves a single shop (creates a new entry or updates an existing record).
 */
export function saveShopRecord(shopData: Omit<Shop, "id" | "shopNo">, existingId?: number): Shop[] {
  const currentShops = getStoredShops();
  let updatedShops: Shop[];

  if (existingId) {
    updatedShops = currentShops.map((shop) =>
      shop.id === existingId ? { ...shop, ...shopData } : shop
    );
    logAuditEvent("UPDATE_SHOP_OFFLINE", "Shops", existingId);
  } else {
    const newShop: Shop = {
      id: Date.now(),
      shopNo: currentShops.length + 1,
      ...shopData,
    };
    updatedShops = [...currentShops, newShop];
    logAuditEvent("CREATE_SHOP_OFFLINE", "Shops", newShop.id);
  }

  persistShops(updatedShops);
  return updatedShops;
}

/**
 * Deletes a shop record by its unique identifier and re-sequences shop serial numbers.
 */
export function deleteShopRecord(id: number): Shop[] {
  const currentShops = getStoredShops();
  const filtered = currentShops.filter((shop) => shop.id !== id);
  
  // Re-index shopNo sequentially
  const resequenced = filtered.map((shop, index) => ({
    ...shop,
    shopNo: index + 1,
  }));

  persistShops(resequenced);
  logAuditEvent("DELETE_SHOP_OFFLINE", "Shops", id);
  return resequenced;
}