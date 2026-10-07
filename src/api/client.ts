import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { logger } from "../logger/logger";
import { API_CONFIG } from "./config";
import { toApiError } from "./errors";
import { isSigningOut } from "../modules/auth/signOutGate";

declare module "axios" {
  export interface InternalAxiosRequestConfig {
    /** Set by request interceptor for duration logging */
    metadata?: { startTime: number };
  }
}

/**
 * Centralized Axios instance for all backend HTTP calls.
 * UI and localStorage services are unchanged — this is foundation only.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeoutMs,
  withCredentials: API_CONFIG.withCredentials,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

const MUTATING = new Set(["post", "put", "patch", "delete"]);

function newIdempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Request interceptor — attach auth/metadata later without touching callers */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.metadata = { startTime: Date.now() };

    // Duplicate-transaction protection: every mutation carries a unique
    // Idempotency-Key so a browser retry, double-click, or timeout replay
    // can never create a second business record for one user action.
    // Callers performing a deliberate retry of the SAME logical action reuse
    // the key by setting the header themselves.
    const method = String(config.method ?? "get").toLowerCase();
    if (MUTATING.has(method) && !config.headers["Idempotency-Key"]) {
      config.headers["Idempotency-Key"] = newIdempotencyKey();
    }

    if (import.meta.env?.DEV) {
      logger.debug(
        `[API →] ${(config.method ?? "get").toUpperCase()} ${config.baseURL ?? ""}${config.url ?? ""}`
      );
    }

    return config;
  },
  (error) => Promise.reject(toApiError(error))
);

/** Response interceptor — normalize success logging and error shape */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const started = response.config.metadata?.startTime;
    const ms = started ? Date.now() - started : undefined;

    if (import.meta.env?.DEV) {
      logger.debug(
        `[API ←] ${response.status} ${(response.config.method ?? "get").toUpperCase()} ${response.config.url ?? ""}${ms != null ? ` (${ms}ms)` : ""}`
      );
    }

    return response;
  },
  (error) => {
    // A deliberate sign-out EXPECTS companion 401s (in-flight dashboard
    // prefetches etc. after the server invalidated the token) — they must not
    // fire the session-expired event on top of the logout flow.
    const url = String(error?.config?.url ?? "");
    if (
      error?.response?.status === 401 &&
      !isSigningOut() &&
      !url.includes("/auth/login") &&
      !url.includes("/auth/logout") &&
      !url.includes("/auth/change-password") &&
      !url.includes("/auth/activity")
    ) {
      window.dispatchEvent(new Event("dmr:auth-expired"));
    }
    return Promise.reject(toApiError(error));
  }
);

export default apiClient;
