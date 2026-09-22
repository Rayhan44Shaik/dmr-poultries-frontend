import type { Trip } from "../types/trip";

export function tripExpenseTotals(trip: Trip) {
  const record = trip as unknown as Record<string, unknown>;
  const general = ["pickupTolls", "deliveryTolls", "destinationTolls", "meals", "loading", "mealsTiffin", "vehicleMaintenance", "driverBata", "helperBata", "othersRC", "others1Amt", "others2Amt", "others3Amt", "others4Amt", "others5Amt", "expense"]
    .reduce((sum, key) => sum + Number(record[key] || 0), 0);
  const dieselRows = (trip.dieselEntries ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? Number(row.litres || 0) * Number(row.rate || 0)), 0
  );
  const diesel = dieselRows > 0 ? dieselRows : Number(trip.fuel || 0);
  const savedTotal = Number(record.totalTripExpense || 0);
  const resolvedGeneral = general > 0 ? general : Math.max(0, savedTotal - diesel);
  return { diesel, general: resolvedGeneral, total: diesel + resolvedGeneral };
}
