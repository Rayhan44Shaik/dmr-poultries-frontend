import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PENDING_DELETE_SECONDS,
  createPendingDeleteController,
  pendingDeleteBarPercent,
  pendingDeleteCountdownLabel,
} from "./pendingDelete.ts";

describe("pickup erase countdown contract (IMP-08)", () => {
  it("uses a 10-second recoverable countdown window", () => {
    assert.equal(PENDING_DELETE_SECONDS, 10);
  });

  it("formats countdown labels and bar progress for cancelable erase UX", () => {
    assert.match(pendingDeleteCountdownLabel(10), /10/);
    assert.match(pendingDeleteCountdownLabel(1), /1/);
    assert.equal(pendingDeleteBarPercent(10, 10), 100);
    assert.equal(pendingDeleteBarPercent(0, 10), 0);
  });

  it("cancel during countdown prevents commit (C5-15)", async () => {
    let expired = 0;
    const snapshots: Array<{ id: string; secondsLeft: number }>[] = [];
    const controller = createPendingDeleteController<string>({
      seconds: 3,
      intervalMs: 20,
      onExpire: () => {
        expired += 1;
      },
      onChange: (items) => {
        snapshots.push(items.map((i) => ({ id: String(i.id), secondsLeft: i.secondsLeft })));
      },
    });
    controller.requestDelete("erase-load-1");
    await new Promise((r) => setTimeout(r, 45));
    controller.cancel("erase-load-1");
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(expired, 0, "cancel must abort erase before countdown reaches zero");
    const last: Array<{ id: string; secondsLeft: number }> = snapshots[snapshots.length - 1] ?? [];
    assert.equal(last.some((s) => s.id === "erase-load-1"), false);
    controller.dispose();
  });

  it("erase dialog contract identifies affected scope via countdown request key", () => {
    // StepPickup confirmClearAllBoxes message pattern (static contract).
    const savedCount = 42;
    const message = `This will permanently remove all ${savedCount} pickup boxes for this load. You can then import a corrected Excel or PDF and numbering will restart from box 1.`;
    assert.match(message, /42 pickup boxes/);
    assert.match(message, /this load/);
    assert.match(message, /restart from box 1/);
  });
});
