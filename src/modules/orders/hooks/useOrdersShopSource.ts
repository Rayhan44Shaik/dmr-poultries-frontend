// Which shop list feeds the Orders pages.
//
// The module can run on its bundled sample rows (`ORDERS_SAMPLE_DATA_ENABLED`)
// or against the real shops master. The flag is a module constant, so exactly
// one of these two hooks is ever mounted for the life of the app and the hook
// order inside the workspace stays stable.
import { useShops } from "../../masters/shops/hooks/useShops";
import type { Shop } from "../../masters/shops/types/shop";
import { ORDERS_SAMPLE_DATA_ENABLED, sampleShopRecords } from "../services/sampleOrdersData";

/** Sample mode never touches the network — the shop list is the bundled master. */
function useSampleShops(): { shops: Shop[]; loading: boolean } {
  return { shops: sampleShopRecords(), loading: false };
}

export const useOrdersShopSource = ORDERS_SAMPLE_DATA_ENABLED ? useSampleShops : useShops;
