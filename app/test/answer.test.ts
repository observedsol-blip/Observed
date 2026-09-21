// When is an answer an answer? Both halves have to be a decision (owner, 22.09.2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { canSeal, clampToStep, fromPBps, toPBps } from "../src/core/answer.ts";
import { INPUT_TICKS } from "../src/core/scale.ts";
import { BUCKET_STEP } from "../src/chain/ids.ts";

test("a side without a confidence cannot be sealed", () => {
  // The hole the new slider made visible: tapping Up armed the button while the untouched scale
  // still sat at 50 — and sealing wrote 50/50, "no side", for somebody who had just picked one.
  assert.equal(canSeal({ side: "up", confidenceTouched: false }), false);
  assert.equal(canSeal({ side: "down", confidenceTouched: false }), false);
});

test("a confidence without a side cannot be sealed either", () => {
  assert.equal(canSeal({ side: null, confidenceTouched: true }), false);
  assert.equal(canSeal({ side: null, confidenceTouched: false }), false);
});

test("a deliberate 50 can be sealed, and it is a 50/50", () => {
  // Touching the scale and leaving it at 50 is a decision. That is the whole difference.
  assert.equal(canSeal({ side: "up", confidenceTouched: true }), true);
  assert.equal(toPBps("up", 50), 5_000);
  assert.equal(toPBps("down", 50), 5_000);
});

test("side and confidence map to the numbers the program stores", () => {
  assert.equal(toPBps("up", 80), 8_000);
  assert.equal(toPBps("down", 80), 2_000);
  assert.equal(toPBps("up", 100), 10_000);
  assert.equal(toPBps("down", 100), 0);
  assert.equal(toPBps(null, 80), 5_000, "no side is always 50/50");

  assert.deepEqual(fromPBps(8_000), { side: "up", confidence: 80 });
  assert.deepEqual(fromPBps(2_000), { side: "down", confidence: 80 });
  assert.equal(fromPBps(5_000).side, null, "a sealed 50 carries no side");
});

test("every reachable position round-trips and lands on the program's grid", () => {
  for (const confidence of INPUT_TICKS) {
    for (const side of ["up", "down"] as const) {
      const p = toPBps(side, confidence);
      assert.equal(p % BUCKET_STEP, 0);
      if (p === 5_000) continue; // 50 is the one value that cannot carry a side back
      assert.deepEqual(fromPBps(p), { side, confidence });
    }
  }
});

test("the scale cannot be pushed below 50 or above 100", () => {
  assert.equal(clampToStep(20), 50);
  assert.equal(clampToStep(53), 55);
  assert.equal(clampToStep(140), 100);
});
