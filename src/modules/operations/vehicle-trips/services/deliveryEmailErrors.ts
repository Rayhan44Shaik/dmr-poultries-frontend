import { translate } from "../../../../i18n";

const CONFIG_MESSAGE = () =>
  translate("ops.trip.email_not_configured");

const GENERIC_MESSAGE = () =>
  translate("ops.trip.email_send_failed");

const SECRETISH = /smtp[_-]?host|smtp[_-]?user|smtp[_-]?pass|password|api[_-]?key|secret|stack/i;

export function userFacingDeliveryEmailError(message?: string | null): string {
  const text = String(message ?? "").trim();
  if (!text) return GENERIC_MESSAGE();
  if (/not configured/i.test(text)) return CONFIG_MESSAGE();
  if (SECRETISH.test(text)) return GENERIC_MESSAGE();
  return text;
}

export const EMAIL_SENT_TOAST = () => translate("ops.trip.email_sent_toast");

export type DeliveryEmailAttemptResult = {
  success: boolean;
  status?: string;
  message?: string;
};

export type DeliveryEmailUiFeedback =
  | { toast: typeof EMAIL_SENT_TOAST; inlineError: null }
  | { toast: null; inlineError: string };

/** Failures stay inline. Only a successful send may show a toast. */
export function deliveryEmailAttemptFeedback(
  result: DeliveryEmailAttemptResult | Error
): DeliveryEmailUiFeedback {
  if (result instanceof Error) {
    return { toast: null, inlineError: userFacingDeliveryEmailError(result.message) };
  }
  if (result.success && result.status === "sent") {
    return { toast: EMAIL_SENT_TOAST, inlineError: null };
  }
  return {
    toast: null,
    inlineError: userFacingDeliveryEmailError(result.message),
  };
}
