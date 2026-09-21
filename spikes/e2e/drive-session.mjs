#!/usr/bin/env node
// The evening, driven through `Session` — the same object the buttons call.
//
// drive-app.mjs proves that the app's instruction builders are right. This proves the layer
// above them: saveAnswer writes the record, evening() builds ONE transaction out of what the
// chain says is open, and the real program accepts it. Only the wallet is faked, and only
// because a local keypair replaces the Seeker.
//
//   node drive-session.mjs <step> <dir>     step = seal | evening | show
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const APP = join(import.meta.dirname, "..", "..", "app");
const require = createRequire(join(APP, "package.json"));
const web3 = require("@solana/web3.js");
const { Connection, Keypair, PublicKey, Transaction } = web3;

const { Session } = await import(join(APP, "src/core/session.ts"));
const { Chain } = await import(join(APP, "src/chain/rpc.ts"));
const { MemoryStore } = await import(join(APP, "src/core/store.ts"));
const { decodeEntry, decodePlayer } = await import(join(APP, "src/chain/layout.ts"));
const { entryPda, roundPda } = await import(join(APP, "src/chain/pda.ts"));

const [step, dir] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(join(dir, "plan.json"), "utf8"));
const player = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(join(dir, "player.json"), "utf8"))),
);
const connection = new Connection("http://127.0.0.1:8899", "confirmed");
const chain = new Chain(connection);
const sgtMint = new PublicKey(plan.sgtMint);

/** The Seeker, replaced by a local keypair. Everything else is the real thing. */
const wallet = {
  connect: async () => ({ pubkey: player.publicKey, label: "local keypair" }),
  signAndSend: async (instructions, payer) => {
    const tx = new Transaction({
      feePayer: payer,
      recentBlockhash: (await connection.getLatestBlockhash("finalized")).blockhash,
    }).add(...instructions);
    tx.sign(player);
    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature, "confirmed");
    return signature;
  },
  disconnect: async () => {},
};

/** The store has to survive between the steps of this script, so it lives in a file. */
const STATE = join(dir, "session-store.json");
class FileStore extends MemoryStore {
  constructor() {
    super();
    try {
      for (const [k, v] of Object.entries(JSON.parse(readFileSync(STATE, "utf8")))) {
        // MemoryStore keeps its own index; set() maintains it
        if (k !== "__keys") this.data.set(k, v);
      }
      const saved = JSON.parse(readFileSync(STATE, "utf8"));
      if (saved.__keys) this.data.set("__keys", saved.__keys);
    } catch {
      // first run
    }
  }
  async set(key, value) {
    await super.set(key, value);
    this.flush();
  }
  async delete(key) {
    await super.delete(key);
    this.flush();
  }
  flush() {
    const { writeFileSync } = require("node:fs");
    writeFileSync(STATE, JSON.stringify(Object.fromEntries(this.data)));
  }
}

const chainClock = async () => {
  const info = await connection.getAccountInfo(
    new PublicKey("SysvarC1ock11111111111111111111111111111111"),
  );
  return Number(
    new DataView(info.data.buffer, info.data.byteOffset, info.data.byteLength).getBigInt64(32, true),
  );
};
const waitFor = async (at, label) => {
  let now = await chainClock();
  if (now >= at) return;
  console.log(`  waiting ${at - now}s of chain time for ${label}…`);
  while (now < at) {
    await new Promise((r) => setTimeout(r, 2000));
    now = await chainClock();
  }
};

async function makeSession() {
  const now = await chainClock();
  const session = new Session({
    chain,
    wallet,
    store: new FileStore(),
    calendar: plan.rounds,
    now: () => now,
    randomBytes: async (n) => Uint8Array.from({ length: n }, (_, i) => (i * 11 + 5) % 256),
  });
  const connected = await session.connect();
  if (!connected.ok) throw new Error(`connect: ${connected.reason}`);
  return { session, now };
}

/** Seals round 0 through the session — the path "Seal today" takes. */
async function seal() {
  const { session, now } = await makeSession();
  const day = await session.day();
  console.log(`  today: phase=${day.today.phase} openReveals=${day.openReveals}`);
  if (day.today.phase !== "open") throw new Error(`the window is not open (phase ${day.today.phase})`);
  await session.saveAnswer(plan.rounds[0], 8_000, "the session wrote this", true);
  const result = await session.evening();
  console.log(`  sealed round ${result.sealed} in ${result.signature}`);
  const entry = decodeEntry(
    entryPda(roundPda(0), sgtMint),
    (await connection.getAccountInfo(entryPda(roundPda(0), sgtMint))).data,
  );
  if (!entry) throw new Error("no entry on chain");
  console.log(`  entry on chain, committed_at ${entry.committedAt}`);
  void now;
}

/** The evening: reveal round 0 and seal round 1 — ONE transaction, built by the session. */
async function evening() {
  await waitFor(plan.rounds[0].outcomeTime + 3, "the outcome");
  const { session } = await makeSession();
  const day = await session.day();
  console.log(`  openReveals=${day.openReveals}, today phase=${day.today.phase}`);
  if (day.today.phase === "open") {
    await session.saveAnswer(plan.rounds[1], 3_000);
  }
  const result = await session.evening();
  console.log(`  revealed ${JSON.stringify(result.revealed)}, sealed ${result.sealed}`);
  console.log(`  signature ${result.signature}`);
  const entry = decodeEntry(
    entryPda(roundPda(0), sgtMint),
    (await connection.getAccountInfo(entryPda(roundPda(0), sgtMint))).data,
  );
  if (!entry.revealed) throw new Error("round 0 is still not revealed");
  console.log(`  round 0 revealed with p=${entry.pBps / 100}%`);
  const result2 = await session.day();
  console.log(`  result line: "${result2.result?.sealedAnswer}" / "${result2.result?.verdict}"`);
  console.log(`  streak: "${result2.result?.streak}"`);
}

async function show() {
  const { session } = await makeSession();
  const day = await session.day();
  const player = await connection.getAccountInfo(
    (await import(join(APP, "src/chain/pda.ts"))).playerPda(sgtMint),
  );
  console.log(
    JSON.stringify(
      {
        today: day.today,
        result: day.result,
        player: player ? decodePlayer(player.data) : null,
      },
      null,
      2,
    ),
  );
}

const steps = { seal, evening, show };
if (!steps[step]) throw new Error(`usage: drive-session.mjs <${Object.keys(steps).join("|")}> <dir>`);
console.log(`--- ${step}`);
await steps[step]();
