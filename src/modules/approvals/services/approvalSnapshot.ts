// -----------------------------------------------------------------------------
// PENDING APPROVAL SNAPSHOT — side-effect-free reactive store for the shell
// -----------------------------------------------------------------------------
// The header bell, sidebar badges and the sign-in alert all need to know how
// many things are waiting for the owner WITHOUT importing page-level modules
// or running their hooks. This module is the single polled source of truth:
//
//   trips        Pending wizard-complete trips  → Operations · Trip Entry
//   maintenance  Pending maintenance bills      → Fleet · Maintenance Entry
//   rateEntries  Completed trips awaiting rates → Operations · Rate Entry
//   payments     Draft payment requests          → Accounts · Payment Register
//   collections  Cash/bank collections entered   → Operations · Collection Entry
//   leaves       Leave requests awaiting a yes/no → Staff · Leaves
//
// The Approval Center refreshes this store after every decision, so badges and
// bell counts stay in sync app-wide.
// -----------------------------------------------------------------------------

import { listTrips } from '../../operations/vehicle-trips/services/tripHeaderApiService';
import { maintenanceApi, mapMaintenanceToEvent } from '../../fleet-operations/services/maintenanceApi';
import permitApi from '../../fleet-operations/services/permitApi';
import { fleetSharedGet } from '../../fleet-operations/services/fleetSessionCache';
import { listEligibleTrips } from '../../operations/shop-sales/services/rateEntryApiService';
import { listPayments } from '../../accounts/services/paymentApiService';
import { listLeaves } from '../../staff/services/leaveService';
import { STAFF_LEAVES_CHANGED } from '../../staff/services/staffEvents';
import { apiGet } from '../../../api';

export interface ApprovalQueueItem {
  id: string;
  /** Record reference, e.g. TRP-… / MNT-… / Pay-… */
  ref: string;
  /** Secondary descriptor (vehicle, paid-to, …) */
  sub: string;
  /** ISO timestamp the item has been waiting since. */
  waitingFrom?: string | null;
  amount?: number;
}

export interface ApprovalQueue {
  count: number;
  value: number;
  items: ApprovalQueueItem[];
}

export interface ApprovalSnapshot {
  loaded: boolean;
  loading: boolean;
  error: boolean;
  lastLoadedAt: string | null;
  trips: ApprovalQueue & { birds: number; shops: number };
  maintenance: ApprovalQueue;
  rateEntries: ApprovalQueue;
  payments: ApprovalQueue;
  /** Collections recorded by staff and waiting for the owner's approval. */
  collections: ApprovalQueue;
  /** Expired fleet permits/documents (RC, insurance, fitness, permit, PUC). */
  documents: ApprovalQueue;
  /** Leave requests still waiting for the owner's approval. */
  leaves: ApprovalQueue;
  total: number;
}

const EMPTY_QUEUE: ApprovalQueue = { count: 0, value: 0, items: [] };

const INITIAL: ApprovalSnapshot = {
  loaded: false,
  loading: false,
  error: false,
  lastLoadedAt: null,
  trips: { ...EMPTY_QUEUE, birds: 0, shops: 0 },
  maintenance: { ...EMPTY_QUEUE },
  rateEntries: { ...EMPTY_QUEUE },
  payments: { ...EMPTY_QUEUE },
  collections: { ...EMPTY_QUEUE },
  documents: { ...EMPTY_QUEUE },
  leaves: { ...EMPTY_QUEUE },
  total: 0,
};

let snapshot: ApprovalSnapshot = INITIAL;
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;
/** Refreshes closer together than this are coalesced. */
let lastSuccessAt = 0;
const MIN_REFRESH_GAP_MS = 15_000;

export const getApprovalSnapshot = (): ApprovalSnapshot => snapshot;

export function subscribeApprovalSnapshot(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(next: Partial<ApprovalSnapshot>) {
  snapshot = { ...snapshot, ...next };
  snapshot.total =
    snapshot.trips.count +
    snapshot.maintenance.count +
    snapshot.rateEntries.count +
    snapshot.payments.count +
    snapshot.collections.count +
    snapshot.leaves.count;
  for (const listener of listeners) listener();
}

const rowsOf = (payload: unknown): unknown[] =>
  Array.isArray(payload) ? payload : ((payload as { data?: unknown[] } | null)?.data ?? []);

const cap = 6;

const PENDING_APPROVAL_STATUS = 'pending approval';

/**
 * Collections waiting for the owner's sign-off.
 *
 * Deliberately NOT `collectionService`: that module downloads the whole
 * register (collections + shop sales + shops) to fill page-level caches, which
 * is far too heavy for a poller that runs in the app shell every 90 seconds.
 * One filtered request is enough; `status` is re-checked here too, so a backend
 * that ignores the query parameter still yields the right count.
 */
async function listPendingApprovalCollections(): Promise<
  { id: number; collectionNo: string; shopName: string; amount: number; date: string }[]
> {
  const { data } = await apiGet<Record<string, unknown>[]>('/operations/collection-entry', {
    params: { status: 'Pending Approval' },
  });
  const rows = Array.isArray(data) ? data : ((data as { data?: Record<string, unknown>[] })?.data ?? []);
  return rows
    .filter(
      (row) =>
        String(row.status ?? '').toLowerCase() === PENDING_APPROVAL_STATUS &&
        row.deleted !== true &&
        row.deletedAt == null
    )
    .map((row) => ({
      id: Number(row.id) || 0,
      collectionNo: String(row.collectionNo ?? row.collection_no ?? ''),
      shopName: String(row.shopName ?? row.shop_name ?? ''),
      amount: Number(row.amount ?? 0) || 0,
      date: String(row.collectionDate ?? row.collection_date ?? ''),
    }));
}

/**
 * Load every pending queue from its existing module service. Failures in one
 * queue never blank the others; a total failure flips `error` so the shell can
 * stay quiet rather than showing false zeros.
 */
export function refreshApprovalSnapshot(force = false): Promise<void> {
  if (inFlight) return inFlight;
  if (!force && snapshot.loaded && Date.now() - lastSuccessAt < MIN_REFRESH_GAP_MS) {
    return Promise.resolve();
  }
  publish({ loading: true, error: false });

  inFlight = (async () => {
    const results = await Promise.allSettled([
      listTrips(),
      maintenanceApi.list({ status: 'Pending', limit: 500 }),
      listEligibleTrips().catch(() => []),
      // Real payments in every environment — the same dataset the Payment
      // Register opens with. A dev-only switch to the bundled examples used to
      // make this queue disagree with the register (and with the backend).
      listPayments().catch(() => []),
      fleetSharedGet('permits:list', () => permitApi.list()).catch(() => []),
      listPendingApprovalCollections(),
      // Every pending leave, whatever month it was raised in — the queue the
      // owner has to clear is not scoped to the month the Staff page filters to.
      listLeaves({ status: 'Pending', limit: cap }),
    ]);

    const [
      tripsResult,
      maintenanceResult,
      rateResult,
      paymentsResult,
      documentsResult,
      collectionsResult,
      leavesResult,
    ] = results;

    // Trips awaiting approval (Pending, excluding the [ORDER] container trips).
    let tripsQueue = snapshot.trips;
    if (tripsResult.status === 'fulfilled') {
      const pending = tripsResult.value.filter(
        (trip) => trip.status === 'Pending' && !String(trip.tripNo).startsWith('[ORDER]')
      );
      tripsQueue = {
        count: pending.length,
        value: 0,
        birds: pending.reduce((sum, trip) => sum + (Number(trip.totalBirds) || 0), 0),
        shops: pending.reduce((sum, trip) => sum + (Number(trip.totalShops) || 0), 0),
        items: pending.slice(0, cap).map((trip) => ({
          id: `trip-${trip.id}`,
          ref: trip.tripNo,
          sub: [trip.vehicleNo, trip.sourceFarm].filter(Boolean).join(' · ') || 'Trip',
          waitingFrom: trip.startStepSubmittedAt || trip.createdAt || trip.tripDate,
        })),
      };
    }

    // Maintenance bills awaiting rate approval.
    let maintenanceQueue = snapshot.maintenance;
    if (maintenanceResult.status === 'fulfilled') {
      const pending = rowsOf(maintenanceResult.value)
        .map((row) => mapMaintenanceToEvent(row))
        .filter((record) => record.paymentStatus !== 'approved' && !record.deletedAt);
      maintenanceQueue = {
        count: pending.length,
        value: pending.reduce((sum, record) => sum + (Number(record.totalCost) || 0), 0),
        items: pending.slice(0, cap).map((record) => ({
          id: `mnt-${record.id}`,
          ref: record.billNumber || `Bill #${record.id}`,
          sub: [record.vehicleNo, record.maintenanceType].filter(Boolean).join(' · ') || 'Maintenance',
          waitingFrom: record.createdAt || record.date,
          amount: Number(record.totalCost) || 0,
        })),
      };
    }

    // Completed trips still awaiting rate entry.
    let rateQueue = snapshot.rateEntries;
    if (rateResult.status === 'fulfilled') {
      const eligible = rateResult.value;
      rateQueue = {
        count: eligible.length,
        value: 0,
        items: eligible.slice(0, cap).map((trip) => ({
          id: `rate-${trip.id}`,
          ref: trip.tripNo,
          sub: [trip.vehicleNo, trip.sourceFarm].filter(Boolean).join(' · ') || 'Trip',
          waitingFrom: trip.tripDate,
        })),
      };
    }

    // Draft payment requests.
    let paymentQueue = snapshot.payments;
    if (paymentsResult.status === 'fulfilled') {
      const pending = paymentsResult.value.filter((payment) => payment.status === 'Draft');
      paymentQueue = {
        count: pending.length,
        value: pending.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
        items: pending.slice(0, cap).map((payment) => ({
          id: `pay-${payment.id}`,
          ref: payment.paymentNo,
          sub: payment.paidTo || payment.paymentType,
          waitingFrom: payment.createdAt || `${payment.paymentDate}T00:00:00`,
          amount: Number(payment.amount) || 0,
        })),
      };
    }

    // Collections entered by staff, still waiting for approval.
    let collectionsQueue = snapshot.collections;
    if (collectionsResult.status === 'fulfilled') {
      collectionsQueue = {
        count: collectionsResult.value.length,
        value: collectionsResult.value.reduce((sum, entry) => sum + entry.amount, 0),
        items: collectionsResult.value.slice(0, cap).map((entry) => ({
          id: `col-${entry.id}`,
          ref: entry.collectionNo || `COL #${entry.id}`,
          sub: entry.shopName || 'Collection',
          waitingFrom: entry.date ? `${entry.date}T00:00:00` : null,
          amount: entry.amount,
        })),
      };
    }

    // Leave requests waiting for a decision. `count` comes from the API's total
    // (the request only carries the first few rows for the tooltip/bell).
    let leavesQueue = snapshot.leaves;
    if (leavesResult.status === 'fulfilled') {
      const pending = leavesResult.value.items.filter((leave) => leave.status === 'Pending');
      leavesQueue = {
        count: leavesResult.value.total || pending.length,
        value: 0,
        items: pending.slice(0, cap).map((leave) => ({
          id: `leave-${leave.id}`,
          ref: leave.employeeName || `Leave #${leave.id}`,
          sub: [leave.type, leave.days ? `${leave.days}d` : '', leave.fromDate]
            .filter(Boolean)
            .join(' · ') || 'Leave request',
          waitingFrom: leave.createdAt || (leave.fromDate ? `${leave.fromDate}T00:00:00` : null),
        })),
      };
    }

    // Expired fleet permits/documents (mirrors the Permits matrix threshold:
    // expiry strictly before today is "expired"; within 30 days is "expiring").
    let documentsQueue = snapshot.documents;
    if (documentsResult.status === 'fulfilled') {
      const todayIso = new Date().toISOString().slice(0, 10);
      const expired = documentsResult.value.filter(
        (doc) => doc.hasDocument !== false && !!doc.expiryDate && doc.expiryDate < todayIso
      );
      documentsQueue = {
        count: expired.length,
        value: 0,
        items: expired.slice(0, cap).map((doc) => ({
          id: `doc-${doc.id}`,
          ref: doc.vehicleNo || `Vehicle ${doc.vehicleId}`,
          sub: String(doc.docType).toUpperCase(),
          waitingFrom: doc.expiryDate,
        })),
      };
    }

    // A permit failure alone must not make the approval counters look broken.
    const anyFailed = results
      .slice(0, 4)
      .some((r) => r.status === 'rejected');
    lastSuccessAt = Date.now();
    publish({
      loaded: true,
      loading: false,
      error: anyFailed,
      lastLoadedAt: new Date().toISOString(),
      trips: tripsQueue,
      maintenance: maintenanceQueue,
      rateEntries: rateQueue,
      payments: paymentQueue,
      collections: collectionsQueue,
      documents: documentsQueue,
      leaves: leavesQueue,
    });
  })();

  inFlight.finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Load once on shell mount; subsequent calls are cheap. */
export function ensureApprovalSnapshotLoaded(): Promise<void> {
  if (snapshot.loaded || snapshot.loading) return inFlight ?? Promise.resolve();
  return refreshApprovalSnapshot();
}

/** Force a refresh immediately (after a decision or when the tab regains focus). */
export function kickApprovalSnapshot(): Promise<void> {
  lastSuccessAt = 0;
  return refreshApprovalSnapshot(true);
}

/**
 * Polling lifecycle for the app shell. Returns a stop function. Refreshes on an
 * interval and whenever the tab becomes visible again.
 */
export function startApprovalPolling(intervalMs = 90_000): () => void {
  void ensureApprovalSnapshotLoaded();
  const timer = window.setInterval(() => void refreshApprovalSnapshot(), intervalMs);
  const onVisible = () => {
    if (!document.hidden) void refreshApprovalSnapshot();
  };
  document.addEventListener('visibilitychange', onVisible);

  /* Approving or rejecting a leave fires this event (staff/services/staffEvents),
     so the Leaves tile and the bell drop their count at once instead of waiting
     up to 90 s for the next poll. Debounced: clearing a handful of requests in a
     row should cost one refresh, not one per click. The store listens rather than
     the leave hook calling in — that keeps the dependency pointing one way
     (aggregator → modules) and browser-only services out of the staff chunk. */
  let leavesChangedTimer: number | undefined;
  const onLeavesChanged = () => {
    window.clearTimeout(leavesChangedTimer);
    leavesChangedTimer = window.setTimeout(() => void kickApprovalSnapshot(), 600);
  };
  window.addEventListener(STAFF_LEAVES_CHANGED, onLeavesChanged);

  return () => {
    window.clearInterval(timer);
    window.clearTimeout(leavesChangedTimer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener(STAFF_LEAVES_CHANGED, onLeavesChanged);
  };
}
