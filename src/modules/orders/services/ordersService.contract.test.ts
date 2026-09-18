import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ordersErrorMessage } from "../utils/ordersErrorMessage";
import { ApiError } from "../../../api";

const source = readFileSync(
  fileURLToPath(new URL("./ordersService.ts", import.meta.url)),
  "utf8",
);

test("new collections create a draft and never call a deliveries step with trip id 0", () => {
  assert.doesNotMatch(source, /\/trips\/\$\{[^}]*\?\?\s*0[^}]*\}\/steps\/deliveries/);
  assert.doesNotMatch(source, /[`'"]\/trips\/0\/steps\/deliveries/);
  assert.match(source, /remarks: "\[ORDER_COLLECTION\]"/);
  assert.match(source, /created\.id\}\/steps\/deliveries|container\.id\}\/steps\/deliveries/);
});

test("Orders errors retain useful business detail and hide database internals", () => {
  assert.equal(
    ordersErrorMessage(new ApiError("Trip 123 not found", { status: 404 })),
    "Unable to save this order because the trip is no longer available. Refresh and try again.",
  );
  assert.equal(
    ordersErrorMessage(new ApiError("duplicate key violates PostgreSQL constraint", { status: 500 })),
    "The server could not complete this request. Please try again or contact support.",
  );
  assert.match(
    ordersErrorMessage(new ApiError("Vehicle capacity exceeded. Available: 20 boxes. Requested: 25 boxes.", { status: 422 })),
    /Available: 20 boxes/,
  );
});
