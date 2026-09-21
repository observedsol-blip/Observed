// Cross-language check for all four accounts: the fixtures are serialised by the Anchor program
// itself, this test decodes them with the app's own offsets. Reorder a field in Rust and this
// goes red — which is the only reason anyone would notice before a player cannot reveal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PublicKey } from "@solana/web3.js";
import {
  CONFIG_OFFSET,
  ENTRY_OFFSET,
  PLAYER_OFFSET,
  ROUND_OFFSET,
  decodeConfig,
  decodeEntry,
  decodePlayer,
  decodeRound,
} from "../src/chain/layout.ts";
import { bytesToHex } from "../src/chain/calendar.ts";

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, `../../tests/fixtures/generated/${name}.json`), "utf8"));

const roundFixture = fixture("round-layout");
const entryFixture = fixture("entry-layout");
const accounts = fixture("account-fixtures");
const b64 = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));

test("decodeRound matches the account the program wrote", () => {
  const data = b64(roundFixture.data_base64);
  const want = roundFixture.expected;
  assert.equal(data.length, ROUND_OFFSET.size, "account size");

  const round = decodeRound(new PublicKey(roundFixture.pubkey), data);
  assert.equal(round.roundId, want.round_id);
  assert.equal(round.kind, want.kind);
  assert.equal(bytesToHex(round.feedId), want.feed_id);
  assert.equal(round.priceAccount.toBase58(), want.price_account);
  assert.equal(round.offsetBps, want.offset_bps);
  assert.equal(round.bandBps, want.band_bps);
  assert.equal(round.windowSecs, want.window_secs);
  assert.equal(round.maxAgeSecs, want.max_age_secs);
  assert.equal(round.closeAfterSecs, want.close_after_secs);
  assert.equal(round.earliestCloseUnix, want.earliest_close_unix);
  assert.equal(round.commitOpen, want.commit_open);
  assert.equal(round.commitClose, want.commit_close);
  assert.equal(round.referenceTime, want.reference_time);
  assert.equal(round.outcomeTime, want.outcome_time);
  assert.equal(round.revealClose, want.reveal_close);
  assert.equal(round.status, want.status);
  assert.equal(round.outcome, want.outcome);
  assert.equal(round.outcomeMarginBps, want.outcome_margin_bps);
  assert.equal(round.commitCount, want.commit_count);
  assert.equal(round.revealCount, want.reveal_count);
  assert.equal(round.reference.price, want.reference_price);
  assert.equal(round.reference.publishTime, want.reference_publish_time);
  assert.equal(round.reference.postedSlot, want.reference_posted_slot);
  assert.equal(round.evidence.price, want.evidence_price);
  assert.equal(round.revealClose - round.outcomeTime, 72 * 3600, "72 h reveal window");
});

test("decodeEntry matches the account the program wrote", () => {
  const data = b64(entryFixture.data_base64);
  const want = entryFixture.expected;
  assert.equal(data.length, ENTRY_OFFSET.size, "account size");

  const entry = decodeEntry(new PublicKey(entryFixture.pubkey), data);
  assert.equal(entry.round.toBase58(), want.round);
  assert.equal(entry.sgtMint.toBase58(), want.sgt_mint);
  assert.equal(entry.revealed, want.revealed);
  assert.equal(entry.pBps, want.p_bps);
  assert.equal(entry.scored, want.scored);
  assert.equal(entry.scoredAsMissing, want.scored_as_missing);
  assert.equal(entry.scoreBps, want.score_bps);
});

test("decodeConfig matches the account the program wrote", () => {
  const { data_base64, expected } = accounts.config;
  const data = b64(data_base64);
  assert.equal(data.length, CONFIG_OFFSET.size, "account size");

  const config = decodeConfig(data);
  assert.equal(config.version, expected.version);
  assert.equal(config.gameId, expected.game_id);
  assert.equal(config.calendarAuthority.toBase58(), expected.calendar_authority);
  assert.equal(config.pauseAuthority.toBase58(), expected.pause_authority);
  assert.equal(config.paused, expected.paused);
  assert.equal(config.nextRoundId, expected.next_round_id);
  assert.equal(config.season, expected.season);
  assert.equal(bytesToHex(config.calendarRoot), expected.calendar_root);
  assert.equal(config.firstRoundId, expected.first_round_id);
  assert.equal(config.maxRoundId, expected.max_round_id);
});

test("decodePlayer matches the account the program wrote", () => {
  const { data_base64, expected } = accounts.player;
  const data = b64(data_base64);
  assert.equal(data.length, PLAYER_OFFSET.size, "account size");

  const player = decodePlayer(data);
  assert.equal(player.sgtMint.toBase58(), expected.sgt_mint);
  assert.equal(player.commits, expected.commits);
  assert.equal(player.reveals, expected.reveals);
  assert.equal(player.missingScored, expected.missing_scored);
  assert.equal(player.scoreSum, expected.score_sum);
  assert.equal(player.scoredRounds, expected.scored_rounds);
});
