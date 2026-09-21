// The strings that carry a number in them. A plural in the wrong place is small; a message that
// reads like success when nothing was restored is not (owner, 22.09.2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { copy } from "../src/copy.ts";

test("everything came back", () => {
  assert.equal(copy.backup.restored(2, 0), "2 calls restored.");
  assert.equal(copy.backup.restored(1, 0), "1 call restored.", "singular");
  assert.equal(copy.backup.restored(3, 0), "3 calls restored.");
});

test("some came back, and the rest is named as what it costs", () => {
  assert.equal(
    copy.backup.restored(2, 1),
    "2 calls restored. 1 call can't be opened with this code — it will count as a miss.",
  );
  assert.equal(
    copy.backup.restored(1, 2),
    "1 call restored. 2 calls can't be opened with this code — they will count as misses.",
  );
  assert.equal(
    copy.backup.restored(1, 1),
    "1 call restored. 1 call can't be opened with this code — it will count as a miss.",
    "both singular",
  );
});

test("nothing came back: the two reasons read differently", () => {
  // entries exist on chain but this code does not open them — the code is wrong
  assert.equal(copy.backup.restored(0, 2), "This code doesn't match your sealed calls.");
  assert.equal(copy.backup.restored(0, 1), "This code doesn't match your sealed calls.");
  // nothing is open at all — the code may well be right, there is simply nothing to fetch
  assert.equal(copy.backup.restored(0, 0), "No open calls to restore.");
});

test("no case reads like success when nothing was restored", () => {
  // The old template said "0 restored." for both of the cases above. That was the bug.
  for (const lost of [0, 1, 5]) {
    assert.ok(
      !copy.backup.restored(0, lost).startsWith("0"),
      `"${copy.backup.restored(0, lost)}" must not open with a zero`,
    );
  }
});

test("the reminder and the reveal line are the approved ones", () => {
  assert.equal(copy.remindMe, "Remind me each evening");
  assert.equal(copy.notNow, "Not now");
  assert.equal(copy.revealsRideAlong, "Yesterday's call opens in the same approval.");
  assert.equal(copy.nothingRevealed, "Nothing revealed yet.");
  assert.equal(copy.backup.placeholder, "64 characters");
});

test("the counts on Today keep their plural straight", () => {
  assert.equal(copy.openReveals(1), "1 call still open to reveal");
  assert.equal(copy.openReveals(3), "3 calls still open to reveal");
});
