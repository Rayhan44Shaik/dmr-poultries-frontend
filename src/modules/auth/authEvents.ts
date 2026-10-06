// src/modules/auth/authEvents.ts
// -----------------------------------------------------------------------------
// Cross-tab auth event bus (PDF 6.1/6.5).
//
// BroadcastChannel is the primary transport (fast, same-origin tabs);
// localStorage storage-events are the fallback (older contexts, and the
// persisted activity timestamp other tabs adopt on boot).
//
// Events: SESSION_ESTABLISHED, USER_ACTIVITY, SESSION_LOGOUT,
// SESSION_EXPIRED, PASSWORD_CHANGED. Handlers must be idempotent — events
// can arrive twice (once per transport).
// -----------------------------------------------------------------------------

export type AuthEventKind =
  | "SESSION_ESTABLISHED"
  | "USER_ACTIVITY"
  | "SESSION_LOGOUT"
  | "SESSION_EXPIRED"
  | "PASSWORD_CHANGED";

export interface AuthEvent {
  kind: AuthEventKind;
  at: number;
  username?: string;
}

const CHANNEL = "dmr-auth-v1";
export const ACTIVITY_KEY = "dmr:last-activity";
const LOGOUT_KEY = "dmr:logout-event";

type Listener = (event: AuthEvent) => void;
const listeners = new Set<Listener>();

let channel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(CHANNEL);
} catch {
  channel = null;
}

function dispatch(event: AuthEvent): void {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch {
      // One bad listener must not break the bus.
    }
  }
}

if (typeof window !== "undefined") {
  channel?.addEventListener("message", (message) => {
    const event = message.data as AuthEvent | null;
    if (!event || typeof event.kind !== "string" || !Number.isFinite(event.at)) return;
    if (event.kind === "USER_ACTIVITY") mirrorActivity(event.at);
    dispatch(event);
  });
  // Storage fallback: logout + activity propagated as storage events.
  window.addEventListener("storage", (storage) => {
    if (storage.key === LOGOUT_KEY && storage.newValue) {
      try {
        const event = JSON.parse(storage.newValue) as AuthEvent;
        if (event && typeof event.kind === "string") dispatch({ ...event, at: Number(event.at) || Date.now() });
      } catch {
        dispatch({ kind: "SESSION_LOGOUT", at: Date.now() });
      }
      return;
    }
    if (storage.key === ACTIVITY_KEY && storage.newValue) {
      const at = Number(storage.newValue);
      if (Number.isFinite(at)) {
        mirrorActivity(at);
        dispatch({ kind: "USER_ACTIVITY", at });
      }
    }
  });
}

/** Best-effort mirror of the shared activity clock (never throws). */
function mirrorActivity(at: number): void {
  try {
    const current = Number(localStorage.getItem(ACTIVITY_KEY));
    if (!Number.isFinite(current) || at > current) localStorage.setItem(ACTIVITY_KEY, String(at));
  } catch {
    // storage unavailable — local clock only
  }
}

export function publishAuthEvent(kind: AuthEventKind, username?: string): AuthEvent {
  const event: AuthEvent = { kind, at: Date.now(), username };
  try {
    channel?.postMessage(event);
  } catch {
    // fallback below covers delivery
  }
  try {
    if (kind === "USER_ACTIVITY") {
      mirrorActivity(event.at);
      localStorage.setItem(ACTIVITY_KEY, String(event.at));
    } else if (kind === "SESSION_LOGOUT" || kind === "SESSION_EXPIRED" || kind === "PASSWORD_CHANGED") {
      localStorage.setItem(LOGOUT_KEY, JSON.stringify(event));
      localStorage.removeItem(LOGOUT_KEY);
    }
  } catch {
    // broadcast is best-effort
  }
  return event;
}

export function subscribeAuthEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Read the shared activity clock (sibling-tab activity included). */
export function readSharedActivity(): number | null {
  try {
    const at = Number(localStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(at) ? at : null;
  } catch {
    return null;
  }
}
