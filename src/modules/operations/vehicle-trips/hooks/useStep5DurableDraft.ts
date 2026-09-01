// src/modules/operations/vehicle-trips/hooks/useStep5DurableDraft.ts
//
// Part K — durable Step 5 (Expenses / End) draft + offline Save Progress queue.
//
// Once Step 1 has generated the permanent Trip ID, the Step 5 editor keeps a
// durable local draft keyed by that Trip ID. Unsaved edits survive browser
// refresh, component remount, tab switching and transient API/connectivity
// failures. Backend stays authoritative for persisted data; the local draft
// only ever represents NEWER unsynced edits, reconciled deterministically by
// localRevision.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearStep5Draft,
  enqueueStep5Save,
  flushStep5Queue,
  loadStep5Draft,
  loadStep5QueuedSave,
  markStep5DraftSynced,
  recoverStep5Queue,
  serverRevisionOf,
  writeStep5Draft,
  type Step5DraftFields,
  type Step5FlushOutcome,
} from "../../../../shared/trip/step5DraftStore";

/** Result of a Save Progress attempt performed by the caller. */
export type Step5SaveResult = {
  ok: boolean;
  /** Server `updatedAt` (or null); becomes the draft's rebase point on success. */
  serverUpdatedAt: string | null;
  /** true = transient (offline / network / 5xx); false = permanent (validation). */
  retryable: boolean;
  error?: string;
};

type Params = {
  tripId: number;
  tripNo: string;
  /** The trip's server `updatedAt` — the reconciliation baseline. */
  serverUpdatedAt: string | null;
  /** true once Step 1 is submitted and a permanent Trip ID exists. */
  enabled: boolean;
  /** Perform the real Save Progress call (POST /trips/:id/steps/expenses mode save). */
  performSave: (payload: Step5DraftFields) => Promise<Step5SaveResult>;
  /** Optional online detector (defaults to navigator.onLine). */
  isOnline?: () => boolean;
};

const AUTOSAVE_DEBOUNCE_MS = 500;
const RETRY_TICK_MS = 15_000;

function online(fn?: () => boolean): boolean {
  if (fn) return fn();
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

export function useStep5DurableDraft({
  tripId,
  tripNo,
  serverUpdatedAt,
  enabled,
  performSave,
  isOnline,
}: Params) {
  const active = enabled && tripId > 0;

  /** Dirty local fields to restore into the editor on mount/remount (null = use server). */
  const [restoredFields, setRestoredFields] = useState<Step5DraftFields | null>(null);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const [isOffline, setIsOffline] = useState(!online(isOnline));

  const performSaveRef = useRef(performSave);
  const serverRevRef = useRef<number | null>(serverRevisionOf(serverUpdatedAt));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestFieldsRef = useRef<Step5DraftFields | null>(null);

  // Keep the mutable refs in step with the latest props (after render, not during).
  useEffect(() => {
    performSaveRef.current = performSave;
    serverRevRef.current = serverRevisionOf(serverUpdatedAt);
  });

  const refreshPendingFlag = useCallback(async () => {
    if (!active) {
      setHasPendingSync(false);
      return;
    }
    const [draft, op] = await Promise.all([loadStep5Draft(tripId), loadStep5QueuedSave(tripId)]);
    setHasPendingSync(Boolean(draft?.dirty) || Boolean(op && op.status !== "SYNCED" && op.status !== "FAILED_PERMANENT"));
  }, [active, tripId]);

  const runFlush = useCallback(async () => {
    if (!active || !online(isOnline)) return;
    const perform = async (payload: Step5DraftFields): Promise<Step5FlushOutcome> => {
      const r = await performSaveRef.current(payload);
      return { ok: r.ok, serverRevision: serverRevisionOf(r.serverUpdatedAt), retryable: r.retryable, error: r.error };
    };
    // Keep flushing while a superseding op was parked during an in-flight attempt.
    for (let guard = 0; guard < 5; guard += 1) {
      const res = await flushStep5Queue(tripId, perform);
      if (!res.attempted) break;
      const next = await loadStep5QueuedSave(tripId);
      if (!next || next.status !== "PENDING") break;
    }
    await refreshPendingFlag();
  }, [active, tripId, isOnline, refreshPendingFlag]);

  // ── Mount / trip change: recover queue, decide whether to restore a draft ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!active) {
        if (!cancelled) {
          setRestoredFields(null);
          setHasPendingSync(false);
        }
        return;
      }
      await recoverStep5Queue(tripId);
      const draft = await loadStep5Draft(tripId);
      if (cancelled) return;
      if (draft?.dirty) {
        // Local unsaved edits win over the server-built sheet. If the server
        // advanced past the draft's base, re-base so the next save is clean —
        // the user's Step 5 edits still supersede (whole-sheet unit).
        setRestoredFields(draft.fields);
        void runFlush();
      } else {
        setRestoredFields(null);
        // A non-dirty draft that the server has moved past is obsolete.
        const base = draft?.baseServerRevision ?? null;
        if (draft && base != null && serverRevRef.current != null && serverRevRef.current > base) {
          await clearStep5Draft(tripId);
        }
      }
      await refreshPendingFlag();
    })();
    return () => {
      cancelled = true;
    };
  }, [active, tripId, runFlush, refreshPendingFlag]);

  // ── Connectivity: retry queued saves when the connection returns ──────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => {
      setIsOffline(false);
      void runFlush();
    };
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const tick = setInterval(() => {
      setIsOffline(!online(isOnline));
      void runFlush();
    }, RETRY_TICK_MS);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(tick);
    };
  }, [runFlush, isOnline]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  /** Debounced durable write of the current sheet (never one POST per keystroke). */
  const recordEdit = useCallback(
    (fields: Step5DraftFields) => {
      if (!active) return;
      latestFieldsRef.current = fields;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const snapshot = latestFieldsRef.current;
        if (!snapshot) return;
        void writeStep5Draft(tripId, tripNo, snapshot, serverRevRef.current).then(() => {
          setHasPendingSync(true);
        });
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [active, tripId, tripNo]
  );

  /**
   * Save Progress. Online: perform the real call, reconcile, clear dirty on
   * confirmed success. Offline / retryable failure: persist a durable queued
   * op and report "queued" (never claim the server save succeeded).
   */
  const saveProgress = useCallback(
    async (fields: Step5DraftFields): Promise<{ mode: "server" | "queued"; ok: boolean; error?: string }> => {
      if (!active) {
        const r = await performSaveRef.current(fields);
        return { mode: "server", ok: r.ok, error: r.error };
      }
      // Flush the debounce so the durable draft matches what we're about to save.
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const draft = await writeStep5Draft(tripId, tripNo, fields, serverRevRef.current);

      if (!online(isOnline)) {
        await enqueueStep5Save(tripId, tripNo, fields, draft.localRevision);
        setHasPendingSync(true);
        return { mode: "queued", ok: true };
      }

      let result: Step5SaveResult;
      try {
        result = await performSaveRef.current(fields);
      } catch (err) {
        result = { ok: false, serverUpdatedAt: null, retryable: true, error: (err as Error)?.message };
      }

      if (result.ok) {
        const { stillDirty } = await markStep5DraftSynced(
          tripId,
          draft.localRevision,
          serverRevisionOf(result.serverUpdatedAt)
        );
        if (stillDirty) {
          const latest = await loadStep5Draft(tripId);
          if (latest) await enqueueStep5Save(tripId, tripNo, latest.fields, latest.localRevision);
        }
        await refreshPendingFlag();
        return { mode: "server", ok: true };
      }

      if (result.retryable) {
        await enqueueStep5Save(tripId, tripNo, fields, draft.localRevision);
        setHasPendingSync(true);
        return { mode: "queued", ok: false, error: result.error };
      }
      // Permanent (validation) failure: keep the dirty draft, surface the error.
      await refreshPendingFlag();
      return { mode: "server", ok: false, error: result.error };
    },
    [active, tripId, tripNo, isOnline, refreshPendingFlag]
  );

  /** Drop this trip's draft + queue (successful final submit, or trip discarded). */
  const discardDraft = useCallback(async () => {
    if (tripId > 0) await clearStep5Draft(tripId);
    setRestoredFields(null);
    setHasPendingSync(false);
  }, [tripId]);

  return { restoredFields, saveProgress, recordEdit, discardDraft, isOffline, hasPendingSync };
}
