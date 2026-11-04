// src/modules/accounts/services/farmPaymentApiService.ts
//
// Trip-linked farm payments — the Farmer Payments dataset, read from the
// backend. One row per completed trip: the cost of the birds that trip picked
// up (dcWeight × rate), how much has been paid, and what is still owed.
//
// Why the Analysis needs this file: its Farm Payment expense used to come only
// from Payment Register entries typed "Farmer Payment" (₹2.67 L for the sample
// quarter), while the real farm cost of the same trips was ₹4.39 Cr and lives
// here. Because every row carries its `tripId`, the cost can be attributed to
// the exact trip — which is what makes a per-trip net profit possible.
//
// Pure mapping helpers are exported separately so they can be unit tested
// without a server.
import { apiGet, apiPut } from '../../../api';
import type { FarmPaymentTotals, TripFarmPayment } from '../types/farmPayment.types';

/** One row in PUT /api/accounts/farm-payments. */
export interface TripFarmPaymentSaveInput {
  tripId: number;
  /** Load-level update identity (trip_legs.id). Authoritative when present. */
  legId?: number;
  /** Optional display/validation aid (leg_index). */
  load?: number;
  rate?: number;
  paidAmount?: number;
  paymentDate?: string | null;
  paymentMode?: string | null;
  referenceNo?: string | null;
}

const money = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;

const optionalNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Map one raw farm-payment row. Returns null when it cannot belong to a trip. */
export function mapRawFarmPayment(raw: unknown): TripFarmPayment | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const tripId = Number(row.tripId);
  if (!Number.isFinite(tripId) || tripId <= 0) return null;

  const amount = money(row.amount);
  const paidAmount = money(row.paidAmount);
  // Trust the server's balance when it sends one; otherwise owe = cost − paid.
  const balance = row.balance == null ? Math.max(0, amount - paidAmount) : money(row.balance);
  // The server's own status is authoritative; only when it sends none is the
  // status derived — and then from the money on the row, so a fully settled
  // trip can never read "Pending".
  const status: TripFarmPayment['status'] =
    row.status === 'Paid' || row.status === 'Partially Paid' || row.status === 'Pending'
      ? row.status
      : paidAmount <= 0
        ? 'Pending'
        : paidAmount < amount
          ? 'Partially Paid'
          : 'Paid';

  return {
    id: Number(row.id) || tripId,
    tripId,
    tripNo: optionalText(row.tripNo) ?? `TRIP-${tripId}`,
    tripDate: optionalText(row.tripDate) ?? '',
    farmId: optionalNumber(row.farmId),
    farmName: optionalText(row.farmName),
    birdType: optionalText(row.birdType),
    totalBirds: optionalNumber(row.totalBirds),
    dcWeight: optionalNumber(row.dcWeight),
    rate: optionalNumber(row.rate),
    amount,
    paidAmount,
    balance,
    status,
    paymentDate: typeof row.paymentDate === 'string' ? row.paymentDate : null,
    paymentMode: typeof row.paymentMode === 'string' ? row.paymentMode : null,
    referenceNo: typeof row.referenceNo === 'string' ? row.referenceNo : null,
    vehicleNo: optionalText(row.vehicleNo),
    isRentedVehicle: Boolean(row.isRentedVehicle),
    supervisorName: optionalText(row.supervisorName),
    loads: Array.isArray(row.loads)
      ? row.loads.map((value) => {
          const load = value as Record<string, unknown>;
          return {
            legId: load.legId == null ? null : optionalNumber(load.legId),
            load: money(load.load),
            farmName: typeof load.farmName === 'string' ? load.farmName : null,
            birdType: typeof load.birdType === 'string' ? load.birdType : null,
            totalBirds: money(load.totalBirds),
            dcWeight: money(load.dcWeight),
            rate: load.rate == null ? null : optionalNumber(load.rate),
            amount: load.amount == null ? null : optionalNumber(load.amount),
          };
        })
      : [],
  };
}

/** Map a payload that is either a bare array or a paginated `{ data }` body. */
export function mapFarmPayments(payload: unknown): TripFarmPayment[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
      ? ((payload as { data: unknown[] }).data)
      : [];
  const mapped: TripFarmPayment[] = [];
  const seen = new Set<number>();
  for (const raw of rows) {
    const row = mapRawFarmPayment(raw);
    // One farm payment per trip: a duplicate would double-count the farm cost.
    if (!row || seen.has(row.tripId)) continue;
    seen.add(row.tripId);
    mapped.push(row);
  }
  return mapped;
}

/** Money totals over any set of trip farm payments. */
export function farmPaymentTotals(rows?: readonly TripFarmPayment[] | null): FarmPaymentTotals {
  let payable = 0;
  let paid = 0;
  let balance = 0;
  for (const row of rows ?? []) {
    payable += row.amount;
    paid += row.paidAmount;
    balance += row.balance;
  }
  return { trips: (rows ?? []).length, payable, paid, balance };
}

/** Lookup keyed by trip id (stringified: ids arrive as number or string).
 * Tolerates a snapshot built without farm payments — an absent ledger must
 * read as "no farm payments", not throw. */
export function indexFarmPaymentsByTrip(
  rows?: readonly TripFarmPayment[] | null
): Map<string, TripFarmPayment> {
  return new Map((rows ?? []).map((row) => [String(row.tripId), row]));
}

/**
 * Stable display row for the Farm Payment table/export layer.
 *
 * - Single-load/legacy trip → one row, id `trip:${tripId}`.
 * - Multi-load trip (2+ submitted loads) → one row per load,
 *   id `trip:${tripId}:leg:${legId}` (falls back to `:load:${load}` when the
 *   leg id is absent). The displayed trip number is NEVER the React key nor
 *   an update identity — tripId (+ legId) is.
 */
export interface FarmPaymentDisplayRow {
  /** Stable row identity. Never the displayed trip number. */
  key: string;
  tripId: number;
  /** trip_legs.id for multi-load rows; null for single/legacy rows. */
  legId: number | null;
  /** leg_index for multi-load rows; null for single/legacy rows. */
  load: number | null;
  /** Display-only trip number (`TRIP-L1` suffix for multi-load). */
  displayTripNo: string;
  /** Canonical stored trip number (for the Trip view + backend identity). */
  tripNo: string;
  tripDate: string;
  farm: string;
  vehicleNo: string;
  isRentedVehicle: boolean;
  birdType: string;
  birds: number;
  dcWeight: number;
  rate: number;
  amount: number;
  status: TripFarmPayment['status'];
}

/** Display trip number: `-L{load}` suffix only for genuine multi-load trips. */
export function displayTripNo(tripNo: string, loadCount: number, load: number): string {
  return loadCount > 1 ? `${tripNo}-L${load}` : tripNo;
}

/** Serializable export shape for one payable display row. */
export interface FarmPaymentExportRowData {
  tripNo: string;
  tripDate: string;
  farm: string;
  vehicle: string;
  birdType: string;
  birds: number;
  dcWeight: number;
  rate: number;
  totalAmount: number;
}

/**
 * Build export rows from Farm Payment display rows (already filtered).
 * Multi-load trips export one row per load (`TRIP-L1`, `TRIP-L2`, …) with
 * that load's own figures; the aggregate parent row is never exported, so
 * totals sum the visible payable rows exactly once.
 */
export function toFarmPaymentExportRows(rows: readonly FarmPaymentDisplayRow[]): FarmPaymentExportRowData[] {
  return rows.map((row) => ({
    tripNo: row.displayTripNo,
    tripDate: row.tripDate,
    farm: row.farm,
    vehicle: row.vehicleNo,
    birdType: row.birdType,
    birds: Math.round(row.birds),
    dcWeight: row.dcWeight,
    rate: row.rate,
    totalAmount: row.amount,
  }));
}

/**
 * Flatten parent Farm Payment records into table/export display rows.
 *
 * Only the Farm Payment table/export layer uses this. Account Analysis and
 * every trip-level consumer keep using the parent records (one per trip),
 * so the farm cost is never double-counted: the parent `amount` is already
 * the exact sum of its load amounts.
 */
export function flattenFarmPaymentsForTable(rows: readonly TripFarmPayment[]): FarmPaymentDisplayRow[] {
  const out: FarmPaymentDisplayRow[] = [];
  for (const row of rows) {
    const loads = row.loads ?? [];
    if (loads.length > 1) {
      for (const load of loads) {
        const legId = load.legId != null ? Number(load.legId) : null;
        const rate = Number(load.rate ?? row.rate ?? 0);
        const safeRate = Number.isFinite(rate) ? rate : 0;
        const amount = load.amount != null && Number.isFinite(Number(load.amount))
          ? Number(load.amount)
          : Math.round(Number(load.dcWeight ?? 0) * safeRate * 100) / 100;
        out.push({
          key: Number.isFinite(legId as number) && (legId as number) > 0
            ? `trip:${row.tripId}:leg:${legId}`
            : `trip:${row.tripId}:load:${load.load}`,
          tripId: row.tripId,
          legId: Number.isFinite(legId as number) && (legId as number) > 0 ? (legId as number) : null,
          load: load.load,
          displayTripNo: displayTripNo(row.tripNo, loads.length, load.load),
          tripNo: row.tripNo,
          tripDate: row.tripDate,
          farm: load.farmName ?? row.farmName ?? '',
          vehicleNo: row.vehicleNo ?? '',
          isRentedVehicle: Boolean(row.isRentedVehicle),
          birdType: load.birdType ?? row.birdType ?? '',
          birds: Number(load.totalBirds ?? 0),
          dcWeight: Number(load.dcWeight ?? 0),
          rate: safeRate,
          amount,
          status: row.status,
        });
      }
    } else {
      out.push({
        key: `trip:${row.tripId}`,
        tripId: row.tripId,
        legId: null,
        load: null,
        displayTripNo: row.tripNo,
        tripNo: row.tripNo,
        tripDate: row.tripDate,
        farm: row.farmName ?? '',
        vehicleNo: row.vehicleNo ?? '',
        isRentedVehicle: Boolean(row.isRentedVehicle),
        birdType: row.birdType ?? '',
        birds: Number(row.totalBirds ?? 0),
        dcWeight: Number(row.dcWeight ?? 0),
        rate: Number(row.rate ?? 0),
        amount: row.amount,
        status: row.status,
      });
    }
  }
  return out;
}

/** GET /api/accounts/farm-payments — the whole ledger, mapped and de-duplicated. */
export async function loadTripFarmPayments(): Promise<TripFarmPayment[]> {
  const { data } = await apiGet<unknown>('/accounts/farm-payments');
  return mapFarmPayments(data);
}

/**
 * PUT /api/accounts/farm-payments — persist dirty farmer-payment rows on the
 * trip (farm_rate / farm_paid_*). Returns the updated ledger rows for those
 * trips, mapped the same way as the GET.
 */
export async function saveTripFarmPayments(
  payments: TripFarmPaymentSaveInput[]
): Promise<TripFarmPayment[]> {
  const { data } = await apiPut<unknown>('/accounts/farm-payments', { payments });
  return mapFarmPayments(data);
}
