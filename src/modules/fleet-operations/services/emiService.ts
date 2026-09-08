import { getVehiclesRevision, loadVehicles } from '../../masters/vehicles/services/vehicleService';
import type { EmiOverview, EmiInstallment } from '../types';
import { computeEmiOverview, computeVehicleEmiSchedule, getEmiToday } from './emiModel';

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
      const masterRevision = getVehiclesRevision();
      const invalidated = () => revision !== job.revision || masterRevision !== getVehiclesRevision();
      let vehicles;
      try {
        vehicles = await loadVehicles();
      } catch (error) {
        if (invalidated()) continue;
        throw error;
      }
      if (invalidated()) continue;
      const now = new Date();
      const asOfDate = getEmiToday(now);
      return Object.freeze({
        rows: Object.freeze(computeEmiOverview(vehicles, asOfDate).map((row) => Object.freeze(row))),
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
  const vehicle = (await loadVehicles()).find((row) => row.id === vehicleId);
  return vehicle ? computeVehicleEmiSchedule(vehicle) : [];
}
