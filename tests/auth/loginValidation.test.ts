import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginErrorMessage, validateLoginForm } from "../../src/modules/auth/loginValidation";

describe("loginValidation", () => {
  it("rejects empty fields with field errors", () => {
    const result = validateLoginForm("  ", "");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.errors.username ?? "", /username/i);
      assert.match(result.errors.password ?? "", /password/i);
    }
  });

  it("trims username and accepts valid payload", () => {
    const result = validateLoginForm("  owner  ", "secret-password");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.username, "owner");
      assert.equal(result.password, "secret-password");
    }
  });

  it("maps API statuses to safe messages", () => {
    assert.match(loginErrorMessage({ status: 401, message: "x" }), /invalid/i);
    assert.match(loginErrorMessage({ status: 409, message: "already signed in" }), /already signed in/i);
    assert.match(loginErrorMessage({ status: 429 }), /too many/i);
    assert.match(loginErrorMessage({ code: "NETWORK_ERROR", message: "Unable to reach" }), /server/i);
  });
});
