// src/modules/auth/tokenStore.ts
// Bearer-token + signed-in-user persistence for the desktop session. Kept as
// its own tiny module so the API client can read the token without importing
// the whole auth API (and vice versa) — no import cycle.

import type { AuthenticatedUser } from "./authApi";

export const AUTH_TOKEN_KEY = "dmr-auth-token";
export const AUTH_USER_KEY = "dmr-auth-user";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null | undefined): void {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // storage unavailable (private mode) — session just won't survive reloads
  }
}

/**
 * The signed-in user, cached at login. On boot the app restores THIS instantly
 * (no network, no splash) and revalidates against /auth/me in the background —
 * so a slow or hiccuping backend can never bounce a signed-in user back to
 * the sign-in screen.
 */
export function getCachedUser(): AuthenticatedUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
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
  try {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch {
    // storage unavailable — boot just falls back to the /auth/me round-trip
  }
}

export function clearCachedUser(): void {
  try {
    localStorage.removeItem(AUTH_USER_KEY);
  } catch {
    // ignore
  }
}

/** Drop every client-side session artefact. */
export function clearSession(): void {
  storeToken(null);
  clearCachedUser();
}
