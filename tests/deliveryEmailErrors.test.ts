import assert from "node:assert/strict";
import test from "node:test";
import { translate } from "../src/i18n";
import {
  deliveryEmailAttemptFeedback,
  userFacingDeliveryEmailError,
} from "../src/modules/operations/vehicle-trips/services/deliveryEmailErrors";

const CONFIG_MESSAGE = translate("ops.trip.email_not_configured");
const GENERIC_MESSAGE = translate("ops.trip.email_send_failed");
const SENT_TOAST = translate("ops.trip.email_sent_toast");

test("maps SMTP configuration failures to a clean admin message", () => {
  assert.notEqual(CONFIG_MESSAGE, "ops.trip.email_not_configured");
  assert.equal(userFacingDeliveryEmailError("SMTP provider is not configured."), CONFIG_MESSAGE);
});

test("never surfaces SMTP secrets or provider internals", () => {
  assert.notEqual(GENERIC_MESSAGE, "ops.trip.email_send_failed");
  assert.equal(
    userFacingDeliveryEmailError("Invalid login for SMTP_USER=someone SMTP_PASS=secret"),
    GENERIC_MESSAGE
  );
  assert.equal(
    userFacingDeliveryEmailError("connect ECONNREFUSED SMTP_HOST=smtp.gmail.com"),
    GENERIC_MESSAGE
  );
});

test("keeps actionable shop-email validation messages", () => {
  assert.equal(userFacingDeliveryEmailError("Shop email is missing."), "Shop email is missing.");
  assert.equal(userFacingDeliveryEmailError("Shop email is invalid."), "Shop email is invalid.");
});

test("failure feedback is inline only — never a toast/modal", () => {
  const smtpDown = deliveryEmailAttemptFeedback({
    success: false,
    status: "failed",
    message: "Unable to send email.",
  });
  assert.equal(smtpDown.toast, null);
  assert.equal(smtpDown.inlineError, "Unable to send email.");

  const thrown = deliveryEmailAttemptFeedback(new Error("Unable to send email."));
  assert.equal(thrown.toast, null);
  assert.equal(thrown.inlineError, "Unable to send email.");
});

test("success feedback is a toast with no inline error", () => {
  const ok = deliveryEmailAttemptFeedback({ success: true, status: "sent" });
  assert.notEqual(SENT_TOAST, "ops.trip.email_sent_toast");
  assert.ok(ok.toast);
  assert.equal(ok.toast(), SENT_TOAST);
  assert.equal(ok.inlineError, null);
});
