import type { FuelExpense, FuelSortKey } from "../types/fuelExpense";

export type FuelQuickTab = "ALL" | "PENDING" | "APPROVED" | "DELETED";

export interface FuelClientFilters {
  fromDate?: string;
  toDate?: string;
  vehicleId?: number;
  vehicleNo?: string;
  driverId?: number;
  driverName?: string;
  petrolBunk?: string;
  masterBunkNames?: readonly string[];
  includeMasterBunks?: boolean;
  sourceType?: string;
  quickTab?: FuelQuickTab;
  search?: string;
  /** Keep soft-deleted rows in the result so a downstream quick-tab filter
   * (e.g. the Deleted register tab) can still see them. Active tabs exclude
   * deleted rows unless this is set. */
  includeDeleted?: boolean;
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

/** Ensures unique fuel expense records (deduplicated by record id and bill number).
 * Allows multiple distinct fuel bills per trip (e.g. multi-fill trips).
 */
export function uniqueFuelExpenses(expenses: readonly FuelExpense[]): FuelExpense[] {
  const seenIds = new Set<string>();
  const seenBillNos = new Set<string>();
  return expenses.filter((item) => {
    if (!item || !item.id || seenIds.has(String(item.id))) return false;
    seenIds.add(String(item.id));
    if (item.billNo) {
      const key = String(item.billNo).trim().toUpperCase();
      if (seenBillNos.has(key)) return false;
      seenBillNos.add(key);
    }
    return true;
  });
}

/** Returns only the latest approved fuel expense per vehicle (distinct on vehicle).
 * Uses deterministic tie-breaking: approvedAt → updatedAt → expense date → stable ID/billNo.
 * Matches the Approved tab behaviour consistently across UI and API.
 */
export function getLatestApprovedFuelExpensesPerVehicle(bills: readonly FuelExpense[]): FuelExpense[] {
  const approvedBills = bills.filter((bill) => {
    const isDeleted = bill.deleted === true || bill.status === "Deleted";
    const isTrip = bill.sourceType === "TRIP" || !!bill.tripNo;
    return !isDeleted && (isTrip || bill.status === "Approved");
  });

  const sorted = [...approvedBills].sort(compareBillsNewestFirst);
  const seen = new Set<string>();
  const result: FuelExpense[] = [];

  for (const bill of sorted) {
    const vehicleKey = String(bill.vehicleNo || bill.vehicleId || "").trim().toUpperCase();
    if (vehicleKey && !seen.has(vehicleKey)) {
      seen.add(vehicleKey);
      result.push(bill);
    }
  }

  return result;
}

/** Determines the effective status for display and counting.
 * Priority: deleted > Approved (trip, auto-approved on completion) > the
 * bill's own workflow status. Timestamp presence must never imply approval:
 * every row carries created/updated dates, so treating any date as
 * "Approved" would empty the Pending tab entirely.
 */
export function effectiveStatus(bill: FuelExpense): "Deleted" | "Approved" | "Pending" | "Rejected" {
  const isDeleted = bill.deleted === true || bill.status === "Deleted";
  if (isDeleted) return "Deleted" as const;
  if (bill.sourceType === "TRIP" || !!bill.tripNo) return "Approved" as const;
  return bill.status as "Pending" | "Approved" | "Rejected";
}

/** Sort approved bills by: approvedAt (newest first), updatedAt (newest first),
 * expense date (newest first), then stable billNo (numeric, newest first). */
function compareBillsNewestFirst(left: FuelExpense, right: FuelExpense): number {
  // Tie-breaking order: 1. approvedAt (newest first), 2. updatedAt (newest first),
  // 3. expense date (newest first), 4. stable billNo (numeric, newest first)
  const leftApp = left.approvedDate ?? left.updatedDate ?? left.date ?? left.id;
  const rightApp = right.approvedDate ?? right.updatedDate ?? right.date ?? right.id;
  const byApp = String(rightApp).localeCompare(String(leftApp), undefined, { numeric: true, sensitivity: "base" });
  if (byApp !== 0) return byApp;

  // Final tie-breaker: billNo numeric comparison (higher ID = newer)
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

export function filterFuelExpenses(
  bills: readonly FuelExpense[],
  {
    fromDate,
    toDate,
    vehicleId,
    vehicleNo,
    driverId,
    driverName,
    petrolBunk,
    masterBunkNames = [],
    includeMasterBunks = true,
    sourceType,
    quickTab = "ALL",
    search = "",
    includeDeleted = false,
  }: FuelClientFilters
): FuelExpense[] {
  const from = dateOnly(fromDate);
  const to = dateOnly(toDate);

  const matched = bills.filter((bill) => {
    const isDeleted = bill.deleted === true || bill.status === "Deleted";
    const isTrip = bill.sourceType === "TRIP" || !!bill.tripNo;
    const effectiveStat = effectiveStatus(bill);

    const billDate = dateOnly(bill.date);
    if ((from && (!billDate || billDate < from)) || (to && (!billDate || billDate > to))) return false;

    if (vehicleId != null && Number(bill.vehicleId) !== vehicleId) return false;
    if (vehicleNo && vehicleNo !== "All Vehicles" && bill.vehicleNo !== vehicleNo) return false;

    if (driverId != null && Number(bill.driverId) !== driverId) return false;
    if (driverName && driverName !== "All Drivers" && bill.driverName !== driverName) return false;
    const masterNames = new Set(masterBunkNames.map((name) => name.trim().toLocaleLowerCase()));
    const bunkName = String(bill.petrolBunk || "").trim().toLocaleLowerCase();
    if (!includeMasterBunks && masterNames.has(bunkName)) return false;
    if (petrolBunk === "__OTHER__") {
      if (masterNames.has(bunkName)) return false;
    } else if (petrolBunk && petrolBunk !== "All Bunks" && bill.petrolBunk !== petrolBunk) return false;

    // Quick tab filtering:
    if (quickTab === "DELETED") {
      if (!isDeleted) return false;
    } else {
      // Active tabs (ALL, PENDING, APPROVED) exclude deleted rows, unless
      // the caller keeps them for a downstream tab filter (Deleted register).
      if (isDeleted && !includeDeleted) return false;
      if (quickTab === "PENDING" && effectiveStat !== "Pending") return false;
      if (quickTab === "APPROVED" && effectiveStat !== "Approved") return false;
    }

    // Dropdown filters (if explicit)
    if (sourceType && sourceType !== "All" && (isTrip ? "TRIP" : "MANUAL") !== sourceType) return false;

    return matchesGlobalSearch(bill, search);
  });

  // For the Approved tab: return only the latest approved record per vehicle
  if (quickTab === "APPROVED") {
    return getLatestApprovedFuelExpensesPerVehicle(matched);
  }

  return matched;
}

/** Sorts fuel expenses by the given key and direction. */
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
  if (sortBy === "supervisorName") {
    const direction = sortDir === "desc" ? -1 : 1;
    return [...bills].sort((left, right) => {
      const leftValue = `${left.supervisorName ?? ""} ${left.driverName ?? ""}`;
      const rightValue = `${right.supervisorName ?? ""} ${right.driverName ?? ""}`;
      const comparison = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" });
      if (comparison !== 0) return comparison * direction;
      return String(left.billNo).localeCompare(String(right.billNo), undefined, { numeric: true }) * direction;
    });
  }

  const stringValue = (b: FuelExpense) => String(b[sortBy] ?? "");

  return [...bills].sort((left, right) => {
    const comparison = numericKeys.has(sortBy)
      ? Number(left[sortBy] ?? 0) - Number(right[sortBy] ?? 0)
      : stringValue(left).localeCompare(stringValue(right), undefined, { numeric: true, sensitivity: "base" });

    if (comparison !== 0) return comparison * direction;
    return String(left.billNo).localeCompare(String(right.billNo), undefined, { numeric: true }) * direction;
  });
}