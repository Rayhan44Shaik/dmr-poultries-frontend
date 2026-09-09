import { useCallback } from "react";
import { useMasterRecords, type MasterQuery } from "../../hooks/useMasterRecords";
import { createShop, updateShop, deleteShop, loadShops, mapShop, type ShopInput, createShopsBulk } from "../services/shopService";
const config = { path: "/masters/shops", load: loadShops, map: mapShop };
export function useShops(options?: MasterQuery) {
  const state = useMasterRecords(config, options);
  const { mutate } = state;
  const addShop = useCallback((input: ShopInput) => mutate(() => createShop(input)), [mutate]);
  const editShop = useCallback((id: number, input: ShopInput) => mutate(() => updateShop(id, input)), [mutate]);
  const removeShop = useCallback((id: number) => mutate(() => deleteShop(id)), [mutate]);
  const addShopsBulk = useCallback((inputs: ShopInput[]) => mutate(() => createShopsBulk(inputs)), [mutate]);
  return { ...state, shops: state.rows, addShop, editShop, removeShop, addShopsBulk, refreshShops: state.reload };
}
