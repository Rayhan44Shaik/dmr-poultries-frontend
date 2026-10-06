import { apiClient } from "../../api/client";

export type AppRole = "OWNER" | "SENIOR_ACCOUNT" | "SUPERVISOR";
export type AuthenticatedUser = {
  id: number;
  username: string;
  displayName: string;
  role: AppRole;
  employeeId: number | null;
};

export { AUTH_TOKEN_KEY, getStoredToken, storeToken } from "./tokenStore";
import { storeToken } from "./tokenStore";

/**
 * The API may spell roles `Owner` / `owner` / `SUPERVISOR` depending on the
 * backend generation — normalise to the AppRole union.
 */
export function normalizeRole(value: unknown): AppRole {
  const raw = String(value ?? "").toUpperCase();
  if (raw.includes("SUPERVISOR")) return "SUPERVISOR";
  if (raw.includes("ACCOUNT")) return "SENIOR_ACCOUNT";
  return "OWNER";
}

/** The login/me payloads across backend generations spell fields loosely. */
type RawUser = {
  id?: unknown;
  username?: unknown;
  displayName?: unknown;
  name?: unknown;
  role?: unknown;
  employeeId?: unknown;
};

function normalizeUser(value: RawUser | null | undefined): AuthenticatedUser {
  return {
    id: Number(value?.id ?? 0),
    username: String(value?.username ?? ""),
    displayName: String(value?.displayName ?? value?.name ?? value?.username ?? "User"),
    role: normalizeRole(value?.role),
    employeeId: value?.employeeId == null ? null : Number(value.employeeId),
  };
}

/**
 * Single-flight map: concurrent callers with the same key share one in-flight
 * promise instead of issuing parallel requests. The slot clears when the
 * promise settles, so legitimate retries after completion are never blocked.
 * Used for login (per-username), /auth/me (singleton) and logout.
 */
export function singleFlight<K, V>(slots: Map<K, Promise<V>>, key: K, start: () => Promise<V>): Promise<V> {
  const existing = slots.get(key);
  if (existing) return existing;
  const pending = start();
  slots.set(key, pending);
  const release = () => {
    if (slots.get(key) === pending) slots.delete(key);
  };
  pending.then(release, release);
  return pending;
}

// Duplicate-login protection: one user action must create one logical login
// request. Concurrent loginRequest calls for the SAME username (double-click,
// Enter pressed twice, React remount, automatic retry) share a single
// in-flight promise instead of issuing parallel POST /auth/login calls.
const inflightLogins = new Map<string, Promise<LoginResult>>();

export type LoginResult =
  | { mfaRequired: true; mfaTicket: string; user: AuthenticatedUser }
  | { mfaRequired?: false; user: AuthenticatedUser; expiresAt?: string; previousSessionsEnded: boolean };

export async function loginRequest(username: string, password: string): Promise<LoginResult> {
  const key = username.trim().toLowerCase();
  return singleFlight(inflightLogins, key, async (): Promise<LoginResult> => {
    const response = await apiClient.post<{
      user: RawUser;
      token?: string;
      expiresAt?: string;
      previousSessionsEnded?: boolean;
      mfaRequired?: boolean;
      mfaTicket?: string;
    }>("/auth/login", { username, password });
    if (response.data?.mfaRequired && typeof response.data?.mfaTicket === "string") {
      // Password accepted, second factor pending. No token is stored — no
      // session exists until the ticket is verified below.
      return {
        mfaRequired: true,
        mfaTicket: response.data.mfaTicket,
        user: normalizeUser(response.data?.user),
      };
    }
    // Real backend returns both HttpOnly `dmr_session` cookie and `token` in the
    // JSON body. The SPA persists Bearer [REDACTED] /api calls through the Vite proxy
    // (and Electron / cross-origin previews) keep working after reload.
    storeToken(response.data?.token ?? null);
    return {
      user: normalizeUser(response.data?.user),
      expiresAt: response.data?.expiresAt,
      previousSessionsEnded: Boolean(response.data?.previousSessionsEnded),
    };
  });
}

export async function mfaVerifyRequest(ticket: string, code: string) {
  const response = await apiClient.post<{
    user: RawUser;
    token?: string;
    expiresAt?: string;
    previousSessionsEnded?: boolean;
  }>("/auth/mfa/verify", { ticket, code });
  storeToken(response.data?.token ?? null);
  return {
    user: normalizeUser(response.data?.user),
    expiresAt: response.data?.expiresAt,
    previousSessionsEnded: Boolean(response.data?.previousSessionsEnded),
  };
}

export async function mfaStatusRequest(): Promise<{ enabled: boolean }> {
  const response = await apiClient.get<{ enabled: boolean }>("/auth/mfa/status");
  return { enabled: Boolean(response.data?.enabled) };
}

export async function mfaEnrollRequest(): Promise<{ secret: string; otpauthUrl: string }> {
  const response = await apiClient.post<{ secret: string; otpauthUrl: string }>("/auth/mfa/enroll");
  return { secret: String(response.data?.secret ?? ""), otpauthUrl: String(response.data?.otpauthUrl ?? "") };
}

export async function mfaConfirmRequest(code: string): Promise<{ recoveryCodes: string[] }> {
  const response = await apiClient.post<{ recoveryCodes: string[] }>("/auth/mfa/confirm", { code });
  return { recoveryCodes: Array.isArray(response.data?.recoveryCodes) ? response.data.recoveryCodes : [] };
}

export async function mfaDisableRequest(code: string): Promise<void> {
  await apiClient.post("/auth/mfa/disable", { code });
}

export async function mfaAdminResetRequest(userId: number): Promise<void> {
  await apiClient.post(`/auth/mfa/reset/${userId}`);
}

export async function currentUserRequest(): Promise<AuthenticatedUser> {
  // Session restore should never hold the splash hostage: 8s is plenty for a
  // LAN/localhost backend — a hung one fails into the sign-in screen instead
  // of spinning for the full 30s default.
  const response = await apiClient.get<{ user: RawUser }>("/auth/me", { timeout: 8000 });
  return normalizeUser(response.data?.user);
}

// Single-flight /auth/me: a burst of 401s (or several mounted guards) must
// produce ONE validation request, not N parallel probes. Concurrent callers
// share the same promise; the slot clears when it settles.
const inflightMe = new Map<string, Promise<AuthenticatedUser>>();

export function currentUserShared(): Promise<AuthenticatedUser> {
  return singleFlight(inflightMe, "me", () => currentUserRequest());
}

/**
 * Genuine-activity ping — the ONLY request that extends the server-side idle
 * deadline. Called throttled from IdleSessionGuard on real user interaction.
 * Never awaited for UI: a failed ping (offline, timeout, 5xx) must NEVER log
 * the user out; the next ping or /auth/me re-check resolves the truth.
 */
export function activityPing(): void {
  try {
    void apiClient.post("/auth/activity").catch(() => undefined);
  } catch {
    // fire-and-forget by design
  }
}

// Duplicate-logout protection: concurrent logout calls (double-click logout,
// logout raced with idle expiry, multi-tab teardown) share one in-flight
// POST; the local token is cleared exactly once either way.
const inflightLogout = new Map<string, Promise<void>>();

export async function logoutRequest(): Promise<void> {
  return singleFlight(inflightLogout, "logout", async () => {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      // The session is dead on our side either way.
      storeToken(null);
    }
  });
}

export async function changePasswordRequest(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post("/auth/change-password", { currentPassword, newPassword });
}

export async function forgotPasswordRequest(username: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>("/auth/forgot-password", { username });
  return { message: String(response.data?.message ?? "") };
}

export async function resetPasswordRequest(token: string, newPassword: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>("/auth/reset-password", { token, newPassword });
  return { message: String(response.data?.message ?? "") };
}
