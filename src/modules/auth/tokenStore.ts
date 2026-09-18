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

/** Fallback bag when localStorage throws (blocked / partitioned storage). */
const memoryBag = new Map<string, string>();

function readBag(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memoryBag.get(key) ?? null;
  }
}

function writeBag(key: string, value: string | null): void {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage refused the write — keep the value for THIS document only.
    if (value == null) memoryBag.delete(key);
    else memoryBag.set(key, value);
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
