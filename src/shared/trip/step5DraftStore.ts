// src/shared/trip/step5DraftStore.ts
//
// Durable local persistence for the Step 5 (Expenses / End) editor.
//
// Two things live here, both keyed by the PERMANENT Trip ID (never a temporary
// component key), each in its own localforage record:
//
//   1. Step5Draft   — the user's currently-entered Step 5 sheet fields plus the
//                     metadata needed for deterministic reconciliation
//                     (localRevision, updatedAt, dirty, baseServerRevision).
//   2. Step5QueuedSave — at most ONE durable "Save Progress" operation per trip,
//                     retried when connectivity returns.
//
// This is a small, self-contained abstraction. It deliberately does NOT import
// the supervisor-mobile modules (which are owner-scoped and coupled to mobile
// UI); it reuses their proven concepts — localforage, a per-key serialized
// mutation chain, SYNCING->PENDING crash recovery, idempotent op ids, bounded
// backoff — in a desktop-Trip-Entry-shaped form.
//
// The draft NEVER carries submission state: no endStepSubmitted /
// expensesStepSubmitted / status / official submittedAt. Those stay
// server-authoritative (see step5 final submit).

import localforage from "localforage";

const DRAFT_VERSION = 1 as const;

const store = localforage.createInstance({
  name: "dmr-poultries",
  storeName: "trip_step5_draft",
  description: "Durable Step 5 (Expenses/End) working draft + offline Save Progress queue, keyed by Trip ID",
});

/** Retry ceiling and backoff for a queued Save Progress op. */
const MAX_ATTEMPTS = 8;
const BACKOFF_MS = [0, 2_000, 5_000, 10_000, 30_000, 60_000, 120_000, 300_000];

export function backoffFor(attempts: number): number {
  return BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
}

/** Every editable Step 5 field the sheet exposes, including diesel rows. */
export type Step5DraftFields = Record<string, string | number | boolean | null>;

export type Step5Draft = {
  version: typeof DRAFT_VERSION;
  tripId: number;
  tripNo: string;
  /** ALL editable Step 5 sheet fields — zero values and cleared values included. */
  fields: Step5DraftFields;
  /** Bumps on every local write; the unit of reconciliation. */
  localRevision: number;
  /** ISO, local clock — synchronization metadata ONLY, never an official time. */
  updatedAt: string;
  /** True while the draft holds edits not yet confirmed by the backend. */
  dirty: boolean;
  /** Server revision marker (Date.parse(updatedAt)) the draft was branched from. */
  baseServerRevision: number | null;
};

export type Step5QueueStatus =
  | "PENDING"
  | "SYNCING"
  | "SYNCED"
  | "FAILED_RETRYABLE"
  | "FAILED_PERMANENT";

export type Step5QueuedSave = {
  version: typeof DRAFT_VERSION;
  opId: string;
  tripId: number;
  tripNo: string;
  /** Canonical Step 5 Save Progress payload (mode "save"). */
  payload: Step5DraftFields;
  /** The draft localRevision this op represents. */
  localRevision: number;
  status: Step5QueueStatus;
  attempts: number;
  /** ISO — do not attempt again before this instant (bounded backoff). */
  nextAttemptAt: string;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
};

const draftKey = (tripId: number) => `step5-draft:${tripId}`;
const queueKey = (tripId: number) => `step5-queue:${tripId}`;

// ── Per-trip serialized mutations (read-modify-write is atomic per trip) ──────
const chains = new Map<number, Promise<unknown>>();
function serialized<T>(tripId: number, mutate: () => Promise<T>): Promise<T> {
  const prev = chains.get(tripId) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(mutate);
  chains.set(tripId, next);
  return next.finally(() => {
    if (chains.get(tripId) === next) chains.delete(tripId);
  });
}

export function newStep5OpId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `step5-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

export function serverRevisionOf(updatedAtIso: string | null | undefined): number | null {
  if (!updatedAtIso) return null;
  const t = Date.parse(updatedAtIso);
  return Number.isFinite(t) ? t : null;
}

// ─────────────────────────── Draft ──────────────────────────────────────────

function isDraft(value: unknown, tripId: number): value is Step5Draft {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<Step5Draft>;
  return d.version === DRAFT_VERSION && d.tripId === tripId && typeof d.fields === "object" && d.fields != null;
}

export async function loadStep5Draft(tripId: number): Promise<Step5Draft | null> {
  if (!(tripId > 0)) return null;
  const stored = await store.getItem<unknown>(draftKey(tripId));
  return isDraft(stored, tripId) ? stored : null;
}

/**
 * Record the current sheet state. Bumps localRevision, marks dirty. Does not
 * touch the queue. `baseServerRevision` is only set on the FIRST write of a
 * fresh draft — subsequent writes keep the base the draft branched from.
 */
export async function writeStep5Draft(
  tripId: number,
  tripNo: string,
  fields: Step5DraftFields,
  baseServerRevision: number | null
): Promise<Step5Draft> {
  return serialized(tripId, async () => {
    const existing = await loadStep5Draft(tripId);
    const draft: Step5Draft = {
      version: DRAFT_VERSION,
      tripId,
      tripNo,
      fields,
      localRevision: (existing?.localRevision ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      dirty: true,
      baseServerRevision: existing ? existing.baseServerRevision : baseServerRevision,
    };
    await store.setItem(draftKey(tripId), draft);
    return draft;
  });
}

/**
 * Mark the draft clean IFF no local edits happened since `atLocalRevision`
 * (i.e. the backend now holds exactly what the user last entered). If newer
 * edits exist the draft stays dirty — the caller should re-enqueue. Also
 * re-bases the draft onto the confirmed server revision.
 */
export async function markStep5DraftSynced(
  tripId: number,
  atLocalRevision: number,
  serverRevision: number | null
): Promise<{ stillDirty: boolean }> {
  return serialized(tripId, async () => {
    const draft = await loadStep5Draft(tripId);
    if (!draft) return { stillDirty: false };
    const stillDirty = draft.localRevision !== atLocalRevision;
    await store.setItem(draftKey(tripId), {
      ...draft,
      dirty: stillDirty,
      baseServerRevision: serverRevision ?? draft.baseServerRevision,
      updatedAt: new Date().toISOString(),
    } satisfies Step5Draft);
    return { stillDirty };
  });
}

/** Remove the draft AND the queued op — for THIS trip only. */
export async function clearStep5Draft(tripId: number): Promise<void> {
  if (!(tripId > 0)) return;
  await serialized(tripId, async () => {
    await store.removeItem(draftKey(tripId));
    await store.removeItem(queueKey(tripId));
  });
}

// ─────────────────────────── Queue ──────────────────────────────────────────

function isQueuedSave(value: unknown, tripId: number): value is Step5QueuedSave {
  if (!value || typeof value !== "object") return false;
  const q = value as Partial<Step5QueuedSave>;
  return q.version === DRAFT_VERSION && q.tripId === tripId && typeof q.opId === "string" && typeof q.payload === "object";
}

export async function loadStep5QueuedSave(tripId: number): Promise<Step5QueuedSave | null> {
  if (!(tripId > 0)) return null;
  const stored = await store.getItem<unknown>(queueKey(tripId));
  return isQueuedSave(stored, tripId) ? stored : null;
}

/**
 * Queue (or coalesce) the latest Save Progress payload for a trip. Step 5 Save
 * is a full snapshot, so only the newest payload is ever useful: an existing
 * PENDING / FAILED_RETRYABLE op is replaced in place (same opId — idempotent
 * for any attempt already dispatched) with the newer payload; a SYNCING op is
 * left alone and superseded after it resolves.
 */
export async function enqueueStep5Save(
  tripId: number,
  tripNo: string,
  payload: Step5DraftFields,
  localRevision: number
): Promise<Step5QueuedSave> {
  return serialized(tripId, async () => {
    const now = new Date().toISOString();
    const existing = await loadStep5QueuedSave(tripId);
    if (existing && existing.status === "SYNCING") {
      // A newer draft exists; leave the in-flight op, drop a fresh PENDING that
      // the flush loop will pick up once the current attempt settles.
      const superseding: Step5QueuedSave = {
        version: DRAFT_VERSION,
        opId: newStep5OpId(),
        tripId,
        tripNo,
        payload,
        localRevision,
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
        lastError: null,
      };
      // Park the superseding op under a side key so the SYNCING op keeps its slot.
      await store.setItem(`${queueKey(tripId)}:next`, superseding);
      return superseding;
    }
    const op: Step5QueuedSave = existing
      ? { ...existing, payload, localRevision, status: "PENDING", nextAttemptAt: now, updatedAt: now, lastError: null }
      : {
          version: DRAFT_VERSION,
          opId: newStep5OpId(),
          tripId,
          tripNo,
          payload,
          localRevision,
          status: "PENDING",
          attempts: 0,
          nextAttemptAt: now,
          createdAt: now,
          updatedAt: now,
          lastError: null,
        };
    await store.setItem(queueKey(tripId), op);
    await store.removeItem(`${queueKey(tripId)}:next`);
    return op;
  });
}

/** Crash recovery: a SYNCING op means the app closed mid-attempt — make it retryable. */
export async function recoverStep5Queue(tripId: number): Promise<Step5QueuedSave | null> {
  return serialized(tripId, async () => {
    const op = await loadStep5QueuedSave(tripId);
    if (!op || op.status !== "SYNCING") return op;
    const recovered: Step5QueuedSave = {
      ...op,
      status: "PENDING",
      nextAttemptAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastError: "Interrupted while syncing; safe retry scheduled.",
    };
    await store.setItem(queueKey(tripId), recovered);
    return recovered;
  });
}

export type Step5FlushOutcome = { ok: boolean; serverRevision: number | null; retryable: boolean; error?: string };

/**
 * Attempt the single queued Save Progress op for a trip, if one is due.
 * `perform` MUST be idempotent (Step 5 Save is a COALESCE upsert on the
 * backend). One active sync per trip is guaranteed by `serialized`.
 */
export async function flushStep5Queue(
  tripId: number,
  perform: (payload: Step5DraftFields) => Promise<Step5FlushOutcome>
): Promise<{ attempted: boolean; synced: boolean; op: Step5QueuedSave | null }> {
  return serialized(tripId, async () => {
    const op = await loadStep5QueuedSave(tripId);
    if (!op) return { attempted: false, synced: false, op: null };
    if (op.status === "SYNCED" || op.status === "FAILED_PERMANENT") {
      return { attempted: false, synced: op.status === "SYNCED", op };
    }
    if (Date.parse(op.nextAttemptAt) > Date.now()) {
      return { attempted: false, synced: false, op };
    }

    const syncing: Step5QueuedSave = { ...op, status: "SYNCING", updatedAt: new Date().toISOString() };
    await store.setItem(queueKey(tripId), syncing);

    let outcome: Step5FlushOutcome;
    try {
      outcome = await perform(op.payload);
    } catch (err) {
      outcome = { ok: false, serverRevision: null, retryable: true, error: (err as Error)?.message };
    }

    if (outcome.ok) {
      await store.removeItem(queueKey(tripId));
      // Promote any op parked while this one was in flight.
      const parked = (await store.getItem<unknown>(`${queueKey(tripId)}:next`)) as Step5QueuedSave | null;
      if (isQueuedSave(parked, tripId)) {
        await store.setItem(queueKey(tripId), parked);
        await store.removeItem(`${queueKey(tripId)}:next`);
      }
      const { stillDirty } = await markStep5DraftSyncedInternal(tripId, op.localRevision, outcome.serverRevision);
      return { attempted: true, synced: !stillDirty, op: null };
    }

    const attempts = op.attempts + 1;
    const permanent = !outcome.retryable || attempts >= MAX_ATTEMPTS;
    const failed: Step5QueuedSave = {
      ...op,
      status: permanent ? "FAILED_PERMANENT" : "FAILED_RETRYABLE",
      attempts,
      nextAttemptAt: new Date(Date.now() + backoffFor(attempts)).toISOString(),
      updatedAt: new Date().toISOString(),
      lastError: outcome.error ?? "Save failed",
    };
    await store.setItem(queueKey(tripId), failed);
    return { attempted: true, synced: false, op: failed };
  });
}

// markStep5DraftSynced re-acquires the per-trip lock; flushStep5Queue already
// holds it, so use a lock-free internal variant there.
async function markStep5DraftSyncedInternal(
  tripId: number,
  atLocalRevision: number,
  serverRevision: number | null
): Promise<{ stillDirty: boolean }> {
  const stored = await store.getItem<unknown>(draftKey(tripId));
  if (!isDraft(stored, tripId)) return { stillDirty: false };
  const stillDirty = stored.localRevision !== atLocalRevision;
  await store.setItem(draftKey(tripId), {
    ...stored,
    dirty: stillDirty,
    baseServerRevision: serverRevision ?? stored.baseServerRevision,
    updatedAt: new Date().toISOString(),
  } satisfies Step5Draft);
  return { stillDirty };
}

/** Test/util: wipe every Step 5 draft + queue record. */
export async function _clearAllStep5Drafts(): Promise<void> {
  const keys = await store.keys();
  await Promise.all(
    keys.filter((k) => k.startsWith("step5-draft:") || k.startsWith("step5-queue:")).map((k) => store.removeItem(k))
  );
}
