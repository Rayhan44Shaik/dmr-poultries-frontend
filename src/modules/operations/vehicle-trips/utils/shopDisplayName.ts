export function cleanDeliveryShopName(name: string | null | undefined): string {
  const raw = String(name ?? "").trim();
  if (!raw) return "";
  return raw.replace(/\s+\d{3}$/, "").trim();
}
