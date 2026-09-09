/**
 * Tests for the single global notification store.
 *
 * The guarantees that matter most to the UI are asserted here:
 *   • one action produces ONE notification (dedupe)
 *   • the stack is bounded, so notifications can never flood the screen
 *   • snapshots are referentially stable, so `useSyncExternalStore` cannot
 *     loop or remount the host
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetForTests,
  count,
  dismiss,
  dismissAll,
  dismissLatest,
  getSnapshot,
  notify,
  push,
  subscribe,
} from "./notificationStore";

test.beforeEach(() => {
  __resetForTests();
});

test("push adds a notification with the requested tone", () => {
  const id = push("Saved successfully.", "success");
  assert.ok(id);

  const items = getSnapshot();
  assert.equal(items.length, 1);
  assert.equal(items[0].message, "Saved successfully.");
  assert.equal(items[0].tone, "success");
  assert.equal(count(), 1);
});

test("tone helpers map onto the four semantic variants", () => {
  notify.success("s");
  notify.error("e");
  notify.warning("w");
  notify.info("i");

  assert.deepEqual(
    getSnapshot().map((n) => n.tone),
    ["success", "error", "warning", "info"],
  );
});

test("an identical notification is deduplicated, not stacked", () => {
  const first = push("Deleted successfully.", "success");
  const second = push("Deleted successfully.", "success");

  assert.equal(second, first, "same id — no second toast was created");
  assert.equal(getSnapshot().length, 1, "one action → one notification");
});

test("the same message with a different tone is a distinct notification", () => {
  push("Record saved.", "success");
  push("Record saved.", "error");
  assert.equal(getSnapshot().length, 2);
});

test("a different message is a distinct notification", () => {
  push("Record saved.", "success");
  push("Record updated.", "success");
  assert.equal(getSnapshot().length, 2);
});

test("dedupe ignores leading/trailing whitespace differences", () => {
  push("Saved.", "success");
  push("  Saved.  ", "success");
  assert.equal(getSnapshot().length, 1);
});

test("empty and blank messages never render a toast", () => {
  assert.equal(push("", "success"), "");
  assert.equal(push("   ", "success"), "");
  assert.equal(getSnapshot().length, 0);
});

test("the stack is bounded and retires the oldest first", () => {
  push("one", "info");
  push("two", "info");
  push("three", "info");
  push("four", "info");
  push("five", "info");

  const messages = getSnapshot().map((n) => n.message);
  assert.equal(messages.length, 4, "MAX_VISIBLE is 4");
  assert.deepEqual(messages, ["two", "three", "four", "five"]);
});

test("a retired notification no longer blocks a later identical one", () => {
  push("dup", "info");
  push("a", "info");
  push("b", "info");
  push("c", "info");
  push("d", "info"); // evicts "dup"

  assert.equal(getSnapshot().some((n) => n.message === "dup"), false);

  push("dup", "info");
  assert.equal(getSnapshot().some((n) => n.message === "dup"), true, "can be shown again");
});

test("dismiss removes a single notification", () => {
  const id = push("to remove", "info");
  push("to keep", "info");

  dismiss(id);

  const messages = getSnapshot().map((n) => n.message);
  assert.deepEqual(messages, ["to keep"]);
});

test("dismiss is safe for an unknown or already-gone id", () => {
  const id = push("x", "info");
  dismiss(id);
  assert.doesNotThrow(() => dismiss(id));
  assert.doesNotThrow(() => dismiss("never-existed"));
  assert.doesNotThrow(() => dismiss(""));
});

test("dismissLatest removes the most recent notification", () => {
  push("first", "info");
  push("second", "info");

  dismissLatest();

  assert.deepEqual(getSnapshot().map((n) => n.message), ["first"]);
});

test("dismissAll clears the stack", () => {
  push("a", "info");
  push("b", "error");
  dismissAll();
  assert.equal(getSnapshot().length, 0);
});

test("subscribers are notified on change and can unsubscribe", () => {
  let calls = 0;
  const unsubscribe = subscribe(() => {
    calls += 1;
  });

  const id = push("a", "info");
  assert.equal(calls, 1);

  dismiss(id);
  assert.equal(calls, 2);

  unsubscribe();
  push("b", "info");
  assert.equal(calls, 2, "unsubscribed listener is not called");
});

test("a throwing subscriber does not block the others", () => {
  let healthy = 0;
  const offBad = subscribe(() => {
    throw new Error("subscriber blew up");
  });
  subscribe(() => {
    healthy += 1;
  });

  assert.doesNotThrow(() => push("a", "info"));
  assert.equal(healthy, 1);
  offBad();
});

test("getSnapshot is referentially stable when nothing changed", () => {
  push("a", "info");
  const before = getSnapshot();
  const after = getSnapshot();
  assert.equal(before, after, "same reference — no useSyncExternalStore loop");
});

test("getSnapshot changes identity when the stack changes", () => {
  const before = getSnapshot();
  push("a", "info");
  assert.notEqual(before, getSnapshot());
});

test("auto-dismiss retires a notification after its duration", async () => {
  push("temporary", "success", { duration: 20 });
  assert.equal(getSnapshot().length, 1);

  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal(getSnapshot().length, 0, "expired on its own");
});

test("duration 0 pins a notification until it is dismissed", async () => {
  push("pinned", "error", { duration: 0 });

  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(getSnapshot().length, 1, "still visible");
  dismissAll();
});

test("re-pushing a visible notification does not extend the stack", async () => {
  for (let i = 0; i < 5; i += 1) {
    push("repeated", "info", { duration: 1000 });
  }
  assert.equal(getSnapshot().length, 1);

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(getSnapshot().length, 1, "timer was refreshed, not duplicated");
  dismissAll();
});

test("descriptions are carried through for record identity", () => {
  push("Deleted", "success", { description: "Shop: ABC Poultry" });
  assert.equal(getSnapshot()[0].description, "Shop: ABC Poultry");
});
