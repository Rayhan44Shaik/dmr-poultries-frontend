/**
 * API configuration for the DMR Poultries backend.
 * Browser requests use the same-origin /api reverse proxy by default.
 *
 * Override with VITE_API_BASE_URL in a frontend .env file when needed.
 */

const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env ?? {};

export const API_CONFIG = {
  baseURL: env.VITE_API_BASE_URL ?? "/api",
  timeoutMs: Number(env.VITE_API_TIMEOUT_MS ?? 30_000),
  // Keep the backend HttpOnly session cookie as a second authentication
  // channel. Bearer remains primary, while the cookie safely recovers a tab
  // whose persisted token became stale after a reload/tab synchronization.
  withCredentials: true,
} as const;
