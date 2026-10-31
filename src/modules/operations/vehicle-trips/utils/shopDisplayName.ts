export function cleanDeliveryShopName(name: string | null | undefined): string {
  const raw = String(name ?? "").trim();
  if (!raw) return "";
  return raw.replace(/\s+\d{3}$/, "").trim();
}

/** Shop Sales / Rate Entry identity: `RAGHAVA POULTRIES -- SHIVA`. */
export function formatShopWithSubShop(
  shopName?: string | null,
  subShopName?: string | null,
): string {
  const shop = cleanDeliveryShopName(shopName);
  const sub = String(subShopName ?? "").trim();
  if (shop && sub) return `${shop} -- ${sub}`;
  return shop || sub;
}
