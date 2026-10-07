import type { AuthenticatedUser } from "./authApi";

/** Authorization is carried exclusively by the backend-issued HttpOnly
 * SameSite cookie. These exports remain for compatibility with older call
 * sites, but never persist a credential or identity in browser storage. */
export const AUTH_TOKEN_KEY = "dmr-auth-token";
export const AUTH_USER_KEY = "dmr-auth-user";
let currentUser: AuthenticatedUser | null = null;

export function getStoredToken(): string | null { return null; }
export function storeToken(_token: string | null | undefined): void {}
export function getCachedUser(): AuthenticatedUser | null { return currentUser; }
export function setCachedUser(user: AuthenticatedUser): void { currentUser = user; }
export function clearCachedUser(): void { currentUser = null; }
export function clearSession(): void { currentUser = null; }
