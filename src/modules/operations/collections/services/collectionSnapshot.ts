import type { PendingCollection } from '../types/collection';

/** A side-effect-free read bridge for the shared header. Importing the app
 * shell must not download collection/sales history on unrelated pages. */
interface PendingSnapshot {
  readonly items: readonly PendingCollection[];
  readonly loaded: boolean;
}
let snapshot: PendingSnapshot = { items: [], loaded: false };
const listeners = new Set<() => void>();

export const getPendingCollectionSnapshot = () => snapshot;
export function subscribePendingCollectionSnapshot(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function publishPendingCollectionSnapshot(items: PendingCollection[]) {
  snapshot = { items, loaded: true };
  for (const listener of listeners) listener();
}
