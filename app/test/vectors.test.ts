// The most dangerous single point in the whole app: if the app computes the commitment
// differently from the program, the seal goes through, the reveal fails, and the answer counts
// as a full miss — for everyone, silently, until someone tries to reveal.
//
// So the program writes the vectors and the app recomputes them here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PublicKey } from "@solana/web3.js";
import { brierBps, commitmentHash, saltFor } from "../src/chain/commitment.ts";
import { configPda, entryPda, playerPda, roundPda } from "../src/chain/pda.ts";
import { bytesToHex, hexToBytes } from "../src/chain/calendar.ts";
import { COMMIT_DOMAIN, PROGRAM_ID, SALT_DOMAIN } from "../src/chain/ids.ts";

const v = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../tests/fixtures/generated/app-vectors.json"), "utf8"),
);

test("the app and the program agree on the domains and the program id", () => {
  assert.equal(v.program_id, PROGRAM_ID.toBase58());
  assert.equal(v.commit_domain, COMMIT_DOMAIN);
  assert.equal(v.salt_domain, SALT_DOMAIN);
});

test("every PDA is the one the program derived", () => {
  const mint = new PublicKey(v.commitments[0].sgt_mint);
  assert.equal(configPda().toBase58(), v.pdas.config);
  assert.equal(roundPda(0).toBase58(), v.pdas.round_0);
  assert.equal(roundPda(11).toBase58(), v.pdas.round_11);
  assert.equal(entryPda(roundPda(11), mint).toBase58(), v.pdas.entry_round_11);
  assert.equal(playerPda(mint).toBase58(), v.pdas.player);
});

test("the salt rule is byte-identical to the one pinned in Rust", () => {
  const secret = hexToBytes(v.secret_hex);
  for (const s of v.salts) {
    assert.equal(bytesToHex(saltFor(secret, s.round_id)), s.salt, `salt for round ${s.round_id}`);
  }
});

test("every commitment matches, against the real terms of the season", () => {
  for (const c of v.commitments) {
    const got = commitmentHash({
      round: new PublicKey(c.round_pda),
      termsHash: hexToBytes(c.terms_hash),
      sgtMint: new PublicKey(c.sgt_mint),
      beneficiary: new PublicKey(c.beneficiary),
      pBps: c.p_bps,
      salt: hexToBytes(c.salt),
    });
    assert.equal(bytesToHex(got), c.commitment, `commitment for round ${c.round_id}, p=${c.p_bps}`);
  }
});

test("the commitment changes when anything about it changes", () => {
  const c = v.commitments[1];
  const base = {
    round: new PublicKey(c.round_pda),
    termsHash: hexToBytes(c.terms_hash),
    sgtMint: new PublicKey(c.sgt_mint),
    beneficiary: new PublicKey(c.beneficiary),
    pBps: c.p_bps,
    salt: hexToBytes(c.salt),
  };
  const original = bytesToHex(commitmentHash(base));
  assert.notEqual(original, bytesToHex(commitmentHash({ ...base, pBps: c.p_bps - 500 })), "p");
  assert.notEqual(original, bytesToHex(commitmentHash({ ...base, round: roundPda(12) })), "round");
  const otherSalt = hexToBytes(c.salt);
  otherSalt[31] ^= 1;
  assert.notEqual(original, bytesToHex(commitmentHash({ ...base, salt: otherSalt })), "salt");
});

test("the Brier value the app shows is the one the program stores", () => {
  for (const c of v.commitments) {
    assert.equal(brierBps(c.p_bps, true), c.brier_bps_if_yes, `p=${c.p_bps} yes`);
    assert.equal(brierBps(c.p_bps, false), c.brier_bps_if_no, `p=${c.p_bps} no`);
  }
});

test("a probability the program would refuse is refused before the wallet opens", () => {
  const c = v.commitments[0];
  const base = {
    round: new PublicKey(c.round_pda),
    termsHash: hexToBytes(c.terms_hash),
    sgtMint: new PublicKey(c.sgt_mint),
    beneficiary: new PublicKey(c.beneficiary),
    salt: hexToBytes(c.salt),
  };
  for (const bad of [250, 10_500, -500, 7.5]) {
    assert.throws(() => commitmentHash({ ...base, pBps: bad }), /p_bps/, `p=${bad}`);
  }
});
