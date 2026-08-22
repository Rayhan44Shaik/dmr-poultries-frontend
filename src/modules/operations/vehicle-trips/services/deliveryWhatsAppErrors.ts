import { translate } from "../../../../i18n";

const CONFIG_MESSAGE = () =>
  translate("ops.trip.whatsapp_not_configured");

const GENERIC_MESSAGE = () =>
  translate("ops.trip.whatsapp_send_failed");

const SECRETISH = /whatsapp[_-]?token|whatsapp[_-]?secret|api[_-]?key|secret|stack/i;

export function userFacingDeliveryWhatsAppError(message?: string | null): string {
  const text = String(message ?? "").trim();
  if (!text) return GENERIC_MESSAGE();
  if (/not configured/i.test(text)) return CONFIG_MESSAGE();
  if (SECRETISH.test(text)) return GENERIC_MESSAGE();
  return text;
}

export const WHATSAPP_SENT_TOAST = () => translate("ops.trip.whatsapp_sent_toast");

export type DeliveryWhatsAppAttemptResult = {
  success: boolean;
  status?: string;
  message?: string;
};

export type DeliveryWhatsAppUiFeedback =
  | { toast: typeof WHATSAPP_SENT_TOAST; inlineError: null }
  | { toast: null; inlineError: string };

/** Failures stay inline. Only a successful send may show a toast. */
export function deliveryWhatsAppAttemptFeedback(
  result: DeliveryWhatsAppAttemptResult | Error
): DeliveryWhatsAppUiFeedback {
  if (result instanceof Error) {
    return { toast: null, inlineError: userFacingDeliveryWhatsAppError(result.message) };
  }
  if (result.success && result.status === "sent") {
    return { toast: WHATSAPP_SENT_TOAST, inlineError: null };
  }
  return {
    toast: null,
    inlineError: userFacingDeliveryWhatsAppError(result.message),
  };
}