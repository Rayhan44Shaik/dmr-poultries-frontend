import { approvedExpenses } from '../utils/approvedExpenses';
import { listTrips } from '../../operations/vehicle-trips/services/tripHeaderApiService';
import { loadAnalysisCollections } from './analysisCollections';
import { listPayments } from './paymentApiService';
import { summaryCalculations as summaryService } from './summaryCalculations';
import { parseBusinessDate } from '../../../utils/businessDate';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import type { Collection } from '../../operations/collections/types/collection';
import type { Payment } from '../types/payment.types';

export interface AnalysisSnapshot {
  trips: Trip[];
  collections: Collection[];
  payments: Payment[];
}

export const EMPTY_ANALYSIS: AnalysisSnapshot = { trips: [], collections: [], payments: [] };

/** One coherent snapshot for every period, comparison, category and export. */
let pendingSnapshot: Promise<AnalysisSnapshot> | null = null;
/** Share concurrent reads (including React Strict Mode); never cache a failure
 * or return stale data on a later explicit refresh. */
export function loadAnalysisSnapshot(): Promise<AnalysisSnapshot> {
  if (!pendingSnapshot) pendingSnapshot = readSnapshot().finally(() => { pendingSnapshot = null; });
  return pendingSnapshot;
}
async function readSnapshot(): Promise<AnalysisSnapshot> {
  const [trips, payments, collections] = await Promise.all([
    listTrips({ full: true }),
    listPayments(),
    loadAnalysisCollections(),
  ]);
  const unique = <T extends { id?: string | number }>(rows: T[]): T[] => [...new Map(rows.map(row => {
    if (row.id == null || row.id === '') throw new Error('A financial record is missing its ID. Please refresh or check the source register.');
    return [String(row.id), row] as const;
  })).values()];
  return { trips: unique(trips), payments: unique(payments), collections };
}

function inRange(value: string, start: Date, end: Date): boolean {
  const date = parseBusinessDate(value.slice(0, 10)) ?? new Date(NaN);
  return Number.isFinite(date.getTime()) && date >= start && date <= end;
}

export function createAnalysisService(snapshot: AnalysisSnapshot) {
  const trips = snapshot.trips.filter(trip => !trip.deleted && (trip.status === 'Completed' || String(trip.status) === 'Approved'));
  const collections = snapshot.collections.filter(row => row.status === 'Approved');
  return {
    ...summaryService,
    getCompletedTripsByDateRange: (start: Date, end: Date) => trips.filter(trip => inRange(trip.tripDate, start, end)),
    getApprovedCollectionsByDateRange: (start: Date, end: Date) => collections.filter(row => inRange(row.collectionDate, start, end)),
    computeEffectiveExpenses: (_rangeTrips: Trip[], start: Date, end: Date) =>
      approvedExpenses(snapshot.payments, start, end),
  };
}
