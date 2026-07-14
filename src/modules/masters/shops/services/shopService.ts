import type { Shop } from "../types/shop";
import { initialShops } from "../data/shops";

const STORAGE_KEY = "dmr_shops";

export const shopService = {
  getAll(): Shop[] {
    const data = localStorage.getItem(STORAGE_KEY);

    if (!data) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(initialShops)
      );
      return initialShops;
    }

    return JSON.parse(data);
  },

  saveAll(shops: Shop[]) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(shops)
    );
  },
};