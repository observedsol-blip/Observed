// The state machine, put through every way a phone can die.
//
// The two properties under test are the ones that cost a player their answer if they break:
// the record exists before the wallet is asked, and "unknown" never leads to a second seal
// without asking the chain.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Sealing } from "../src/core/sealing.ts";
import { MemoryStore } from "../src/core/store.ts";
import type { SealRecord } from "../src/core/records.ts";
import type { Entry } from "../src/chain/layout.ts";
import { type Calendar, hexToBytes } from "../src/chain/calendar.ts";
import { entryPda, roundPda } from "../src/chain/pda.ts";

const cal: Calendar = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../tests/fixtures/calendar/season1.json"), "utf8"),
);
const round = cal.rounds[11];
const wallet = Keypair.fromSeed(Uint8Array.from(Array(32).fill(4))).publicKey;
const sgtMint = new PublicKey(Uint8Array.from(Array(32).fill(0x11)));
const secret = Uint8Array.from(Array(32).fill(0x5a));

/** A chain the test drives by hand. */
class FakeChain {
  entry: Entry | null = null;
  sends = 0;
  /** "ok" | "declined" | "lost" (a signature, but never confirmed) */
  behaviour: "ok" | "declined" | "lost" = "ok";

  sealWith(commitment: string) {
    this.entry = {
      pubkey: entryPda(roundPda(round.roundId), sgtMint),
      round: roundPda(round.roundId),
      sgtMint,
      beneficiary: wallet,
      rentRefundTo: wallet,
      commitment: hexToBytes(commitment),
      committedAt: round.commitOpen + 60,
      revealed: false,
      pBps: 0,
      scored: false,
      scoredAsMissing: false,
      scoreBps: 0,
    };
  }
}

function machine(opts: { now?: number; chain?: FakeChain; store?: MemoryStore } = {}) {
  const chain = opts.chain ?? new FakeChain();
  const store = opts.store ?? new MemoryStore();
  let now = opts.now ?? round.commitOpen + 300;
  const sealing = new Sealing({
    store,
    now: () => now,
    sgtMint,
    wallet,
    secret,
    readEntry: async () => chain.entry,
    send: async (record) => {
      chain.sends += 1;
      if (chain.behaviour === "declined") throw new Error("user declined the approval");
      // a real send puts the entry on chain; "lost" means we never learn that it did
      chain.sealWith(record.commitment);
      return `sig${chain.sends}`;
    },
    confirm: async () => chain.behaviour === "ok",
  });
  return { sealing, chain, store, setNow: (t: number) => (now = t) };
}

test("the answer is written down before the wallet is ever asked", async () => {
  const { sealing, chain, store } = machine();
  await sealing.saveAnswer({ round, pBps: 8_000, sentence: "ETH looks tired", share: false });

  assert.equal(chain.sends, 0, "nothing was sent yet");
  const saved = await sealing.read(round.roundId);
  assert.equal(saved?.status, "saved");
  assert.equal(saved?.pBps, 8_000);
  assert.equal(saved?.sentence, "ETH looks tired");
  assert.equal(saved?.salt.length, 64, "the salt is stored, not re-derived later from nothing");
  // and it is really on disk, not just in the object
  assert.ok(JSON.stringify(store.snapshot()).includes(saved!.commitment));
});

test("the happy path ends confirmed", async () => {
  const { sealing } = machine();
  await sealing.saveAnswer({ round, pBps: 6_500 });
  const sealed = await sealing.seal(round);
  assert.equal(sealed.status, "confirmed");
  assert.ok(sealed.signature);
});

test("a declined approval keeps the answer and sends nothing", async () => {
  const { sealing, chain } = machine();
  chain.behaviour = "declined";
  await sealing.saveAnswer({ round, pBps: 7_000 });
  const after = await sealing.seal(round);

  assert.equal(after.status, "saved", "still sealable while the window is open");
  assert.equal(after.pBps, 7_000, "the answer is untouched");
  assert.equal(chain.entry, null, "nothing on chain");
  assert.match(after.note ?? "", /declined/);
});

test("crash after saving: the next start finds the answer and can still seal", async () => {
  const store = new MemoryStore();
  const chain = new FakeChain();
  const first = machine({ store, chain });
  await first.sealing.saveAnswer({ round, pBps: 9_000 });
  // phone dies here — new process, same storage
  const second = machine({ store, chain });
  const found = await second.sealing.unfinished();
  assert.equal(found.length, 1);
  assert.equal(found[0].status, "saved");
  const sealed = await second.sealing.seal(round);
  assert.equal(sealed.status, "confirmed");
});

test("crash after sending: the record says unknown, and the chain decides", async () => {
  const store = new MemoryStore();
  const chain = new FakeChain();
  chain.behaviour = "lost"; // a signature comes back, confirmation never does
  const first = machine({ store, chain });
  await first.sealing.saveAnswer({ round, pBps: 5_500 });
  const after = await first.sealing.seal(round);
  assert.equal(after.status, "unknown");
  assert.equal(chain.sends, 1);

  // next start: the entry IS on chain, so the record becomes confirmed — without sending again
  const second = machine({ store, chain });
  const reconciled = await second.sealing.reconcile(round);
  assert.equal(reconciled.status, "confirmed");
  assert.equal(chain.sends, 1, "nothing was sent a second time");
});

test("unknown never seals twice: seal() asks the chain first", async () => {
  const store = new MemoryStore();
  const chain = new FakeChain();
  chain.behaviour = "lost";
  const { sealing } = machine({ store, chain });
  await sealing.saveAnswer({ round, pBps: 5_500 });
  await sealing.seal(round); // -> unknown, but the entry landed

  const again = await sealing.seal(round);
  assert.equal(again.status, "confirmed");
  assert.equal(chain.sends, 1, "the second seal() did not send");
});

test("unknown with nothing on chain and the window still open: try again", async () => {
  const store = new MemoryStore();
  const chain = new FakeChain();
  const { sealing } = machine({ store, chain });
  await sealing.saveAnswer({ round, pBps: 5_500 });
  // simulate: sent, nothing landed, no confirmation
  await sealing.seal(round);
  chain.entry = null;
  const reconciled = await sealing.reconcile(round);
  assert.equal(reconciled.status, "failed", "failed means: the window is open, try again");
});

test("the window closed without an entry: missed, and it stays missed", async () => {
  const store = new MemoryStore();
  const chain = new FakeChain();
  const m = machine({ store, chain });
  await m.sealing.saveAnswer({ round, pBps: 5_500 });
  m.setNow(round.commitClose + 1);
  const reconciled = await m.sealing.reconcile(round);
  assert.equal(reconciled.status, "missed");
  assert.deepEqual(await m.sealing.unfinished(), [], "nothing left to do");
});

test("an entry this phone cannot open is not retried", async () => {
  const store = new MemoryStore();
  const chain = new FakeChain();
  const { sealing } = machine({ store, chain });
  await sealing.saveAnswer({ round, pBps: 5_500 });
  chain.sealWith("ff".repeat(32)); // someone else's commitment under our mint
  const reconciled = await sealing.reconcile(round);
  assert.equal(reconciled.status, "missed");
  assert.match(reconciled.note ?? "", /cannot reveal/);
});

test("a confirmed call cannot be overwritten by a new answer", async () => {
  const { sealing } = machine();
  await sealing.saveAnswer({ round, pBps: 5_000 });
  await sealing.seal(round);
  await assert.rejects(() => sealing.saveAnswer({ round, pBps: 9_500 }), /already sealed/);
});

test("a failed write is not silently swallowed", async () => {
  const store = new MemoryStore();
  store.failNextWrite = true;
  const { sealing } = machine({ store });
  await assert.rejects(() => sealing.saveAnswer({ round, pBps: 5_000 }), /storage failed/);
  assert.equal(await sealing.read(round.roundId), null, "and nothing half-written is left behind");
});

test("the commitment in the record is the one the program will check", async () => {
  const { sealing } = machine();
  const record: SealRecord = await sealing.saveAnswer({ round, pBps: 8_000 });
  // recomputed independently from the stored salt
  const { commitmentHash } = await import("../src/chain/commitment.ts");
  const { bytesToHex } = await import("../src/chain/calendar.ts");
  const again = commitmentHash({
    round: roundPda(round.roundId),
    termsHash: hexToBytes(round.termsHash),
    sgtMint,
    beneficiary: wallet,
    pBps: 8_000,
    salt: hexToBytes(record.salt),
  });
  assert.equal(bytesToHex(again), record.commitment);
});

test("an answer on its way is not overwritten by a new one", async () => {
  // The case: the transaction is out, the player changes their number before it lands. If the
  // record were overwritten, the chain would hold a commitment for the old number while the
  // phone remembers the new one — and the answer could never be revealed. Full miss, silently.
  const store = new MemoryStore();
  const chain = new FakeChain();
  chain.behaviour = "lost"; // signature, no confirmation -> "unknown"
  const { sealing } = machine({ store, chain });
  await sealing.saveAnswer({ round, pBps: 6_500 });
  const after = await sealing.seal(round);
  assert.equal(after.status, "unknown");

  await assert.rejects(
    () => sealing.saveAnswer({ round, pBps: 9_000 }),
    /already on its way/,
    "changing it now would make the sealed answer unrevealable",
  );
  assert.equal((await sealing.read(round.roundId))!.pBps, 6_500, "the first answer is untouched");

  // the way out is the chain, not a new answer
  const reconciled = await sealing.reconcile(round);
  assert.equal(reconciled.status, "confirmed");
});
