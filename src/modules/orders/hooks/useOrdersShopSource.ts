// Orders always reads the live Shop Master. Test fixtures live in tests only;
// production must never fall back to bundled business rows.
import { useShops } from "../../masters/shops/hooks/useShops";

export const useOrdersShopSource = useShops;
