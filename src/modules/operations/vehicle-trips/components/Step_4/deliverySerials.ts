import type { ShopDelivery } from "../../types/trip";

/** A contiguous sequence for captured rows only; shop names are not identity. */
export function deliveryDisplaySerials(rows: ShopDelivery[]): Map<number, number> {
  const captured = rows
    .filter((row) => Number(row.shopId) > 0 && Number(row.birds) > 0 && Number(row.weight) > 0)
    .map((row, sourceIndex) => ({ row, sourceIndex }))
    .sort((a, b) => {
      const aTime = Date.parse(String(a.row.autoCaptureTime ?? ""));
      const bTime = Date.parse(String(b.row.autoCaptureTime ?? ""));
      const aHasTime = Number.isFinite(aTime);
      const bHasTime = Number.isFinite(bTime);
      if (aHasTime && bHasTime && aTime !== bTime) return aTime - bTime;
      if (aHasTime !== bHasTime) return aHasTime ? -1 : 1;
      const serialDelta = Number(a.row.serialNo || 0) - Number(b.row.serialNo || 0);
      if (serialDelta !== 0) return serialDelta;
      const idDelta = Number(a.row.id || 0) - Number(b.row.id || 0);
      return idDelta !== 0 ? idDelta : a.sourceIndex - b.sourceIndex;
    });

  return new Map(captured.map(({ row }, index) => [Number(row.id), index + 1]));
}

/** Newest/highest corrected serial first: N, N-1, ... 1. */
export function compareDeliveryDisplayOrder(
  serials: ReadonlyMap<number, number>,
  a: ShopDelivery,
  b: ShopDelivery,
): number {
  return (
    (serials.get(Number(b.id)) ?? 0) - (serials.get(Number(a.id)) ?? 0) ||
    Number(b.id) - Number(a.id)
  );
}
