import type { FuelExpense, FuelSortKey, FuelUiStatus } from "../types/fuelExpense";

export type FuelQuickTab = "ALL" | "PENDING" | "APPROVED" | "TRIP" | "MANUAL";

export interface FuelClientFilters {
  fromDate?: string;
  toDate?: string;
  vehicleId?: number;
  vehicleNo?: string;
  driverId?: number;
  driverName?: string;
  sourceType?: string;
  status?: string;
  quickTab?: FuelQuickTab;
  search?: string;
}

const dateOnly = (value: string | undefined) => (value || "").slice(0, 10);
const compact = (value: string) => value.toLocaleLowerCase().replace(/[\s-]/g, "");

function matchesGlobalSearch(bill: FuelExpense, search: string): boolean {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return true;

  const values = [
    bill.billNo,
    bill.date,
    bill.tripNo,
    bill.vehicleNo,
    bill.driverName,
    bill.petrolBunk,
    bill.sourceType,
    bill.status,
    bill.remarks,
    bill.meterReading,
    bill.litres,
    bill.rate,
    bill.amount,
  ].map((v) => String(v ?? ""));

  const haystack = values.join(" ").toLocaleLowerCase();
  return haystack.includes(query) || compact(haystack).includes(compact(query));
}

export function filterFuelExpenses(
  bills: readonly FuelExpense[],
  {
    fromDate,
    toDate,
    vehicleId,
    vehicleNo,
    driverId,
    driverName,
    sourceType,
    status,
    quickTab = "ALL",
    search = "",
  }: FuelClientFilters
): FuelExpense[] {
  const from = dateOnly(fromDate);
  const to = dateOnly(toDate);

  return bills.filter((bill) => {
    const isTrip = bill.sourceType === "TRIP" || !!bill.tripNo;
    const effectiveStatus: FuelUiStatus = isTrip ? "Approved" : bill.status;

    const billDate = dateOnly(bill.date);
    if ((from && (!billDate || billDate < from)) || (to && (!billDate || billDate > to))) return false;

    if (vehicleId != null && Number(bill.vehicleId) !== vehicleId) return false;
    if (vehicleNo && vehicleNo !== "All Vehicles" && bill.vehicleNo !== vehicleNo) return false;

    if (driverId != null && Number(bill.driverId) !== driverId) return false;
    if (driverName && driverName !== "All Drivers" && bill.driverName !== driverName) return false;

    // Quick tab filtering: ONLY manual bills can ever be pending!
    if (quickTab === "PENDING" && (isTrip || effectiveStatus !== "Pending")) return false;
    if (quickTab === "APPROVED" && effectiveStatus !== "Approved") return false;
    if (quickTab === "TRIP" && !isTrip) return false;
    if (quickTab === "MANUAL" && isTrip) return false;

    // Dropdown filters (if explicit)
    if (sourceType && sourceType !== "All" && (isTrip ? "TRIP" : "MANUAL") !== sourceType) return false;
    if (status && status !== "All" && effectiveStatus !== status) return false;

    return matchesGlobalSearch(bill, search);
  });
}

function compareBillsNewestFirst(left: FuelExpense, right: FuelExpense): number {
  const byDate = String(right.date ?? "").localeCompare(String(left.date ?? ""));
  if (byDate !== 0) return byDate;
  return String(right.billNo ?? "").localeCompare(String(left.billNo ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortFuelExpenses(
  bills: readonly FuelExpense[],
  sortBy: FuelSortKey | null | undefined,
  sortDir: "asc" | "desc" = "asc"
): FuelExpense[] {
  if (!sortBy) return [...bills].sort(compareBillsNewestFirst);

  const direction = sortDir === "desc" ? -1 : 1;
  const numericKeys = new Set<FuelSortKey>([
    "meterReading",
    "litres",
    "rate",
    "amount",
  ]);

  const stringValue = (b: FuelExpense) => String(b[sortBy] ?? "");

  return [...bills].sort((left, right) => {
    const comparison = numericKeys.has(sortBy)
      ? Number(left[sortBy] ?? 0) - Number(right[sortBy] ?? 0)
      : stringValue(left).localeCompare(stringValue(right), undefined, { numeric: true, sensitivity: "base" });

    if (comparison !== 0) return comparison * direction;
    return String(left.billNo).localeCompare(String(right.billNo), undefined, { numeric: true }) * direction;
  });
}
