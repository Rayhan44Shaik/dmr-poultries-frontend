// src/modules/auth/tokenStore.ts
// -----------------------------------------------------------------------------
// Bearer-token + signed-in-user persistence for the desktop session. Kept as
// its own tiny module so the API client can read the token without importing
// the whole auth API (and vice versa) — no import cycle.
//
// STORAGE-PROOF: the app often runs inside a preview iframe where localStorage
// can be partitioned — or blocked outright (Safari ITP, sandboxed frames,
// private mode). Every access below therefore falls back to an in-memory bag:
// sign-in always WORKS for the current document even when storage is hostile.
// The only loss in that case is the session not surviving a full reload.
// -----------------------------------------------------------------------------

import type { AuthenticatedUser } from "./authApi";

export const AUTH_TOKEN_KEY = "dmr-auth-token";
export const AUTH_USER_KEY = "dmr-auth-user";

/**
 * In-memory layer, ALWAYS consulted FIRST: it holds the newest values, so a
 * read can never return a stale storage copy over a freshly written one.
 * Some browsers (privacy modes, sandboxed frames) allow localStorage READS
 * but throw on WRITES — there, a storage-first read would keep serving a
 * long-dead token while the fresh one sits in a lower layer, and every API
 * call would 401 straight after a successful sign-in.
 */
const memoryBag = new Map<string, string>();

/** Layers that ever failed a write are masked on reads from then on. */
const UNRELIABLE = { ls: false, ss: false };
const LS_BAD_KEY = "dmr-ls-unreliable";
const SS_BAD_KEY = "dmr-ss-unreliable";

// Hydrate the masks (a previous document may have marked a layer bad).
try {
  if (sessionStorage.getItem(SS_BAD_KEY) === "1") UNRELIABLE.ss = true;
} catch {
  UNRELIABLE.ss = true; // unreadable → unusable
}
try {
  if (sessionStorage.getItem(LS_BAD_KEY) === "1") UNRELIABLE.ls = true;
} catch {
  // sessionStorage unreadable — localStorage may still be fine
}

function markUnreliable(which: "ls" | "ss"): void {
  UNRELIABLE[which] = true;
  const flagKey = which === "ls" ? LS_BAD_KEY : SS_BAD_KEY;
  try {
    sessionStorage.setItem(flagKey, "1");
  } catch {
    // masks live in memory for this document then
  }
}

function readBag(key: string): string | null {
  const fresh = memoryBag.get(key);
  if (fresh != null) return fresh;
  if (!UNRELIABLE.ls) {
    try {
      const value = localStorage.getItem(key);
      if (value != null) return value;
    } catch {
      markUnreliable("ls");
    }
  }
  if (!UNRELIABLE.ss) {
    try {
      const value = sessionStorage.getItem(key);
      if (value != null) return value;
    } catch {
      markUnreliable("ss");
    }
  }
  return null;
}

function writeBag(key: string, value: string | null): void {
  if (value == null) {
    // Removal must clear EVERY layer (the key may exist in several).
    memoryBag.delete(key);
    if (!UNRELIABLE.ls) {
      try {
        localStorage.removeItem(key);
      } catch {
        markUnreliable("ls");
      }
    }
    if (!UNRELIABLE.ss) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        markUnreliable("ss");
      }
    }
    return;
  }
  // Mirror into every working layer — whichever survives the reload serves
  // the value; memory keeps this document exact in the meantime.
  memoryBag.set(key, value);
  if (!UNRELIABLE.ls) {
    try {
      localStorage.setItem(key, value);
    } catch {
      markUnreliable("ls");
    }
  }
  if (!UNRELIABLE.ss) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      markUnreliable("ss");
    }
  }
}

export function getStoredToken(): string | null {
  return readBag(AUTH_TOKEN_KEY);
}

export function storeToken(token: string | null | undefined): void {
  writeBag(AUTH_TOKEN_KEY, token || null);
}

/**
 * The signed-in user, cached at login. On boot the app restores THIS instantly
 * (no network, no splash) and revalidates against /auth/me in the background —
 * so a slow or hiccuping backend can never bounce a signed-in user back to
 * the sign-in screen.
 */
export function getCachedUser(): AuthenticatedUser | null {
  const raw = readBag(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<AuthenticatedUser>;
    if (typeof value?.username !== "string" || typeof value?.role !== "string") return null;
    return {
      id: Number(value.id ?? 0),
      username: String(value.username),
      displayName: String(value.displayName ?? value.username),
      role: value.role as AuthenticatedUser["role"],
      employeeId: value.employeeId == null ? null : Number(value.employeeId),
    };
  } catch {
    return null;
  }
}

export function setCachedUser(user: AuthenticatedUser): void {
  writeBag(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearCachedUser(): void {
  writeBag(AUTH_USER_KEY, null);
}

/** Drop every client-side session artefact (storage AND the memory bag). */
export function clearSession(): void {
  storeToken(null);
  clearCachedUser();
}
