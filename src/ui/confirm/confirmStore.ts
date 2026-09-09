/**
 * =============================================================================
 * GLOBAL CONFIRMATION STORE — one confirmation mechanism
 * =============================================================================
 * A promise-based, provider-independent confirmation service rendered by a
 * single `<ConfirmHost />` (mounted once in App.tsx).
 *
 * WHY PROMISE-BASED
 *   `window.confirm()` was used in several places. It is blocking, cannot be
 *   styled, ignores the design system, is not consistently announced by screen
 *   readers, and looks like a browser chrome dialog in an otherwise polished
 *   ERP. A promise API means the call sites keep their EXACT linear shape:
 *
 *       if (!(await confirmDialog({ … }))) return;
 *       // …proceed with the delete
 *
 *   so no handler had to be restructured, and the existing `deletingId` /
 *   `isSaving` guards below the guard-clause remain authoritative.
 *
 * WHY A MODULE-LEVEL STORE
 *   Confirmations are requested from plain hooks and services
 *   (`useCollectionEntry.rejectCollection`), not only from components. A store
 *   lets any module ask without threading a dialog through props — the same
 *   reasoning as the notification store.
 *
 * SINGLE-FLIGHT
 *   Only one confirmation is on screen at a time; further requests are queued
 *   in order. This matters because a double-click on Delete must never produce
 *   two dialogs and therefore never two deletes. Each queued request resolves
 *   exactly once.
 *
 * RELATIONSHIP TO THE PENDING-DELETE UNDO FLOW
 *   `PendingDeleteNotification` + `usePendingDelete` implement a deliberate
 *   *undo window* (delete is staged, a countdown runs, the user can cancel).
 *   That flow is intentionally left untouched and remains authoritative where
 *   it exists. Use `confirmDialog` for irreversible actions that have no undo
 *   window. This keeps exactly one mechanism per situation rather than stacking
 *   a confirmation on top of an undo prompt.
 * =============================================================================
 */

export type ConfirmTone = "danger" | "warning" | "primary";

export interface ConfirmOptions {
  /** Dialog title, e.g. "Delete collection". */
  title: string;
  /** Explanatory body text. Keep it concise and free of technical jargon. */
  message?: string;
  /** Identity of the affected record, shown prominently (e.g. "COL-0042 · ₹4,500"). */
  record?: string;
  /** Confirm button label. Default "Confirm". */
  confirmLabel?: string;
  /** Cancel button label. Default "Cancel". */
  cancelLabel?: string;
  /** Drives the confirm button colour. Default "danger". */
  tone?: ConfirmTone;
  /**
   * Which button receives focus on open. Default `"cancel"` for destructive
   * actions, so an accidental Enter cannot confirm a delete.
   */
  initialFocus?: "confirm" | "cancel";
}

interface ConfirmRequest {
  readonly id: number;
  readonly options: ConfirmOptions;
  readonly resolve: (confirmed: boolean) => void;
}

/** Snapshot consumed by `<ConfirmHost />` through `useSyncExternalStore`. */
export interface ConfirmState {
  /** The request currently on screen, or null. */
  readonly active: ConfirmRequest | null;
  /** Requests waiting behind it. */
  readonly pendingCount: number;
}

const EMPTY_STATE: ConfirmState = { active: null, pendingCount: 0 };

let queue: ConfirmRequest[] = [];
let state: ConfirmState = EMPTY_STATE;
const listeners = new Set<() => void>();
let seq = 0;

function emit(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A broken subscriber must not block the others.
    }
  }
}

function sync(): void {
  const active = queue[0] ?? null;
  const pendingCount = Math.max(0, queue.length - 1);
  // Only replace the snapshot when it actually differs, so
  // `useSyncExternalStore` cannot loop.
  if (state.active === active && state.pendingCount === pendingCount) return;
  state = { active, pendingCount };
  emit();
}

/**
 * Ask the user to confirm. Resolves `true` on Confirm, `false` on Cancel,
 * Escape or overlay dismissal. Never rejects.
 */
export function confirmDialog(options: ConfirmOptions | string): Promise<boolean> {
  const resolved: ConfirmOptions =
    typeof options === "string" ? { title: options } : options;

  const title = (resolved.title ?? "").toString().trim();
  if (!title) {
    // Nothing to ask about: do not show an empty dialog. Fail closed so the
    // guarded destructive action does NOT proceed.
    return Promise.resolve(false);
  }

  seq += 1;
  const id = seq;

  return new Promise<boolean>((resolve) => {
    queue = [...queue, { id, options: { ...resolved, title }, resolve }];
    sync();
  });
}

/**
 * Answer the active confirmation and advance the queue.
 * Safe to call when nothing is active.
 */
export function respondConfirm(confirmed: boolean): void {
  const active = queue[0];
  if (!active) return;
  queue = queue.slice(1);
  sync();
  // Resolve AFTER the state update so the dialog is already unmounting and the
  // caller's follow-up work (delete → refresh) cannot race the close animation.
  try {
    active.resolve(confirmed);
  } catch {
    // A throwing caller must not wedge the queue.
  }
}

/** Dismiss the active confirmation as "cancelled" without advancing further. */
export function cancelActive(): void {
  respondConfirm(false);
}

/**
 * Resolve every outstanding request as `false`.
 * Used at teardown so no `await confirmDialog(…)` can hang forever.
 */
export function cancelAll(): void {
  if (queue.length === 0) return;
  const outstanding = queue;
  queue = [];
  sync();
  for (const request of outstanding) {
    try {
      request.resolve(false);
    } catch {
      // ignore
    }
  }
}

export function subscribeConfirm(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getConfirmSnapshot(): ConfirmState {
  return state;
}

/** True while a confirmation is on screen. */
export function isConfirmActive(): boolean {
  return state.active !== null;
}

/** Test/maintenance helper. */
export function __resetConfirmForTests(): void {
  cancelAll();
  queue = [];
  state = EMPTY_STATE;
  seq = 0;
  emit();
}
