// Wallet, Genesis Token and SOL — the three things that must be settled before an approval is
// ever asked for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Keypair, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { SGT_GROUP, SGT_MINT_AUTHORITY, checkGenesisToken, findGenesisToken, readMint } from "../src/chain/sgt.ts";
import { ENTRY_RENT_LAMPORTS, checkFunding, needAboutSol } from "../src/core/funding.ts";
import { SessionExpired, type Wallet, type WalletSession, withSession } from "../src/core/wallet.ts";

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, `../../tests/fixtures/sgt/${name}.json`), "utf8"));
const b64 = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));

const mintFixture = fixture("sgt-mint");
const tokenFixture = fixture("sgt-token-account");
const mintData = b64(mintFixture.data_base64);
const tokenData = b64(tokenFixture.data_base64);
const mintKey = new PublicKey(mintFixture.pubkey);
const tokenKey = new PublicKey(tokenFixture.pubkey);
/** The owner is in the fixture itself — the app never hardcodes anybody's address. */
const owner = new PublicKey(tokenData.subarray(32, 64));

test("the real Genesis Token mint reads exactly as the program expects", () => {
  const mint = readMint(mintData);
  assert.equal(mint.supply, 1, "one token");
  assert.equal(mint.decimals, 0, "not divisible");
  assert.ok(mint.mintAuthority?.equals(SGT_MINT_AUTHORITY), "minted by the Seeker authority");
  assert.ok(mint.group?.equals(SGT_GROUP), "and it is a member of the Genesis group");
  assert.ok(mint.memberMint?.equals(mintKey), "the member entry points back at this mint");
});

test("the check passes for the real token account", () => {
  const check = checkGenesisToken({
    mint: mintKey,
    mintData,
    tokenAccount: tokenKey,
    tokenAccountData: tokenData,
    owner,
  });
  assert.equal(check.ok, true);
});

test("a token that is not a Genesis Token is refused, for each reason on its own", () => {
  const cases: [string, () => Uint8Array][] = [
    ["wrong group", () => { const d = mintData.slice(); d.set(Uint8Array.from(Array(32).fill(9)), 378 + 32); return d; }],
    ["supply 2", () => { const d = mintData.slice(); new DataView(d.buffer).setBigUint64(36, 2n, true); return d; }],
    ["divisible", () => { const d = mintData.slice(); d[44] = 9; return d; }],
    ["another mint authority", () => { const d = mintData.slice(); d.set(Uint8Array.from(Array(32).fill(1)), 4); return d; }],
  ];
  for (const [name, make] of cases) {
    const check = checkGenesisToken({
      mint: mintKey,
      mintData: make(),
      tokenAccount: tokenKey,
      tokenAccountData: tokenData,
      owner,
    });
    assert.equal(check.ok, false, name);
  }
});

test("a wallet without any token account gets the honest state, not an error", async () => {
  const reader = { tokenAccountsOf: async () => [], accountData: async () => null };
  const check = await findGenesisToken(reader, owner);
  assert.deepEqual(check, { ok: false, reason: "no-token-account" });
});

test("the search walks past foreign tokens and finds the Genesis Token", async () => {
  const foreignToken = tokenData.slice();
  foreignToken.set(Uint8Array.from(Array(32).fill(3)), 0); // another mint
  const reader = {
    tokenAccountsOf: async () => [
      { pubkey: new PublicKey(Uint8Array.from(Array(32).fill(8))), data: foreignToken },
      { pubkey: tokenKey, data: tokenData },
    ],
    accountData: async (k: PublicKey) => (k.equals(mintKey) ? mintData : new Uint8Array(450)),
  };
  const check = await findGenesisToken(reader, owner);
  assert.equal(check.ok, true);
  assert.equal(check.ok && check.mint.toBase58(), mintKey.toBase58());
});

test("the SOL check knows the difference between sealing and only revealing", () => {
  const poor = checkFunding({ balanceLamports: 1_000_000, needsNewEntry: true });
  assert.equal(poor.ok, false);
  assert.equal(needAboutSol(poor), 0.003, "the number in the copy: about 0.003 SOL");
  assert.ok(poor.shortfallSol > 0);

  const enough = checkFunding({ balanceLamports: ENTRY_RENT_LAMPORTS + 300_000, needsNewEntry: true });
  assert.equal(enough.ok, true);

  // the same balance is plenty when there is no new entry to pay rent for
  const revealOnly = checkFunding({ balanceLamports: 400_000, needsNewEntry: false });
  assert.equal(revealOnly.ok, true);
  const sealing = checkFunding({ balanceLamports: 400_000, needsNewEntry: true });
  assert.equal(sealing.ok, false);
});

test("an expired session reconnects once instead of failing in the player's face", async () => {
  const pubkey = Keypair.fromSeed(Uint8Array.from(Array(32).fill(6))).publicKey;
  let connects = 0;
  let disconnects = 0;
  let firstTry = true;
  const wallet: Wallet = {
    connect: async () => {
      connects += 1;
      return { pubkey, label: "Seed Vault Wallet", authToken: `t${connects}` } satisfies WalletSession;
    },
    signAndSend: async (_ixs: TransactionInstruction[]) => "sig",
    signMessage: null,
    disconnect: async () => { disconnects += 1; },
  };

  const { result, session } = await withSession(wallet, async (s) => {
    if (firstTry) {
      firstTry = false;
      throw new SessionExpired();
    }
    return s.authToken;
  });
  assert.equal(result, "t2", "the second, fresh token was used");
  assert.equal(connects, 2);
  assert.equal(disconnects, 1, "the stale token was thrown away first");
  assert.equal(session.label, "Seed Vault Wallet");
});

test("a declined approval is not swallowed by the session logic", async () => {
  const pubkey = Keypair.fromSeed(Uint8Array.from(Array(32).fill(7))).publicKey;
  const wallet: Wallet = {
    connect: async () => ({ pubkey }),
    signAndSend: async () => "sig",
    signMessage: null,
    disconnect: async () => {},
  };
  await assert.rejects(
    () => withSession(wallet, async () => { throw new Error("user declined"); }),
    /declined/,
  );
});
