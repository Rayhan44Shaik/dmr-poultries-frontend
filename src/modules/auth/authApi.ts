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

export async function loginRequest(username: string, password: string) {
  const response = await apiClient.post<{ user: RawUser; token?: string; expiresAt?: string }>(
    "/auth/login",
    { username, password },
  );
  // The bearer token drives /auth/me after reloads and every API call.
  storeToken(response.data?.token ?? null);
  return { user: normalizeUser(response.data?.user), expiresAt: response.data?.expiresAt };
}

export async function currentUserRequest(): Promise<AuthenticatedUser> {
  // Session restore should never hold the splash hostage: 8s is plenty for a
  // LAN/localhost backend — a hung one fails into the sign-in screen instead
  // of spinning for the full 30s default.
  const response = await apiClient.get<{ user: RawUser }>("/auth/me", { timeout: 8000 });
  return normalizeUser(response.data?.user);
}

export async function logoutRequest(): Promise<void> {
  try {
    await apiClient.post("/auth/logout");
  } finally {
    // The session is dead on our side either way.
    storeToken(null);
  }
}
