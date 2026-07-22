// D:\Development\DMR-Poultries-ERP\frontend\dmr-poultries-web\src\modules\masters\shops\services\shopService.ts

import type { Shop } from "../types/shop";
import { initialShops } from "../data/shops";
import { StorageWrapper } from "../../../../storage/storageWrapper";

const STORAGE_KEY = "masters_shops";

export const shopService = {
  getAll(): Shop[] {
    const data = StorageWrapper.get<Shop[]>(STORAGE_KEY);

    if (!data || data.length === 0) {
      StorageWrapper.set(STORAGE_KEY, initialShops);
      return initialShops;
    }

    return data;
  },

  saveAll(shops: Shop[]) {
    StorageWrapper.set(STORAGE_KEY, shops);
  },

  saveShop(shopData: Omit<Shop, "id" | "shopNo"> & { id?: number }): Shop[] {
    const shops = this.getAll();
    let updated: Shop[];

    if (shopData.id) {
      updated = shops.map((s) => (s.id === shopData.id ? ({ ...s, ...shopData } as Shop) : s));
    } else {
      const nextId = shops.length > 0 ? Math.max(...shops.map((s) => s.id)) + 1 : 1;
      const newShop: Shop = {
        ...shopData,
        id: nextId,
        shopNo: nextId,
      };
      updated = [...shops, newShop];
    }

    this.saveAll(updated);
    return updated;
  },

  deleteShop(id: number): Shop[] {
    const shops = this.getAll();
    const updated = shops.filter((s) => s.id !== id);
    this.saveAll(updated);
    return updated;
  }
};