import { useEffect, useState } from "react";

import type { Shop } from "../types/shop";
import { shopService } from "../services/shopService";

export function useShops() {
  const [shops, setShops] = useState<Shop[]>([]);

  useEffect(() => {
    setShops(shopService.getAll());
  }, []);

  const saveShops = (newShops: Shop[]) => {
    setShops(newShops);
    shopService.saveAll(newShops);
  };

  return {
    shops,
    saveShops,
  };
}