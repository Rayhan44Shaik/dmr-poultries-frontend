/**
 * Step 1 header save orchestration — single entry point for all persistence.
 *
 * Platform-agnostic (desktop / Android / tablet can share this module).
 * HTTP calls remain in tripHeaderApiService; this layer owns queueing,
 * debounce, retry, conflict handling, and sync metadata snapshots.
 */

import type { Trip } from "../types/trip";
import {
  createDraft,
  loadTripById,
  saveStep1Header,
  submitStep1,
  fetchLatestOpenStep1Draft,
  handleApiError,
  isConflictError,
  toStep1Payload,
  diffStep1Payload,
} from "./tripHeaderApiService";

export type HeaderSaveStatus = "idle" | "saving" | "saved";

export type SaveOperationKind = "ensure_draft" | "autosave" | "flush" | "submit" | "load";

export type Step1PersistSnapshot = {
  payload: Record<string, unknown>;
  updatedAt: string | null;
  /** Reserved for backend optimistic-lock / etag when available */
  version: number | null;
};

export type SaveSyncMetadata = {
  id: number;
  tripNo: string;
  createdAt: string;
  updatedAt: string;
  version: number | null;
};

export type SaveOperationResult = {
  ok: boolean;
  kind: SaveOperationKind;
  trip?: Trip;
  error?: string;
  conflict?: boolean;
  sync?: SaveSyncMetadata;
};

export type Step1HeaderSaveServiceOptions = {
  onNotify?: (message: string, type?: "success" | "error" | "info") => void;
  onTripIdAssigned?: (id: number) => void;
  /** Server metadata only — never replaces in-progress form fields */
  onMetadataSaved?: (metadata: SaveSyncMetadata) => void;
  /** Full trip replace on load / conflict reload */
  onTripLoaded?: (trip: Trip) => void;
  autosaveDelayMs?: number;
  maxRetries?: number;
  savedIndicatorMs?: number;
};

export interface Step1HeaderSaveService {
  subscribeStatus(listener: () => void): () => void;
  getStatus(): HeaderSaveStatus;

  getLocalTrip(): Trip;
  setLocalTrip(trip: Trip): void;
  updateLocalTrip(updater: (prev: Trip) => Trip): void;

  getPersistSnapshot(): Step1PersistSnapshot | null;
  setPersistSnapshotFromTrip(trip: Trip): void;
  clearPersistSnapshot(): void;

  scheduleAutosave(): void;
  cancelScheduledAutosave(): void;
  flushAutosave(): Promise<void>;
  ensureDraft(): Promise<number | null>;

  loadById(id: number): Promise<Trip | null>;
  resumeLatestDraft(): Promise<Trip | null>;
  submitStep(trip: Partial<Trip>): Promise<SaveOperationResult>;

  reset(): void;
  dispose(): void;
}

const DEFAULT_AUTOSAVE_DELAY_MS = 1500;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_SAVED_INDICATOR_MS = 2000;

function extractSyncMetadata(trip: Trip): SaveSyncMetadata {
  const rawVersion = (trip as Trip & { version?: unknown }).version;
  const version =
    typeof rawVersion === "number" && Number.isFinite(rawVersion) ? rawVersion : null;

  return {
    id: trip.id,
    tripNo: trip.tripNo,
    createdAt: trip.createdAt ?? "",
    updatedAt: trip.updatedAt ?? "",
    version,
  };
}

function snapshotFromTrip(trip: Trip): Step1PersistSnapshot {
  const meta = extractSyncMetadata(trip);
  return {
    payload: toStep1Payload(trip),
    updatedAt: meta.updatedAt || null,
    version: meta.version,
  };
}

function payloadFromSnapshot(snapshot: Step1PersistSnapshot | null): Record<string, unknown> | null {
  return snapshot?.payload ?? null;
}

export function normalizeLoadedStep1Trip(loaded: Trip): Trip {
  return {
    ...loaded,
    helpers: loaded.helpers || [],
    deliveries: loaded.deliveries || [],
    boxDetails: loaded.boxDetails || [],
    startTime: loaded.startStepSubmitted ? loaded.startTime : "",
  };
}

function hasStep1LocalEdits(trip: Trip): boolean {
  return Boolean(
    trip.vehicleId ||
    trip.driverId ||
    trip.supervisorId ||
    trip.openingMeter ||
    trip.advanceAmount ||
    (trip.helpers?.length ?? 0) > 0 ||
    (trip.loaders?.length ?? 0) > 0 ||
    trip.remarks
  );
}

function isNetworkErrorMessage(message: string): boolean {
  return message.includes("reach the server") || message.includes("timed out");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Serializable save queue — one in-flight chain, coalesced diffs (extend for mobile offline queue). */
class SaveOperationQueue {
  private chain: Promise<SaveOperationResult | null> = Promise.resolve(null);

  enqueue(run: () => Promise<SaveOperationResult | null>): Promise<SaveOperationResult | null> {
    const next = (): Promise<SaveOperationResult | null> => run();
    this.chain = this.chain.then(next, next);
    return this.chain;
  }

  awaitPending(): Promise<SaveOperationResult | null> {
    return this.chain;
  }

  reset(): void {
    this.chain = Promise.resolve(null);
  }
}

export function createStep1HeaderSaveService(
  initialTrip: Trip,
  options: Step1HeaderSaveServiceOptions = {}
): Step1HeaderSaveService {
  const autosaveDelayMs = options.autosaveDelayMs ?? DEFAULT_AUTOSAVE_DELAY_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const savedIndicatorMs = options.savedIndicatorMs ?? DEFAULT_SAVED_INDICATOR_MS;

  let localTrip = initialTrip;
  let persistSnapshot: Step1PersistSnapshot | null = null;

  let status: HeaderSaveStatus = "idle";
  const statusListeners = new Set<() => void>();
  let savedIndicatorTimer: ReturnType<typeof setTimeout> | null = null;

  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let ensureDraftPromise: Promise<number | null> | null = null;
  const operationQueue = new SaveOperationQueue();

  const emitStatus = () => {
    statusListeners.forEach((listener) => listener());
  };

  const setStatus = (next: HeaderSaveStatus) => {
    status = next;
    emitStatus();
  };

  const markSaving = () => {
    if (savedIndicatorTimer) {
      clearTimeout(savedIndicatorTimer);
      savedIndicatorTimer = null;
    }
    setStatus("saving");
  };

  const markSaved = () => {
    setStatus("saved");
    if (savedIndicatorTimer) {
      clearTimeout(savedIndicatorTimer);
    }
    savedIndicatorTimer = setTimeout(() => {
      setStatus("idle");
      savedIndicatorTimer = null;
    }, savedIndicatorMs);
  };

  const markIdle = () => {
    if (savedIndicatorTimer) {
      clearTimeout(savedIndicatorTimer);
      savedIndicatorTimer = null;
    }
    setStatus("idle");
  };

  const notify = (message: string, type?: "success" | "error" | "info") => {
    options.onNotify?.(message, type);
  };

  const applyPersistSuccess = (
    saved: Trip,
    persistedDiff: Record<string, unknown>
  ): SaveSyncMetadata => {
    const sync = extractSyncMetadata(saved);
    persistSnapshot = {
      payload: {
        ...(persistSnapshot?.payload ?? {}),
        ...persistedDiff,
      },
      updatedAt: sync.updatedAt || null,
      version: sync.version,
    };
    options.onMetadataSaved?.(sync);
    return sync;
  };

  const applyFullLoad = (loaded: Trip): Trip => {
    const normalized = normalizeLoadedStep1Trip(loaded);
    localTrip = normalized;
    persistSnapshot = snapshotFromTrip(normalized);
    options.onTripLoaded?.(normalized);
    return normalized;
  };

  const persistAutosaveWithRetry = async (
    kind: SaveOperationKind
  ): Promise<SaveOperationResult | null> => {
    const id = localTrip.id;
    const diff = diffStep1Payload(localTrip, payloadFromSnapshot(persistSnapshot));
    if (!id || !diff || Object.keys(diff).length === 0) {
      return { ok: true, kind };
    }

    markSaving();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const tripAtRequestTime = { ...localTrip };
        const saved = await saveStep1Header(id, tripAtRequestTime, diff);
        const sync = applyPersistSuccess(saved, diff);
        markSaved();
        return { ok: true, kind, trip: saved, sync };
      } catch (err) {
        if (isConflictError(err)) {
          try {
            const fresh = await loadTripById(id);
            applyFullLoad(fresh);
            notify("Conflict while saving. Loaded the latest server copy.", "error");
          } catch {
            notify(handleApiError(err), "error");
          }
          markIdle();
          return { ok: false, kind, conflict: true, error: handleApiError(err) };
        }

        const message = handleApiError(err);
        if (isNetworkErrorMessage(message) && attempt < maxRetries) {
          await delay(1000 * (attempt + 1));
          continue;
        }

        notify(message, "error");
        markIdle();
        return { ok: false, kind, error: message };
      }
    }

    markIdle();
    return { ok: false, kind, error: "Save failed after retries." };
  };

  const enqueueAutosave = (): Promise<SaveOperationResult | null> => {
    return operationQueue.enqueue(() => persistAutosaveWithRetry("autosave"));
  };

  const ensureDraftInternal = async (): Promise<number | null> => {
    if (localTrip.id > 0) {
      return localTrip.id;
    }

    if (ensureDraftPromise) {
      return ensureDraftPromise;
    }

    ensureDraftPromise = (async () => {
      markSaving();
      try {
        const existing = await fetchLatestOpenStep1Draft(localTrip.tripDate);
        if (existing?.id) {
          if (hasStep1LocalEdits(localTrip)) {
            const sync = extractSyncMetadata(existing);
            localTrip = { ...localTrip, ...sync, startTime: "" };
            options.onMetadataSaved?.(sync);
          } else {
            applyFullLoad(existing);
          }
          options.onTripIdAssigned?.(existing.id);
          return existing.id;
        }

        const saved = await createDraft(localTrip.tripDate);
        const sync = extractSyncMetadata(saved);
        localTrip = {
          ...localTrip,
          id: sync.id,
          tripNo: sync.tripNo,
          createdAt: sync.createdAt,
          updatedAt: sync.updatedAt,
          startTime: "",
        };
        if (!persistSnapshot) {
          persistSnapshot = snapshotFromTrip(localTrip);
        }
        options.onMetadataSaved?.(sync);
        options.onTripIdAssigned?.(saved.id);
        return saved.id;
      } catch (err) {
        notify(handleApiError(err), "error");
        return null;
      } finally {
        markSaved();
        ensureDraftPromise = null;
      }
    })();

    return ensureDraftPromise;
  };

  return {
    subscribeStatus(listener) {
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    },

    getStatus() {
      return status;
    },

    getLocalTrip() {
      return localTrip;
    },

    setLocalTrip(trip) {
      localTrip = trip;
    },

    updateLocalTrip(updater) {
      localTrip = updater(localTrip);
    },

    getPersistSnapshot() {
      return persistSnapshot;
    },

    setPersistSnapshotFromTrip(trip) {
      persistSnapshot = snapshotFromTrip(trip);
    },

    clearPersistSnapshot() {
      persistSnapshot = null;
    },

    scheduleAutosave() {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer);
      }
      autosaveTimer = setTimeout(() => {
        void (async () => {
          const id = localTrip.id > 0 ? localTrip.id : await ensureDraftInternal();
          if (!id) return;

          const diff = diffStep1Payload(localTrip, payloadFromSnapshot(persistSnapshot));
          if (!diff) return;

          await enqueueAutosave();
        })();
      }, autosaveDelayMs);
    },

    cancelScheduledAutosave() {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }
    },

    async flushAutosave() {
      this.cancelScheduledAutosave();

      if (localTrip.id <= 0) {
        const id = await ensureDraftInternal();
        if (!id) return;
      }

      const diff = diffStep1Payload(localTrip, payloadFromSnapshot(persistSnapshot));
      if (diff) {
        await enqueueAutosave();
      } else {
        await operationQueue.awaitPending();
      }
    },

    ensureDraft() {
      return ensureDraftInternal();
    },

    async loadById(id) {
      try {
        const loaded = await loadTripById(id);
        return applyFullLoad(loaded);
      } catch (err) {
        notify(handleApiError(err), "error");
        return null;
      }
    },

    async resumeLatestDraft() {
      try {
        const draft = await fetchLatestOpenStep1Draft();
        if (!draft?.id) return null;
        return applyFullLoad(draft);
      } catch (err) {
        notify(handleApiError(err), "error");
        return null;
      }
    },

    async submitStep(tripPatch) {
      markSaving();
      try {
        let tripId = localTrip.id;
        if (!tripId) {
          tripId = (await ensureDraftInternal()) ?? 0;
        }
        if (!tripId) {
          markIdle();
          return { ok: false, kind: "submit", error: "Draft could not be created." };
        }

        localTrip = { ...localTrip, ...tripPatch };
        await this.flushAutosave();

        const submitPayload = {
          ...localTrip,
          startTime: tripPatch.startTime || new Date().toLocaleString(),
        };
        const saved = await submitStep1(tripId, submitPayload);
        const submitted = normalizeLoadedStep1Trip({
          ...localTrip,
          ...saved,
          startTime: saved.startTime || submitPayload.startTime,
          startStepSubmitted: true,
        });

        localTrip = submitted;
        persistSnapshot = snapshotFromTrip(submitted);
        const sync = extractSyncMetadata(saved);
        options.onTripLoaded?.(submitted);
        options.onTripIdAssigned?.(saved.id);
        markSaved();

        return { ok: true, kind: "submit", trip: submitted, sync };
      } catch (err) {
        if (isConflictError(err) && localTrip.id) {
          try {
            const fresh = await loadTripById(localTrip.id);
            applyFullLoad(fresh);
          } catch {
            /* ignore reload failure */
          }
        }
        const message = handleApiError(err);
        notify(message, "error");
        markIdle();
        return { ok: false, kind: "submit", conflict: isConflictError(err), error: message };
      }
    },

    reset() {
      this.cancelScheduledAutosave();
      if (savedIndicatorTimer) {
        clearTimeout(savedIndicatorTimer);
        savedIndicatorTimer = null;
      }
      persistSnapshot = null;
      operationQueue.reset();
      ensureDraftPromise = null;
      markIdle();
    },

    dispose() {
      this.reset();
      statusListeners.clear();
    },
  };
}
