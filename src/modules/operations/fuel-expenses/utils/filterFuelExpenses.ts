import type { FuelExpense, FuelSortKey, FuelUiStatus } from "../types/fuelExpense";

export type FuelQuickTab = "ALL" | "PENDING" | "APPROVED" | "DELETED";

export interface FuelClientFilters {
  fromDate?: string;
  toDate?: string;
  vehicleId?: number;
  vehicleNo?: string;
  driverId?: number;
  driverName?: string;
  sourceType?: string;
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

/**
 * Ensures unique fuel expense records (no duplicates on trip diesel records).
 */
export function uniqueFuelExpenses(expenses: readonly FuelExpense[]): FuelExpense[] {
  const seenIds = new Set<string>();
  const seenTripNos = new Set<string>();
  return expenses.filter((item) => {
    if (!item || !item.id || seenIds.has(String(item.id))) return false;
    seenIds.add(String(item.id));
    if (item.tripNo && item.sourceType === "TRIP") {
      if (seenTripNos.has(item.tripNo)) return false;
      seenTripNos.add(item.tripNo);
    }
    return true;
  });
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
    quickTab = "ALL",
    search = "",
  }: FuelClientFilters
): FuelExpense[] {
  const from = dateOnly(fromDate);
  const to = dateOnly(toDate);

  return bills.filter((bill) => {
    const isDeleted = bill.deleted === true || bill.status === "Deleted";
    const isTrip = bill.sourceType === "TRIP" || !!bill.tripNo;
    const effectiveStatus: FuelUiStatus = isDeleted ? "Deleted" : isTrip ? "Approved" : bill.status;

    const billDate = dateOnly(bill.date);
    if ((from && (!billDate || billDate < from)) || (to && (!billDate || billDate > to))) return false;

    if (vehicleId != null && Number(bill.vehicleId) !== vehicleId) return false;
    if (vehicleNo && vehicleNo !== "All Vehicles" && bill.vehicleNo !== vehicleNo) return false;

    if (driverId != null && Number(bill.driverId) !== driverId) return false;
    if (driverName && driverName !== "All Drivers" && bill.driverName !== driverName) return false;

    // Quick tab filtering:
    if (quickTab === "DELETED") {
      if (!isDeleted) return false;
    } else {
      // Active tabs (ALL, PENDING, APPROVED) exclude deleted rows
      if (isDeleted) return false;
      if (quickTab === "PENDING" && (isTrip || effectiveStatus !== "Pending")) return false;
      if (quickTab === "APPROVED" && effectiveStatus !== "Approved") return false;
    }

    // Dropdown filters (if explicit)
    if (sourceType && sourceType !== "All" && (isTrip ? "TRIP" : "MANUAL") !== sourceType) return false;

    return matchesGlobalSearch(bill, search);
  });
}

function compareBillsNewestFirst(left: FuelExpense, right: FuelExpense): number {
  const byDate = String(right.date ?? "").localeCompare(String(left.date ?? ""));
  if (byDate !== 0) return byDate;
  const leftNum = Number(left.id);
  const rightNum = Number(right.id);
  if (Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum !== rightNum) {
    return rightNum - leftNum;
  }
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
