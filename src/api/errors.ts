import { AxiosError, isAxiosError } from "axios";
import { logger } from "../logger/logger";
import { AppError } from "../errors/ErrorHandler";
import type { ApiErrorBody } from "./types";

/**
 * Normalized API error used by the Axios layer.
 * Extends the shared AppError so existing handleError() still works.
 */
export class ApiError extends AppError {
  public details?: unknown;
  public url?: string;
  public method?: string;
  public requestId?: string;

  constructor(
    message: string,
    options: {
      code?: string;
      status?: number;
      details?: unknown;
      url?: string;
      method?: string;
      requestId?: string;
    } = {}
  ) {
    super(message, options.code ?? "API_ERROR", options.status);
    this.name = "ApiError";
    this.details = options.details;
    this.url = options.url;
    this.method = options.method;
    this.requestId = options.requestId;
  }
}

/**
 * Strict error taxonomy. ONLY the AUTH_* codes may ever trigger session
 * eviction, and only after authoritative server confirmation (/auth/me
 * re-check in AuthProvider). Timeouts, 502/503/504, and network errors must
 * NEVER log the user out.
 */
export type ApiErrorCode =
  | "AUTH_INVALID"
  | "AUTH_REVOKED"
  | "AUTH_EXPIRED"
  | "FORBIDDEN"
  | "NETWORK_ERROR"
  | "OFFLINE"
  | "TIMEOUT"
  | "SERVER_500"
  | "SERVER_502"
  | "SERVER_503"
  | "SERVER_504"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "CANCELED"
  | "UNKNOWN_ERROR";

export function isAuthFailureCode(code: string | undefined): boolean {
  return code === "AUTH_INVALID" || code === "AUTH_REVOKED" || code === "AUTH_EXPIRED";
}

/** A timeout / 5xx / network error must NEVER trigger logout. */
export function isRecoverableTransportCode(code: string | undefined): boolean {
  return (
    code === "NETWORK_ERROR" ||
    code === "OFFLINE" ||
    code === "TIMEOUT" ||
    code === "SERVER_500" ||
    code === "SERVER_502" ||
    code === "SERVER_503" ||
    code === "SERVER_504"
  );
}

function serverAuthCode(body: unknown): ApiErrorCode | null {
  if (!body || typeof body !== "object") return null;
  const code = String((body as { code?: unknown }).code ?? "").toUpperCase();
  if (code === "AUTH_EXPIRED") return "AUTH_EXPIRED";
  if (code === "AUTH_REVOKED") return "AUTH_REVOKED";
  if (code === "AUTH_INVALID") return "AUTH_INVALID";
  if (code === "FORBIDDEN") return "FORBIDDEN";
  if (code === "RATE_LIMITED") return "RATE_LIMITED";
  return null;
}

function messageFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const data = body as ApiErrorBody;
  // The HUMAN message travels in `message`; `error` is the machine code
  // (e.g. "invalid_credentials") — never show the code to the user.
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  if (typeof data.error === "string" && data.error.trim()) return data.error;
  return null;
}

/** Map an HTTP status (+ optional server code) to the strict taxonomy. */
export function classifyStatus(status: number | undefined, body: unknown): ApiErrorCode {
  const server = serverAuthCode(body);
  if (server) return server;
  switch (status) {
    case 400:
    case 422:
      return "VALIDATION_ERROR";
    case 401:
      return "AUTH_INVALID";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMITED";
    case 500:
      return "SERVER_500";
    case 502:
      return "SERVER_502";
    case 503:
      return "SERVER_503";
    case 504:
      return "SERVER_504";
    default:
      if (status != null && status >= 500) return "SERVER_500";
      return "UNKNOWN_ERROR";
  }
}

/**
 * Convert any thrown value (Axios or otherwise) into an ApiError.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (isAxiosError(error)) {
    const axiosErr = error as AxiosError<ApiErrorBody>;
    const status = axiosErr.response?.status;
    const bodyMessage = messageFromBody(axiosErr.response?.data);
    const method = axiosErr.config?.method?.toUpperCase();
    const url = axiosErr.config?.url;
    // Correlation ID attached by the backend (X-Request-Id) — carried for
    // diagnostics and user-facing "Reference: <id>" messages. Never sensitive.
    const headers = axiosErr.response?.headers as Record<string, unknown> | undefined;
    const rawRequestId = headers?.["x-request-id"];
    const requestId = typeof rawRequestId === "string" && rawRequestId.trim() ? rawRequestId.trim() : undefined;

    if (axiosErr.code === "ECONNABORTED" || /timeout/i.test(String(axiosErr.message ?? ""))) {
      return new ApiError("Request timed out. Please try again.", {
        code: "TIMEOUT",
        status,
        url,
        method,
        requestId,
      });
    }

    if (axiosErr.code === "ERR_CANCELED" || axiosErr.name === "CanceledError") {
      return new ApiError("Request cancelled.", {
        code: "CANCELED",
        status,
        url,
        method,
        requestId,
      });
    }

    if (!axiosErr.response) {
      const offline =
        (typeof navigator !== "undefined" && navigator.onLine === false) ||
        /offline|failed to fetch|network error|dns|econnreset|enotfound|socket/i.test(
          String(axiosErr.message ?? "")
        );
      return new ApiError(
        offline
          ? "You appear to be offline. Your work is preserved — reconnect and retry."
          : "Unable to reach the server. Check that the backend is running.",
        {
          code: offline ? "OFFLINE" : "NETWORK_ERROR",
          status,
          url,
          method,
          requestId,
        }
      );
    }

    const code = classifyStatus(status, axiosErr.response?.data);
    const fallback =
      code === "AUTH_INVALID" || code === "AUTH_EXPIRED" || code === "AUTH_REVOKED"
        ? "Unauthorized. Please sign in again."
        : code === "FORBIDDEN"
          ? "You do not have permission to perform this action."
          : code === "NOT_FOUND"
            ? "The requested resource was not found."
            : code === "CONFLICT"
              ? "Conflict while saving. Please refresh and try again."
              : code === "VALIDATION_ERROR"
                ? "The request could not be processed."
                : code === "RATE_LIMITED"
                  ? "Too many requests. Please wait and try again."
                  : isRecoverableTransportCode(code)
                    ? "Server error. Please try again later."
                    : "Request failed. Please try again.";

    return new ApiError(bodyMessage ?? fallback, {
      code,
      status,
      details: axiosErr.response.data,
      url,
      method,
      requestId,
    });
  }

  if (error instanceof Error) {
    return new ApiError(error.message, { code: "UNKNOWN_ERROR" });
  }

  return new ApiError("Something went wrong. Please try again.", {
    code: "UNKNOWN_ERROR",
  });
}

/**
 * Common API error handler: log + return a user-facing message.
 * Safe to call from services later without changing UI yet.
 */
export function isCanceledError(error: unknown): boolean {
  const apiError = error instanceof ApiError ? error : toApiError(error);
  return apiError.code === "CANCELED";
}

const loggedApiErrors = new WeakSet<ApiError>();

export function handleApiError(error: unknown): string {
  const apiError = toApiError(error);
  if (apiError.code === "CANCELED") return apiError.message;
  if (!loggedApiErrors.has(apiError)) {
    loggedApiErrors.add(apiError);
    logger.error(
      `[API ${apiError.code ?? "ERROR"}] ${apiError.method ?? ""} ${apiError.url ?? ""} → ${apiError.message}${apiError.requestId ? ` (ref ${apiError.requestId})` : ""}`,
      apiError.details
    );
  }
  return apiError.message;
}

/**
 * Re-throw as ApiError after logging (for callers that prefer throw).
 */
export function throwApiError(error: unknown): never {
  const apiError = toApiError(error);
  handleApiError(apiError);
  throw apiError;
}
