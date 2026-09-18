import type { Vehicle } from '../../masters/vehicles/types/vehicle';
import type { EmiInstallment, EmiOverview } from '../types';

export const EMI_TIME_ZONE = 'Asia/Kolkata';
const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;
const MAX_DETAIL_INSTALLMENTS = 1_200;
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: EMI_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
const vehicleCollator = new Intl.Collator('en-IN', { numeric: true, sensitivity: 'base' });

type CivilDate = { year: number; month: number; day: number; key: string; monthIndex: number };

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function civilKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDate(value: string): CivilDate {
  // Accept date-only values and the ISO timestamps a date-serializing API may
  // return. Preserve their civil date: never shift an EMI date through UTC.
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) {
    throw new Error('Invalid EMI calendar date.');
  }
  if (value.length > 10 && !Number.isFinite(Date.parse(value))) throw new Error('Invalid EMI calendar date.');
  const key = value.slice(0, 10);
  const [year, month, day] = key.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error('Invalid EMI calendar date.');
  }
  return { year, month, day, key, monthIndex: year * 12 + month - 1 };
}

export function getEmiToday(now = new Date()): string {
  const parts = dateFormatter.formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** One calendar-boundary timer, not a polling interval. */
export function msUntilNextEmiDay(now = Date.now()): number {
  return (Math.floor((now + IST_OFFSET_MS) / DAY_MS) + 1) * DAY_MS - IST_OFFSET_MS - now;
}

function readLoan(vehicle: Vehicle, dateCache?: Map<string, CivilDate>) {
  const { purchaseAmount, totalEMIs, emiDay } = vehicle;
  const start = vehicle.emiStartDate || vehicle.purchaseDate;
  // Cash purchases and incomplete finance details are not EMI schedules.
  if (purchaseAmount == null || purchaseAmount === 0 || totalEMIs == null || totalEMIs === 0 || emiDay == null || emiDay === 0 || !start) return null;
  if (!Number.isFinite(purchaseAmount) || purchaseAmount < 0 || purchaseAmount > Number.MAX_SAFE_INTEGER ||
      !Number.isSafeInteger(totalEMIs) || totalEMIs < 1 ||
      !Number.isInteger(emiDay) || emiDay < 1 || emiDay > 31 ||
      !Number.isSafeInteger(vehicle.id) || vehicle.id < 1) {
    throw new Error('Invalid Vehicle Master EMI details.');
  }
  let parsedStart = dateCache?.get(start);
  if (!parsedStart) {
    parsedStart = parseDate(start);
    dateCache?.set(start, parsedStart);
  }
  return { purchaseAmount, totalEMIs, emiDay, start: parsedStart };
}

/** O(1) per vehicle; no installment arrays, even for a very long schedule. */
function completedCount(loan: NonNullable<ReturnType<typeof readLoan>>, today: CivilDate): number {
  const elapsedMonths = today.monthIndex - loan.start.monthIndex;
  const dueDay = Math.min(loan.emiDay, daysInMonth(today.year, today.month));
  return Math.max(0, Math.min(loan.totalEMIs, elapsedMonths + (today.day >= dueDay ? 1 : 0)));
}

/** Same due-date-based completion rule as before, with valid civil dates. */
export function computeEmiOverview(vehicles: readonly Vehicle[], asOfDate = getEmiToday()): EmiOverview[] {
  const today = parseDate(asOfDate);
  const records = new Map<number, EmiOverview>();
  const dateCache = new Map<string, CivilDate>();
  for (const vehicle of vehicles) {
    const loan = readLoan(vehicle, dateCache);
    if (!loan) continue;
    const registration = vehicle.vehicleNumber.trim();
    if (!registration || registration.length > 120) throw new Error('Invalid Vehicle Master registration.');
    const completed = completedCount(loan, today);
    const pending = loan.totalEMIs - completed;
    const row: EmiOverview = {
      vehicleId: vehicle.id,
      vehicleNo: String(vehicle.vehicleNo),
      vehicleNumber: registration,
      purchaseAmount: loan.purchaseAmount,
      totalEMIs: loan.totalEMIs,
      completedEMIs: completed,
      pendingEMIs: pending,
      emiDay: loan.emiDay,
      emiStartDate: loan.start.key,
      status: pending === 0 ? 'COMPLETED' : 'PENDING',
      // Sample-origin metadata is accepted only from the explicit sample API
      // adapter; it is not part of, or persisted by, Vehicle Master.
      isSample: (vehicle as Vehicle & { isSample?: boolean }).isSample === true,
    };
    const previous = records.get(row.vehicleId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) {
      // Do not arbitrarily pick one of two conflicting financial records.
      throw new Error('Conflicting duplicate Vehicle Master records.');
    }
    if (!previous) records.set(row.vehicleId, row);
  }
  return [...records.values()];
}

export function computeVehicleEmiSchedule(vehicle: Vehicle, asOfDate = getEmiToday()): EmiInstallment[] {
  const loan = readLoan(vehicle);
  if (!loan) return [];
  if (loan.totalEMIs > MAX_DETAIL_INSTALLMENTS) {
    throw new Error('EMI detail schedule exceeds the safe display limit.');
  }
  const completed = completedCount(loan, parseDate(asOfDate));
  return Array.from({ length: loan.totalEMIs }, (_, index) => {
    const monthIndex = loan.start.monthIndex + index;
    const year = Math.floor(monthIndex / 12);
    const month = monthIndex % 12 + 1;
    if (year > 9999) throw new Error('EMI detail schedule exceeds the supported calendar.');
    return {
      installmentNo: index + 1,
      dueDate: civilKey(year, month, Math.min(loan.emiDay, daysInMonth(year, month))),
      amount: loan.purchaseAmount / loan.totalEMIs,
      status: index < completed ? 'COMPLETED' : 'PENDING',
    };
  });
}

export function computeKpis(rows: readonly EmiOverview[]) {
  let completedEmiVehicles = 0;
  for (const row of rows) if (row.pendingEMIs === 0) completedEmiVehicles++;
  return {
    totalVehicles: rows.length,
    completedEmiVehicles,
    pendingEmiVehicles: rows.length - completedEmiVehicles,
  };
}

export type EmiSortKey = 'vehicleNumber' | 'purchaseAmount' | 'totalEMIs' | 'completedEMIs' | 'pendingEMIs' | 'emiStartDate' | 'status';
export type EmiSortDirection = 'asc' | 'desc';
const getters: Record<EmiSortKey, (row: EmiOverview) => string | number> = {
  vehicleNumber: (row) => row.vehicleNumber,
  purchaseAmount: (row) => row.purchaseAmount ?? 0,
  totalEMIs: (row) => row.totalEMIs ?? 0,
  completedEMIs: (row) => row.completedEMIs,
  pendingEMIs: (row) => row.pendingEMIs,
  emiStartDate: (row) => row.emiStartDate ?? '',
  status: (row) => row.status === 'PENDING' ? 0 : 1,
};

/** Stable ties are independent of backend response order and sort direction. */
export function sortEmiOverview(rows: readonly EmiOverview[], key: EmiSortKey, direction: EmiSortDirection): EmiOverview[] {
  const getter = getters[key] ?? getters.vehicleNumber;
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = getter(a);
    const bv = getter(b);
    const primary = typeof av === 'string' && typeof bv === 'string'
      ? (key === 'vehicleNumber' ? vehicleCollator.compare(av, bv) : av < bv ? -1 : av > bv ? 1 : 0)
      : Number(av) - Number(bv);
    return primary * factor || vehicleCollator.compare(a.vehicleNumber, b.vehicleNumber) || a.vehicleId - b.vehicleId;
  });
}

/** Registration searches ignore presentation spaces/dashes; never use user regex. */
export function normalizeEmiSearch(value: string): string {
  return value.replace(/[\s-]+/g, '').toLowerCase();
}
