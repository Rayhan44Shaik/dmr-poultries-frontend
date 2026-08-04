// D:\Development\DMR-Poultries-ERP\frontend\dmr-poultries-web\src\modules\masters\shops\hooks\useShops.ts

import { useState, useCallback, useEffect } from "react";
import type { Shop } from "../types/shop";
import { shopService } from "../services/shopService";

export function useShops() {
  const [shops, setShops] = useState<Shop[]>([]);

  const refreshShops = useCallback(() => {
    const data = shopService.getAll();
    setShops(data);
  }, []);

  useEffect(() => {
    refreshShops();
  }, [refreshShops]);

  const saveShops = useCallback((updatedList: Shop[]) => {
    shopService.saveAll(updatedList);
    setShops(updatedList);
  }, []);

  const addOrUpdateShop = useCallback((shopData: Omit<Shop, "id" | "shopNo"> & { id?: number }) => {
    const updatedList = shopService.saveShop(shopData);
    setShops(updatedList);
  }, []);

  const deleteShop = useCallback((id: number) => {
    const updatedList = shopService.deleteShop(id);
    setShops(updatedList);
  }, []);

  return {
    shops,
    saveShops,
    addOrUpdateShop,
    deleteShop,
    refreshShops,
  };
}