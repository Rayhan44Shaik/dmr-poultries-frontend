/**
 * =============================================================================
 * GLOBAL NOTIFICATION STORE
 * =============================================================================
 * ONE notification system for the whole application.
 *
 * WHY THIS EXISTS
 *   The project previously had five parallel implementations:
 *     • providers/NotificationProvider   — a *blocking* centred modal + backdrop
 *     • components/common/ToastProvider  — top-right toasts
 *     • modules/accounts/hooks/useToast  — console.log only (no UI at all)
 *     • modules/fleet-operations/…       — local state nobody rendered
 *     • modules/settings/hooks           — local state nobody rendered
 *   Three of them produced no visible feedback whatsoever, none supported
 *   "warning", and the two real ones could both fire for one action.
 *
 *   This module-level store is the single renderer's data source. Every
 *   existing hook (`useNotification`, `useToast`, and the three module hooks)
 *   is now a thin adapter over it, so all call sites keep working unchanged
 *   while the app gains one consistent, non-blocking, deduplicating system.
 *
 * GUARANTEES
 *   • Non-blocking — never a modal, never `alert()`, never steals focus.
 *   • Deduplicated — an identical (tone + message) already on screen refreshes
 *     its timer instead of stacking a second copy. One action → one toast.
 *   • Bounded — at most MAX_VISIBLE on screen; the oldest is retired first.
 *   • Deterministic — `getSnapshot()` returns a stable reference unless the
 *     list actually changed, so `useSyncExternalStore` never re-renders in a
 *     loop and the host never remounts.
 *   • Provider-independent — works even if no provider is mounted, which makes
 *     the old `alert()` fallback path unreachable.
 * =============================================================================
 */

export type NotificationTone = "success" | "error" | "warning" | "info";

export interface NotificationItem {
  readonly id: string;
  readonly tone: NotificationTone;
  readonly message: string;
  /** Optional secondary line (e.g. a record identifier). */
  readonly description?: string;
  /** Epoch ms when it was first shown — used for stable ordering. */
  readonly createdAt: number;
}

/** How many notifications may be on screen at once. */
const MAX_VISIBLE = 4;

/** Per-tone lifetime. Errors linger longest; successes are brief. */
const DURATION_MS: Record<NotificationTone, number> = {
  success: 3500,
  info: 4000,
  warning: 5000,
  error: 6500,
};

/* ---------------------------------------------------------------------------
 * Internal state
 * ------------------------------------------------------------------------- */

let items: readonly NotificationItem[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Maps a dedupe key to the id currently on screen for it. */
const keyToId = new Map<string, string>();
let seq = 0;

function emit(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A broken subscriber must never prevent the others from updating.
    }
  }
}

function clearTimer(id: string): void {
  const existing = timers.get(id);
  if (existing !== undefined) {
    clearTimeout(existing);
    timers.delete(id);
  }
}

/** Remove an item without animation bookkeeping. */
function removeById(id: string): void {
  clearTimer(id);
  const removed = items.find((item) => item.id === id);
  if (removed) {
    for (const [key, mapped] of keyToId) {
      if (mapped === id) keyToId.delete(key);
    }
  }
  items = items.filter((item) => item.id !== id);
}

function scheduleDismiss(id: string, duration: number): void {
  clearTimer(id);
  if (!Number.isFinite(duration) || duration <= 0) return;
  timers.set(
    id,
    setTimeout(() => {
      dismiss(id);
    }, duration),
  );
}

/* ---------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------- */

export interface PushOptions {
  /** Auto-dismiss delay in ms. Omit for the tone default; `0` pins it. */
  duration?: number;
  /** Optional secondary line. */
  description?: string;
}

/**
 * Show a notification.
 *
 * Identical tone + message already visible ⇒ its timer is refreshed and NO
 * second toast is created. This is what stops one save from producing three
 * notifications when several components react to the same operation.
 */
export function push(
  message: string,
  tone: NotificationTone = "info",
  options: PushOptions = {},
): string {
  const text = (message ?? "").toString().trim();
  // Never render an empty toast.
  if (!text) return "";

  const key = `${tone}::${text}`;
  const existingId = keyToId.get(key);

  if (existingId !== undefined && items.some((i) => i.id === existingId)) {
    // Same notification already on screen: refresh, don't duplicate.
    const duration = options.duration ?? DURATION_MS[tone];
    scheduleDismiss(existingId, duration);
    return existingId;
  }

  seq += 1;
  const id = `n${seq}`;
  const item: NotificationItem = {
    id,
    tone,
    message: text,
    description: options.description,
    createdAt: Date.now(),
  };

  keyToId.set(key, id);

  // Enforce the cap by retiring the oldest first (deterministic, no thrash).
  let next: NotificationItem[] = [...items, item];
  while (next.length > MAX_VISIBLE) {
    const oldest = next[0];
    next = next.slice(1);
    clearTimer(oldest.id);
    for (const [k, mapped] of keyToId) {
      if (mapped === oldest.id) keyToId.delete(k);
    }
  }
  items = next;
  emit();

  scheduleDismiss(id, options.duration ?? DURATION_MS[tone]);
  return id;
}

/** Convenience helpers matching the tone vocabulary used across the app. */
export const notify = {
  success: (message: string, options?: PushOptions) => push(message, "success", options),
  error: (message: string, options?: PushOptions) => push(message, "error", options),
  warning: (message: string, options?: PushOptions) => push(message, "warning", options),
  info: (message: string, options?: PushOptions) => push(message, "info", options),
};

/** Dismiss one notification. Safe to call for an id that is already gone. */
export function dismiss(id: string): void {
  if (!id) return;
  const existed = items.some((item) => item.id === id);
  removeById(id);
  if (existed) emit();
}

/**
 * Dismiss everything on screen.
 * Used by the legacy `hideNotification()` API and by Escape.
 */
export function dismissAll(): void {
  if (items.length === 0) return;
  for (const item of items) clearTimer(item.id);
  items = [];
  keyToId.clear();
  emit();
}

/** Dismiss the most recently shown notification (legacy single-slot parity). */
export function dismissLatest(): void {
  const last = items[items.length - 1];
  if (last) dismiss(last.id);
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Stable snapshot for `useSyncExternalStore`.
 * The array reference only changes when the contents change.
 */
export function getSnapshot(): readonly NotificationItem[] {
  return items;
}

/** Number currently visible (useful for tests/diagnostics). */
export function count(): number {
  return items.length;
}

/** Test/maintenance helper: drop all timers and state synchronously. */
export function __resetForTests(): void {
  for (const id of [...timers.keys()]) clearTimer(id);
  items = [];
  keyToId.clear();
  seq = 0;
  emit();
}
