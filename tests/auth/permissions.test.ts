// tests/auth/permissions.test.ts
// Role-access matrix for the two desktop sign-in roles.
// Run: tsx --test tests/auth/permissions.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CAPABILITIES,
  canAccessLocation,
  hasCapability,
  landingPathForRole,
  canAccessNavPath,
} from "../../src/modules/auth/permissions";

describe("OWNER — full access", () => {
  test("opens every section and tab", () => {
    for (const path of ["/dashboard", "/masters?tab=shops", "/operations?tab=rate-entry", "/accounts?tab=summary", "/reports?tab=shopLedger", "/settings?tab=appearance"]) {
      assert.equal(canAccessLocation("OWNER", path.split("?")[0], path.includes("?") ? `?${path.split("?")[1]}` : ""), true, path);
    }
  });

  test("holds every capability", () => {
    assert.equal(hasCapability("OWNER", CAPABILITIES.TRIP_DELETE), true);
    assert.equal(hasCapability("OWNER", CAPABILITIES.COLLECTION_APPROVE), true);
    assert.equal(hasCapability("OWNER", CAPABILITIES.LEAVE_DELETE), true);
  });

  test("lands on the dashboard", () => {
    assert.equal(landingPathForRole("OWNER"), "/dashboard");
  });
});

describe("SUPERVISOR — entry-only workspace", () => {
  test("may open exactly the allowed pages", () => {
    const allowed = [
      ["/operations", "?tab=trip-entry"],
      ["/operations", "?tab=trip-list"],
      ["/operations", "?tab=collection"],
      ["/operations", "?tab=pending-collections"],
      ["/operations", "?tab=fuel-expenses"],
      ["/fleet", "?tab=entry"],
      ["/fleet", "?tab=history"],
      ["/fleet", "?tab=permits"],
      ["/fleet", "?tab=emi"],
      ["/fleet", "?tab=fastag"],
      ["/staff", "?tab=leaves"],
      ["/staff", "?tab=duty-planner"],
      ["/operations", ""], // tabless hub resolves to trip-entry inside the page
    ] as const;
    for (const [path, search] of allowed) {
      assert.equal(canAccessLocation("SUPERVISOR", path, search), true, `${path}${search}`);
    }
  });

  test("may not open any other page", () => {
    const blocked = [
      ["/dashboard", ""],
      ["/masters", "?tab=shops"],
      ["/masters/shops", ""],
      ["/operations", "?tab=rate-entry"],
      ["/operations", "?tab=shop-sales"],
      ["/operations", "?tab=mortality"],
      ["/operations/orders/collection", ""],
      ["/fleet", "?tab=analytics"],
      ["/staff", "?tab=salary-sheet"],
      ["/staff", "?tab=driver-performance"],
      ["/staff", "?tab=supervisor-performance"],
      ["/accounts", "?tab=summary"],
      ["/accounts", "?tab=paid-payments"],
      ["/accounts", "?tab=farm-payment"],
      ["/reports", "?tab=shopLedger"],
      ["/operations", "?tab=collection-report"],
      ["/settings", "?tab=appearance"],
    ] as const;
    for (const [path, search] of blocked) {
      assert.equal(canAccessLocation("SUPERVISOR", path, search), false, `${path}${search}`);
    }
  });

  test("holds no approve/delete capability anywhere", () => {
    for (const cap of Object.values(CAPABILITIES)) {
      assert.equal(hasCapability("SUPERVISOR", cap), false, cap);
    }
  });

  test("lands on trip entry, never the dashboard", () => {
    const landing = landingPathForRole("SUPERVISOR");
    assert.equal(landing, "/operations?tab=trip-entry");
  });

  test("nav paths mirror location access", () => {
    assert.equal(canAccessNavPath("SUPERVISOR", "/operations?tab=trip-entry"), true);
    assert.equal(canAccessNavPath("SUPERVISOR", "/fleet?tab=permits"), true);
    assert.equal(canAccessNavPath("SUPERVISOR", "/fleet?tab=emi"), true);
    assert.equal(canAccessNavPath("SUPERVISOR", "/fleet?tab=fastag"), true);
    assert.equal(canAccessNavPath("SUPERVISOR", "/staff?tab=duty-planner"), true);
    assert.equal(canAccessNavPath("SUPERVISOR", "/staff?tab=salary-sheet"), false);
    assert.equal(canAccessNavPath("SUPERVISOR", "/accounts?tab=summary"), false);
  });

  test("landing stays on trip entry with the wider scope", () => {
    assert.equal(landingPathForRole("SUPERVISOR"), "/operations?tab=trip-entry");
  });
});
