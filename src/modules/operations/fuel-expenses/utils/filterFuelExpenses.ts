import type { FuelExpense, FuelSortKey, FuelSourceType, FuelUiStatus } from "../types/fuelExpense";

export type FuelQuickTab = "ALL" | "PENDING" | "APPROVED" | "TRIP" | "MANUAL";

export interface FuelClientFilters {
  fromDate?: string;
  toDate?: string;
  vehicleId?: number;
  vehicleNo?: string;
  driverId?: number;
  driverName?: string;
  supervisorId?: number;
  supervisorName?: string;
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
    bill.supervisorName,
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
    supervisorId,
    supervisorName,
    sourceType,
    status,
    quickTab = "ALL",
    search = "",
  }: FuelClientFilters
): FuelExpense[] {
  const from = dateOnly(fromDate);
  const to = dateOnly(toDate);

  return bills.filter((bill) => {
    const billDate = dateOnly(bill.date);
    if ((from && (!billDate || billDate < from)) || (to && (!billDate || billDate > to))) return false;

    if (vehicleId != null && Number(bill.vehicleId) !== vehicleId) return false;
    if (vehicleNo && vehicleNo !== "All Vehicles" && bill.vehicleNo !== vehicleNo) return false;

    if (driverId != null && Number(bill.driverId) !== driverId) return false;
    if (driverName && driverName !== "All Drivers" && bill.driverName !== driverName) return false;

    if (supervisorId != null && Number(bill.supervisorId) !== supervisorId) return false;
    if (supervisorName && supervisorName !== "All Supervisors" && bill.supervisorName !== supervisorName) return false;

    // Quick tab filtering
    if (quickTab === "PENDING" && bill.status !== "Pending") return false;
    if (quickTab === "APPROVED" && bill.status !== "Approved") return false;
    if (quickTab === "TRIP" && bill.sourceType !== "TRIP") return false;
    if (quickTab === "MANUAL" && bill.sourceType !== "MANUAL") return false;

    // Dropdown filters (if explicit)
    if (sourceType && sourceType !== "All" && bill.sourceType !== (sourceType as FuelSourceType)) return false;
    if (status && status !== "All" && bill.status !== (status as FuelUiStatus)) return false;

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
