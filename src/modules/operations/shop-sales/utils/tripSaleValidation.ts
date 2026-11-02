export type TripSaleValidationRow = {
  id?: number;
  shopId: number;
  birds: number;
  weight: number;
  mortality: number;
  mortalityWeight: number;
  deliveryMode: "box" | "weight";
  rate: number;
};

export function isValidTripSaleRow(row: TripSaleValidationRow): boolean {
  const isExistingRemoval = row.id != null
    && row.birds === 0 && row.weight === 0
    && row.mortality === 0 && row.mortalityWeight === 0;
  if (isExistingRemoval) return true;
  return row.shopId > 0
    && Number.isSafeInteger(row.birds) && row.birds >= 0
    && Number.isSafeInteger(row.mortality) && row.mortality >= 0
    && Number.isFinite(row.weight) && row.weight >= 0
    && Number.isFinite(row.mortalityWeight) && row.mortalityWeight >= 0
    && row.birds + row.mortality > 0
    && (row.birds === 0 || row.weight > 0)
    && (row.weight === 0 || row.birds > 0)
    && (row.deliveryMode !== "box" || row.mortality === 0 || row.mortalityWeight > 0)
    && row.rate >= 50 && row.rate <= 300;
}

export function dcAccountedWeight(row: Pick<TripSaleValidationRow, "weight" | "mortalityWeight" | "deliveryMode">): number {
  return row.weight + (row.deliveryMode === "box" ? row.mortalityWeight : 0);
}
