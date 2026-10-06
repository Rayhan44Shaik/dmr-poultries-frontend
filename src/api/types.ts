/**
 * Shared API types for the Axios client layer.
 * Does not replace domain models — only transport shapes.
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestOptions {
  /** Extra headers for a single request */
  headers?: Record<string, string>;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Query string params */
  params?: Record<string, unknown>;
  /** Override timeout (ms) for this request */
  timeout?: number;
  /**
   * Opt-in per request: do not console-log a 404 (endpoint legitimately
   * absent in this environment, e.g. an optional background warm-up).
   * The error is still THROWN unchanged — only the log line is suppressed,
   * and every other status (401/403/500/network…) logs exactly as before.
   */
  quiet404?: boolean;
}

export interface ApiErrorBody {
  error?: string;
  message?: string;
  code?: string;
  details?: unknown;
}

export interface ApiResult<T> {
  data: T;
  status: number;
}
