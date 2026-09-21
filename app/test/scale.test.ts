// The two scales are not one scale (owner decision, 22.09.2026). These tests hold that apart.
//
// Input: how sure you are, after a side is chosen — 50…100, eleven positions, labels 50 · 75 ·
// 100. Distribution: what the crowd answered — 0…100, the 21 buckets the program counts.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DISTRIBUTION_TICKS,
  INPUT_LABELLED,
  INPUT_MIN,
  INPUT_TICKS,
  snap,
  snapInput,
  valueAtInput,
  xFor,
  xForInput,
} from "../src/core/scale.ts";
import { BUCKET_STEP, MAX_P_BPS } from "../src/chain/ids.ts";

const WIDTH = 358; // 390 dp screen minus the 16 dp gutters
const EDGE = 8;

test("the input has eleven positions, 50 to 100", () => {
  assert.equal(INPUT_TICKS.length, 11);
  assert.equal(INPUT_TICKS[0], 50);
  assert.equal(INPUT_TICKS.at(-1), 100);
  assert.deepEqual(INPUT_LABELLED, [50, 75, 100]);
  assert.equal(INPUT_MIN, 50);
});

test("the distribution keeps the program's 21 buckets", () => {
  assert.equal(DISTRIBUTION_TICKS.length, MAX_P_BPS / BUCKET_STEP + 1);
  assert.equal(DISTRIBUTION_TICKS[0], 0);
  assert.equal(DISTRIBUTION_TICKS.at(-1), 100);
});

test("a drag to the left end of the input track means 50, never less", () => {
  // The whole point: the gesture cannot ask for something the code would silently undo.
  assert.equal(snapInput(valueAtInput(EDGE, WIDTH, EDGE)), 50);
  assert.equal(snapInput(valueAtInput(-200, WIDTH, EDGE)), 50);
  assert.equal(snapInput(valueAtInput(WIDTH, WIDTH, EDGE)), 100);
  assert.equal(snapInput(20), 50);
  assert.equal(snapInput(0), 50);
});

test("the input spreads 50…100 across the whole track", () => {
  // Before 22.09.2026 the value 50 sat in the middle and the left half was dead.
  assert.equal(Math.round(xForInput(50, WIDTH, EDGE)), EDGE);
  assert.equal(Math.round(xForInput(100, WIDTH, EDGE)), WIDTH - EDGE);
  assert.equal(Math.round(xForInput(75, WIDTH, EDGE)), Math.round(WIDTH / 2));
  // and it never leaves the track, whatever it is handed
  assert.equal(Math.round(xForInput(0, WIDTH, EDGE)), EDGE);
  assert.equal(Math.round(xForInput(140, WIDTH, EDGE)), WIDTH - EDGE);
});

test("the distribution keeps 0 at the left and 50 in the middle", () => {
  assert.equal(Math.round(xFor(0, WIDTH, EDGE)), EDGE);
  assert.equal(Math.round(xFor(50, WIDTH, EDGE)), Math.round(WIDTH / 2));
  assert.equal(Math.round(xFor(100, WIDTH, EDGE)), WIDTH - EDGE);
});

test("every position the input can reach is one the program accepts", () => {
  for (const t of INPUT_TICKS) {
    const upBps = t * 100;
    const downBps = 10_000 - upBps;
    for (const p of [upBps, downBps]) {
      assert.equal(p % BUCKET_STEP, 0, `${p} is not on the program's grid`);
      assert.ok(p >= 0 && p <= MAX_P_BPS);
    }
  }
});

test("a touch and its pixel are inverse of each other", () => {
  for (const t of INPUT_TICKS) {
    const x = xForInput(t, WIDTH, EDGE);
    assert.equal(snapInput(valueAtInput(x, WIDTH, EDGE)), t);
  }
});

test("snap stays on the five-point grid", () => {
  assert.equal(snap(0), 0);
  assert.equal(snap(52), 50);
  assert.equal(snap(53), 55);
  assert.equal(snap(1_000), 100);
  assert.equal(snap(-1_000), 0);
});
