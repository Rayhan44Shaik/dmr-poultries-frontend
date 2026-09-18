import { toApiError } from "../../../api";

/** Convert API failures into actionable Orders copy without leaking internals. */
export function ordersErrorMessage(error: unknown): string {
  const apiError = toApiError(error);
  const message = apiError.message.trim();
  const lower = message.toLowerCase();

  if (/\b(sql|postgres|relation|column|constraint|syntax error|stack trace)\b/i.test(message)) {
    return "The server could not complete this request. Please try again or contact support.";
  }
  if (apiError.status === 401) return "Your session has expired. Sign in again and retry.";
  if (apiError.status === 403) return "You do not have permission to update orders.";
  if (apiError.status === 409 || lower.includes("modified by another")) {
    return "This order changed in another session. The latest data will be loaded; review it and try again.";
  }
  if (/trip\s+\d+\s+not found/i.test(message)) {
    return "Unable to save this order because the trip is no longer available. Refresh and try again.";
  }
  if (lower.includes("capacity") && lower.includes("exceed")) return message;
  if (lower.includes("invalid shop") || lower.includes("shop") && lower.includes("not found")) {
    return "The selected shop is no longer valid. Refresh the order list.";
  }
  if (apiError.code === "TIMEOUT") {
    return "The request timed out. Refresh first to check whether it was saved before retrying.";
  }
  if (apiError.code === "NETWORK_ERROR") {
    return "The server could not be reached. Check your connection, then refresh before retrying.";
  }
  return message || "The order could not be saved. Refresh and try again.";
}
