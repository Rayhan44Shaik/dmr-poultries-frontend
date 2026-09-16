import { useCallback, useEffect } from "react";
import { useMasterRecords, type MasterQuery } from "../../hooks/useMasterRecords";
import { onShopDataChanged } from "../../../../shared/events/shopDataEvents";
import { createShop, updateShop, deleteShop, loadShops, mapShop, type ShopInput, createShopsBulk } from "../services/shopService";
const config = { path: "/masters/shops", load: loadShops, map: mapShop };
export function useShops(options?: MasterQuery) {
  const state = useMasterRecords(config, options);
  const { mutate, reload } = state;
  const addShop = useCallback((input: ShopInput) => mutate(() => createShop(input)), [mutate]);
  const editShop = useCallback((id: number, input: ShopInput) => mutate(() => updateShop(id, input)), [mutate]);
  const removeShop = useCallback((id: number) => mutate(() => deleteShop(id)), [mutate]);
  const addShopsBulk = useCallback((inputs: ShopInput[]) => mutate(() => createShopsBulk(inputs)), [mutate]);

  /**
   * A collection being approved or deleted moves `shops.current_balance` on the
   * server. The Shops master shows that figure, so it re-reads the register the
   * moment another screen changes it — no manual refresh, no stale balance.
   */
  useEffect(() => onShopDataChanged(() => { void reload().catch(() => {}); }), [reload]);

  return { ...state, shops: state.rows, addShop, editShop, removeShop, addShopsBulk, refreshShops: reload };
}
