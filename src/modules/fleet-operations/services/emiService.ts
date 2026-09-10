import type { EmiOverview, EmiInstallment } from '../types';
import { getEmiToday } from './emiModel';
import { emiApi } from './emiApi';

export { computeKpis } from './emiModel';

export interface EmiSnapshot {
  readonly rows: readonly EmiOverview[];
  readonly asOfDate: string;
  readonly fetchedAt: string;
}

// Share only an in-flight read, never a stale TTL/browser-storage fallback.
// StrictMode, rapid re-entry and multiple consumers join the same request.
// A departing consumer must not abort a read another consumer still needs.
interface PendingRead {
  promise: Promise<EmiSnapshot>;
  revision: number;
}
// Opaque auth-context identity: do not serialize tokens/user details or share
// a request with a different signed-in context. Entries exist only in flight.
const inFlight = new Map<unknown, PendingRead>();
export const hasPendingEmiRead = (scope: unknown = null) => inFlight.has(scope);
export const invalidateEmiRead = (scope: unknown = null) => {
  const pending = inFlight.get(scope);
  if (pending) ++pending.revision;
};

export function loadEmiSnapshot(scope: unknown = null): Promise<EmiSnapshot> {
  const existing = inFlight.get(scope);
  if (existing) return existing.promise;
  const pending = Promise.resolve().then(async () => {
    // Known changes coalesce into a sequential fresh GET; no mutation is replayed.
    for (;;) {
      const revision = job.revision;
      const invalidated = () => revision !== job.revision;
      let records;
      try {
        records = await emiApi.list();
      } catch (error) {
        if (invalidated()) continue;
        throw error;
      }
      if (invalidated()) continue;
      const now = new Date();
      const asOfDate = getEmiToday(now);
      return Object.freeze({
        rows: Object.freeze(records.map((record) => Object.freeze({
          vehicleId: record.vehicleId,
          vehicleNo: record.vehicleNo,
          vehicleNumber: record.vehicleNo,
          purchaseAmount: record.loanAmount,
          totalEMIs: record.totalEMIs,
          completedEMIs: record.paidEMIs,
          pendingEMIs: record.pendingEMIs,
          emiDay: record.nextEMIDate ? Number(record.nextEMIDate.slice(8, 10)) : null,
          emiStartDate: record.startDate,
          status: record.status === 'paid' ? 'COMPLETED' as const : 'PENDING' as const,
        }))),
        asOfDate,
        fetchedAt: now.toISOString(),
      });
    }
  }).finally(() => {
    if (inFlight.get(scope)?.promise === pending) inFlight.delete(scope);
  });
  const job = { promise: pending, revision: 0 };
  inFlight.set(scope, job);
  return pending;
}

/** Compatibility entry point; all consumers use the same read-only pipeline. */
export async function buildEmiOverview(scope: unknown = null): Promise<EmiOverview[]> {
  return (await loadEmiSnapshot(scope)).rows.map((row) => ({ ...row }));
}

/** Schedule details are generated only when explicitly requested, not per row. */
export async function getEmiSchedule(vehicleId: number): Promise<EmiInstallment[]> {
  const record = (await emiApi.list({ vehicleId }))[0];
  if (!record) return [];
  const schedule = await emiApi.listSchedule(record.id);
  return schedule.map((item) => ({
    installmentNo: item.installmentNo,
    dueDate: item.dueDate,
    amount: item.amount,
    status: item.status === 'paid' ? 'COMPLETED' : 'PENDING',
  }));
}
