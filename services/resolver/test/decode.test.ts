// Cross-language check: the fixture is serialised by the Anchor program itself
// (programs/observed/tests/observed.rs::entry_layout_fixture writes it), this test decodes it
// with the worker's own offsets. If anyone reorders a field in the Rust struct, this fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PublicKey } from "@solana/web3.js";
import { decodeEntry, ENTRY_OFFSET } from "../src/chain.ts";

const fixture = JSON.parse(
  readFileSync(new URL("../../../tests/fixtures/generated/entry-layout.json", import.meta.url), "utf8"),
);

test("decodeEntry matches the account the program wrote", () => {
  const data = Buffer.from(fixture.data_base64, "base64");
  assert.equal(data.length, ENTRY_OFFSET.size, "account size");

  const entry = decodeEntry(new PublicKey(fixture.pubkey), data);
  assert.equal(entry.round.toBase58(), fixture.expected.round, "round");
  assert.equal(entry.sgtMint.toBase58(), fixture.expected.sgt_mint, "sgt_mint");
  assert.equal(entry.revealed, fixture.expected.revealed, "revealed");
  assert.equal(entry.pBps, fixture.expected.p_bps, "p_bps");
  assert.equal(entry.scored, fixture.expected.scored, "scored");
  assert.equal(entry.scoredAsMissing, fixture.expected.scored_as_missing, "scored_as_missing");
  assert.equal(entry.scoreBps, fixture.expected.score_bps, "score_bps");
});

test("the old offsets would have read committed_at", () => {
  const data = Buffer.from(fixture.data_base64, "base64");
  // 168 and 171 sit inside committed_at — the bug this test exists for
  assert.notEqual(ENTRY_OFFSET.revealed, 168);
  assert.notEqual(ENTRY_OFFSET.scored, 171);
  assert.ok(ENTRY_OFFSET.committedAt === 168 && ENTRY_OFFSET.revealed === 176);
  assert.equal(data.readBigInt64LE(ENTRY_OFFSET.committedAt) > 0n, true, "committed_at is a timestamp");
});
