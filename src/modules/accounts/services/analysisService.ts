import { approvedExpenses } from '../utils/approvedExpenses';
import { listTrips } from '../../operations/vehicle-trips/services/tripHeaderApiService';
import { loadAnalysisCollections } from './analysisCollections';
import { listPayments } from './paymentApiService';
import {
  farmPaymentTotals,
  indexFarmPaymentsByTrip,
  loadTripFarmPayments,
} from './farmPaymentApiService';
import { summaryCalculations as summaryService } from './summaryCalculations';
import { parseBusinessDate } from '../../../utils/businessDate';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import type { Collection } from '../../operations/collections/types/collection';
import type { Payment } from '../types/payment.types';
import type { FarmPaymentTotals, TripFarmPayment } from '../types/farmPayment.types';

export interface AnalysisSnapshot {
  trips: Trip[];
  collections: Collection[];
  payments: Payment[];
  /** One row per completed trip: the cost of the birds that trip carried. */
  farmPayments: TripFarmPayment[];
}

export const EMPTY_ANALYSIS: AnalysisSnapshot = {
  trips: [],
  collections: [],
  payments: [],
  farmPayments: [],
};

/** One coherent snapshot for every period, comparison, category and export. */
let pendingSnapshot: Promise<AnalysisSnapshot> | null = null;
/** Share concurrent reads (including React Strict Mode); never cache a failure
 * or return stale data on a later explicit refresh. */
export function loadAnalysisSnapshot(): Promise<AnalysisSnapshot> {
  if (!pendingSnapshot) pendingSnapshot = readSnapshot().finally(() => { pendingSnapshot = null; });
  return pendingSnapshot;
}
async function readSnapshot(): Promise<AnalysisSnapshot> {
  const [trips, payments, collections, farmPayments] = await Promise.all([
    listTrips({ full: true }),
    listPayments(),
    loadAnalysisCollections(),
    loadTripFarmPayments(),
  ]);
  const unique = <T extends { id?: string | number }>(rows: T[]): T[] => [...new Map(rows.map(row => {
    if (row.id == null || row.id === '') throw new Error('A financial record is missing its ID. Please refresh or check the source register.');
    return [String(row.id), row] as const;
  })).values()];
  return { trips: unique(trips), payments: unique(payments), collections, farmPayments };
}

function inRange(value: string, start: Date, end: Date): boolean {
  const date = parseBusinessDate(value.slice(0, 10)) ?? new Date(NaN);
  return Number.isFinite(date.getTime()) && date >= start && date <= end;
}

export function createAnalysisService(snapshot: AnalysisSnapshot) {
  const trips = snapshot.trips.filter(trip => !trip.deleted && (trip.status === 'Completed' || String(trip.status) === 'Approved'));
  const collections = snapshot.collections.filter(row => row.status === 'Approved');
  const farmByTrip = indexFarmPaymentsByTrip(snapshot.farmPayments);

  /** The farm payment belonging to one trip, if that trip has one. */
  const getFarmPaymentForTrip = (tripId: string | number): TripFarmPayment | undefined =>
    farmByTrip.get(String(tripId));

  /**
   * Farm money for exactly the trips given — never a separate date filter, so
   * the farm figure can never disagree with the trips whose sales it is being
   * netted against.
   */
  const farmTotalsForTrips = (rangeTrips: readonly Trip[]): FarmPaymentTotals => {
    const rows: TripFarmPayment[] = [];
    for (const trip of rangeTrips) {
      const row = farmByTrip.get(String(trip.id));
      if (row) rows.push(row);
    }
    return farmPaymentTotals(rows);
  };

  return {
    ...summaryService,
    getCompletedTripsByDateRange: (start: Date, end: Date) => trips.filter(trip => inRange(trip.tripDate, start, end)),
    getApprovedCollectionsByDateRange: (start: Date, end: Date) => collections.filter(row => inRange(row.collectionDate, start, end)),
    getFarmPaymentForTrip,
    farmTotalsForTrips,
    computeEffectiveExpenses: (rangeTrips: readonly Trip[], start: Date, end: Date) => {
      const breakdown = approvedExpenses(snapshot.payments, start, end);
      // The farm sector is the cost of the birds those trips carried, taken
      // from the trip-linked Farmer Payments ledger. Payment Register entries
      // typed "Farmer Payment" are the CASH SETTLEMENT of that same cost, so
      // they are deliberately not added again — summing both would count every
      // farmer rupee twice. Every other sector still comes from the register.
      breakdown.farm = farmTotalsForTrips(rangeTrips).payable;
      return breakdown;
    },
  };
}
