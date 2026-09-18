// src/modules/auth/tokenStore.ts
// Bearer-token persistence for the desktop session. Kept as its own tiny
// module so the API client can read the token without importing the whole
// auth API (and vice versa) — no import cycle.

export const AUTH_TOKEN_KEY = "dmr-auth-token";

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
