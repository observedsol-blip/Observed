#!/usr/bin/env node
// The matrix: every shape of the daily transaction, actually sent, actually confirmed.
//
// Why this exists (owner, 22.09.2026). The seal memo went out as the raw 32 bytes of a hash. The
// SPL Memo program requires valid UTF-8, so the whole daily transaction failed — after the
// approval — for anybody who shared a sentence. No unit test saw it, because the tests build
// transactions and never send them through the real programs. This script closes that class of
// gap: each row below is built by the app's own code, signed, sent to a local validator with the
// real program and the real Memo program, confirmed, and then read back twice — once through the
// app (`Session`) and once through `scripts/verify-round.mjs`, which trusts nothing of ours.
//
//   node spikes/e2e/matrix.mjs            # the whole matrix, ~5 minutes
//   node spikes/e2e/matrix.mjs --warp     # explains why close_entry is not here (measured)
//   node spikes/e2e/matrix.mjs --keep     # leave the validator running afterwards
//
// Exit code 0 means every row passed. Any failure prints the row and the reason.
//
// The long window is not faked either. `close_entry` needs `outcome + 72 h`, which a test
// validator cannot reach — the reason is measured at the bottom of this file, and the
// instruction is covered by the program's own tests, where the clock can be set.
//   * "approvals = 1" counts TRANSACTIONS, not wallet sheets. How many sheets Seed Vault shows
//     is a measurement on the device (21.09.2026), and no script can replace it.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";

const REPO = join(import.meta.dirname, "..", "..");
const APP = join(REPO, "app");
const require = createRequire(join(APP, "package.json"));
const web3 = require("@solana/web3.js");
const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } = web3;

const { Session } = await import(join(APP, "src/core/session.ts"));
const { Chain } = await import(join(APP, "src/chain/rpc.ts"));
const { MemoryStore } = await import(join(APP, "src/core/store.ts"));
const { configPda, entryPda, playerPda, roundPda } = await import(join(APP, "src/chain/pda.ts"));

const KEEP = process.argv.includes("--keep");
/** Also run the long-window phase: `close_entry`, on a second chain whose clock is 72 h older. */
const WARP = process.argv.includes("--warp");
const RPC = "http://127.0.0.1:8899";
const DIR = join(homedir(), "e2e-matrix");
const SOLANA = join(homedir(), ".local/share/solana/install/active_release/bin");

// ---- schedule ---------------------------------------------------------------------------------
// One timeline for every "yesterday" round and one for every "today" round. Rounds are separate
// accounts, so they may share times; that is what keeps the whole matrix inside five minutes.
const W = 30; // submission window — wide enough to batch the readings of every call
const MAX_AGE = 90; // how old a reading may be when it is submitted
const SEAL_WINDOW = 165; // validator start + deploy + setup + every row's seal

const t0 = Math.floor(Date.now() / 1000);
const yesterday = { commitOpen: t0 - 60, commitClose: t0 + SEAL_WINDOW };
yesterday.referenceTime = yesterday.commitClose + MAX_AGE + 1;
yesterday.outcomeTime = yesterday.referenceTime + W + 1;
const today = { commitOpen: yesterday.outcomeTime - 40, commitClose: yesterday.outcomeTime + 900 };
today.referenceTime = today.commitClose + MAX_AGE + 1;
today.outcomeTime = today.referenceTime + W + 1;
// One frozen reading, inside MAX_AGE of both of yesterday's submissions.
const publishTime = yesterday.referenceTime - 20;

/** Which round belongs to which row, and on which timeline. */
const ROUNDS = [
  { id: 0, when: "yesterday", for: "R1 first seal, Up, no sentence" },
  { id: 1, when: "yesterday", for: "R2 first seal, Down, private sentence" },
  { id: 2, when: "yesterday", for: "R3 first seal, deliberate 50, shared sentence" },
  { id: 3, when: "yesterday", for: "R4 evening: this one is revealed" },
  { id: 4, when: "today", for: "R4 evening: this one is sealed" },
  { id: 5, when: "yesterday", for: "R5 reveal only" },
  { id: 6, when: "yesterday", for: "R6 missed day: sealed before the gap" },
  { id: 7, when: "yesterday", for: "R6 missed day: never sealed" },
  { id: 8, when: "today", for: "R6 missed day: sealed after the gap" },
  { id: 9, when: "yesterday", for: "R7 recovery from the backup code" },
  { id: 10, when: "yesterday", for: "R8 scored by the resolver, then revealed" },
  { id: 11, when: "today", for: "R8 the evening after the scoring" },
];

// ---- plan (calendar, Merkle tree, validator accounts) -------------------------------------------
const sha256 = (...parts) => createHash("sha256").update(Buffer.concat(parts)).digest();
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };

const fixture = (name) => JSON.parse(readFileSync(join(REPO, "tests/fixtures", `${name}.json`), "utf8"));
const validatorAccount = (pubkey, owner, lamports, data) => ({
  pubkey,
  account: { lamports, data: [data.toString("base64"), "base64"], owner, executable: false, rentEpoch: 0 },
});

rmSync(DIR, { recursive: true, force: true });
mkdirSync(join(DIR, "accounts"), { recursive: true });

// Deterministic test keys, derived from fixed seeds: nothing secret is invented here, and
// nothing is ever printed. The CLI needs the payer as a file for `solana program deploy`, so one
// is written into the run directory (outside the repository, deleted with it). It only ever
// holds airdropped SOL on a chain that lives for five minutes.
const player = Keypair.fromSeed(Uint8Array.from(Array(32).fill(7)));
const authority = Keypair.fromSeed(Uint8Array.from(Array(32).fill(1))); // DEPLOY_AUTHORITY
const PLAYER_FILE = join(DIR, "player.json");
// The same deterministic test key the run already uses, on disk for the published script to
// sign with. It lives in the run directory and goes with it; nothing is generated here.
const AUTHORITY_FILE = join(DIR, "authority.json");
writeFileSync(PLAYER_FILE, JSON.stringify([...player.secretKey]), { mode: 0o600 });
writeFileSync(AUTHORITY_FILE, JSON.stringify([...authority.secretKey]), { mode: 0o600 });

const accounts = [];
for (const name of ["sgt/sgt-group", "sgt/sgt-mint"]) {
  const f = fixture(name);
  accounts.push(validatorAccount(f.pubkey, f.owner, f.lamports, Buffer.from(f.data_base64, "base64")));
}
const token = fixture("sgt/sgt-token-account");
const tokenData = Buffer.from(token.data_base64, "base64");
player.publicKey.toBuffer().copy(tokenData, 32); // the owner field
accounts.push(validatorAccount(token.pubkey, token.owner, token.lamports, tokenData));

const feed = fixture("pyth/real-sol-sponsored");
const feedData = Buffer.from(feed.data_base64, "base64");
const PUBLISH_AT = 93;
feedData.writeBigInt64LE(BigInt(publishTime), PUBLISH_AT);
feedData.writeBigInt64LE(BigInt(publishTime - 1), PUBLISH_AT + 8);
accounts.push(validatorAccount(feed.pubkey, feed.owner, feed.lamports, feedData));
for (const a of accounts) writeFileSync(join(DIR, "accounts", `${a.pubkey}.json`), JSON.stringify(a, null, 1));

const SEASON = 1;
const termsFor = (id, when) => ({
  season: SEASON,
  roundId: id,
  version: 3,
  kind: 0, // direction: the standard question of the season
  sourceKind: 1,
  feedId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  priceAccount: feed.pubkey,
  offsetBps: 0,
  maxConfBps: 5000,
  bandBps: 25,
  windowSecs: W,
  maxAgeSecs: MAX_AGE,
  closeAfterSecs: 60,
  earliestCloseUnix: t0,
  ...(when === "yesterday" ? yesterday : today),
});
const termsHash = (t) =>
  sha256(
    Buffer.from("observed/terms/v3", "utf8"),
    u16(t.season), u32(t.roundId),
    Buffer.from([t.version, t.kind, t.sourceKind]),
    Buffer.from(t.feedId, "hex"),
    new PublicKey(t.priceAccount).toBuffer(),
    i32(t.offsetBps), u16(t.maxConfBps), u16(t.bandBps), u16(t.windowSecs), u16(t.maxAgeSecs),
    u32(t.closeAfterSecs), i64(t.earliestCloseUnix),
    i64(t.commitOpen), i64(t.commitClose), i64(t.referenceTime), i64(t.outcomeTime),
  );

const terms = ROUNDS.map((r) => termsFor(r.id, r.when));
const hashes = terms.map(termsHash);
const emptyLeaf = sha256(Buffer.from([0]), Buffer.alloc(32));
const leaves = Array.from({ length: 64 }, (_, i) => (i < hashes.length ? sha256(Buffer.from([0]), hashes[i]) : emptyLeaf));
const levels = [leaves];
while (levels.at(-1).length > 1) {
  const prev = levels.at(-1);
  const next = [];
  for (let i = 0; i < prev.length; i += 2) next.push(sha256(Buffer.from([1]), prev[i], prev[i + 1]));
  levels.push(next);
}
const proofFor = (index) => {
  const proof = [];
  let idx = index;
  for (let l = 0; l < levels.length - 1; l++) {
    proof.push(levels[l][idx ^ 1].toString("hex"));
    idx >>= 1;
  }
  return proof;
};

const plan = {
  season: SEASON,
  gameId: "1",
  merkleRoot: levels.at(-1)[0].toString("hex"),
  sgtMint: accounts[1].pubkey,
  sgtToken: token.pubkey,
  rounds: terms.map((t, i) => ({
    ...t,
    termsHash: hashes[i].toString("hex"),
    proof: proofFor(i),
    revealCloseUtc: new Date((t.outcomeTime + 72 * 3600) * 1000).toISOString(),
    feed: "SOL/USD",
    measuredDay: new Date(t.commitClose * 1000).toISOString().slice(0, 10),
    question: "Will SOL be higher at the outcome than at the reference?",
    context: null,
  })),
};
const PLAN_FILE = join(DIR, "plan.json");
writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
const calendarOf = (...ids) => plan.rounds.filter((r) => ids.includes(r.roundId));

// ---- validator ----------------------------------------------------------------------------------
const sh = (cmd, args, opts = {}) =>
  execFileSync(join(SOLANA, cmd), args, { encoding: "utf8", stdio: "pipe", ...opts });

console.log("starting the validator…");
const accountArgs = accounts.flatMap((a) => ["--account", a.pubkey, join(DIR, "accounts", `${a.pubkey}.json`)]);
const validator = spawn(join(SOLANA, "solana-test-validator"),
  ["--reset", "--ledger", join(DIR, "ledger"), ...accountArgs],
  { cwd: DIR, stdio: ["ignore", "ignore", "ignore"], detached: true });
const stopValidator = () => {
  if (KEEP) return;
  try { validator.kill("SIGTERM"); } catch { /* already gone */ }
};
process.on("exit", stopValidator);

const connection = new Connection(RPC, "confirmed");
for (let i = 0; i < 60; i += 1) {
  try {
    sh("solana", ["airdrop", "20", player.publicKey.toBase58(), "-u", RPC]);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 2000));
  }
}
sh("solana", ["airdrop", "20", authority.publicKey.toBase58(), "-u", RPC]);
console.log("deploying the program…");
// The deploy is the step that fails silently if the validator is not ready: it can leave a
// buffer behind and a program account that is executable but empty, and the next instruction
// then says "Program is not deployed". So: wait for a healthy validator, deploy, and read the
// deploy's own output instead of assuming.
for (let i = 0; i < 60; i += 1) {
  try {
    const health = await connection.getHealth?.() ?? "ok";
    const slot = await connection.getSlot("finalized");
    if (health === "ok" && slot > 3) break;
  } catch { /* still starting */ }
  await new Promise((r) => setTimeout(r, 1000));
}
try {
  const out = sh("solana", ["program", "deploy", join(REPO, "target/deploy/observed.so"),
    "--program-id", join(REPO, "target/deploy/observed-keypair.json"),
    "-u", RPC, "--keypair", PLAYER_FILE].map(String), { stdio: ["ignore", "pipe", "pipe"] });
  console.log(`  ${String(out).trim().split("\n").join(" | ")}`);
} catch (e) {
  throw new Error(`deploy failed: ${String(e.stdout ?? "")} ${String(e.stderr ?? "")}`.slice(0, 500));
}

// ---- admin instructions (what the owner and the resolver do, not the app) -----------------------
const idl = JSON.parse(readFileSync(join(REPO, "target/idl/observed.json"), "utf8"));
const PROGRAM = new PublicKey(idl.address);

// A deploy returns before the program can be invoked. The account turns executable at once,
// but the runtime refuses it for another slot or two with "Unsupported program id" — which reads
// like a wrong address and is only impatience. So: wait for executable, then knock until the
// program actually answers.
for (let i = 0; i < 40; i += 1) {
  const info = await connection.getAccountInfo(PROGRAM);
  if (info?.executable) break;
  if (i === 39) throw new Error("the program never became executable");
  await new Promise((r) => setTimeout(r, 1000));
}
// "executable" is not the same as "usable": until the loader has written the ProgramData, every
// call answers "Program is not deployed". Knock until that line is gone.
for (let i = 0; i < 60; i += 1) {
  const probe = new Transaction().add(new TransactionInstruction({
    programId: PROGRAM,
    keys: [],
    data: Buffer.from([0]), // not a real instruction: the log is what matters
  }));
  probe.feePayer = player.publicKey;
  probe.recentBlockhash = (await connection.getLatestBlockhash("finalized")).blockhash;
  const { value } = await connection.simulateTransaction(probe);
  const logs = value.logs ?? [];
  const notDeployed = logs.some((l) => l.includes("Program is not deployed"));
  const answered = logs.some((l) => l.includes("invoke [1]"));
  if (answered && !notDeployed) break;
  if (i === 59) throw new Error(`the program never became usable: ${logs.join(" | ")}`);
  await new Promise((r) => setTimeout(r, 1000));
}
console.log("  program is usable");
const disc = (name) => Buffer.from(idl.instructions.find((i) => i.name === name).discriminator);
const config = configPda();
const sgtMint = new PublicKey(plan.sgtMint);
const feedAccount = new PublicKey(feed.pubkey);

/** What the resolver's own instructions cost, measured the same way as the app's. */
const adminCu = [];
const send = async (ixs, signers, label) => {
  const tx = new Transaction().add(...ixs);
  try {
    const signature = await web3.sendAndConfirmTransaction(connection, tx, signers, { commitment: "confirmed" });
    for (let i = 0; i < 8; i += 1) {
      const got = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      if (got) {
        adminCu.push({ label, cu: got.meta?.computeUnitsConsumed ?? null, signature });
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    return signature;
  } catch (e) {
    const logs = e.transactionLogs ?? e.logs ?? [];
    // The whole log, not the first 200 characters: a truncated program error is a riddle.
    throw new Error(`${label}: ${String(e.message).split("\n")[0]}\n    ${logs.join("\n    ")}`);
  }
};
const ix = (keys, data) => new TransactionInstruction({ programId: PROGRAM, keys, data });
const meta = (pubkey, isSigner, isWritable) => ({ pubkey, isSigner, isWritable });

const clock = async () => {
  const info = await connection.getAccountInfo(new PublicKey("SysvarC1ock11111111111111111111111111111111"));
  return Number(new DataView(info.data.buffer, info.data.byteOffset, info.data.byteLength).getBigInt64(32, true));
};
const waitFor = async (at, label) => {
  let now = await clock();
  if (now >= at) return;
  console.log(`  waiting ${at - now}s of chain time for ${label}…`);
  while (now < at) {
    await new Promise((r) => setTimeout(r, 2000));
    now = await clock();
  }
};

async function setup() {
  await send([ix(
    [meta(authority.publicKey, true, true), meta(config, false, true), meta(SystemProgram.programId, false, false)],
    Buffer.concat([disc("initialize"), u64(plan.gameId), authority.publicKey.toBuffer(), authority.publicKey.toBuffer()]),
  )], [authority], "initialize");
  await send([ix(
    [meta(authority.publicKey, true, false), meta(config, false, true)],
    Buffer.concat([disc("publish_calendar"), u16(plan.season), Buffer.from(plan.merkleRoot, "hex"), u32(64)]),
  )], [authority], "publish_calendar");
  for (const r of plan.rounds) {
    const termsBytes = Buffer.concat([
      Buffer.from([r.version, r.kind, r.sourceKind]),
      Buffer.from(r.feedId, "hex"),
      new PublicKey(r.priceAccount).toBuffer(),
      i32(r.offsetBps), u16(r.maxConfBps), u16(r.bandBps), u16(r.windowSecs), u16(r.maxAgeSecs),
      u32(r.closeAfterSecs), i64(r.earliestCloseUnix),
      i64(r.commitOpen), i64(r.commitClose), i64(r.referenceTime), i64(r.outcomeTime),
    ]);
    const proof = Buffer.concat([u32(r.proof.length), ...r.proof.map((p) => Buffer.from(p, "hex"))]);
    // The LAST round is created by the script the README hands to strangers, not by this
    // harness. A page that says "anyone can do this" is worth nothing until the commands on it
    // have been run against the real program — so they are, on every matrix run.
    if (r.roundId === plan.rounds[plan.rounds.length - 1].roundId) {
      const out = runPublished("create", r.roundId, ["--calendar", PLAN_FILE]);
      console.log(`  create_round ${r.roundId} via scripts/resolve-round.mjs: ${out.ok ? "ok" : "FAILED"}`);
      if (!out.ok) throw new Error(`published create_round failed:\n${out.output}`);
      continue;
    }
    await send([ix(
      [meta(authority.publicKey, true, true), meta(config, false, true), meta(roundPda(r.roundId), false, true),
        meta(SystemProgram.programId, false, false)],
      Buffer.concat([disc("create_round"), u32(r.roundId), termsBytes, proof]),
    )], [authority], `create_round ${r.roundId}`);
  }
  console.log(`  ${plan.rounds.length} calls created`);
}

/**
 * Four readings per transaction. One by one would not fit: the window is `W` seconds wide for
 * every call at once, and a dozen separate transactions take longer than that.
 */
async function inBatches(ids, build, label) {
  const SIZE = 4;
  for (let i = 0; i < ids.length; i += SIZE) {
    const batch = ids.slice(i, i + SIZE);
    await send(
      [web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 60_000 * batch.length }),
        ...batch.map(build)],
      [authority],
      `${label} ${batch.join(",")}`,
    );
  }
}

const readingIx = (name, roundId) => ix(
  [meta(authority.publicKey, true, false), meta(config, false, false), meta(roundPda(roundId), false, true),
    meta(feedAccount, false, false)],
  disc(name),
);
const scoreIx = (roundId, entry) => ix(
  [meta(config, false, false), meta(roundPda(roundId), false, false), meta(entry, false, true),
    meta(playerPda(sgtMint), false, true)],
  disc("score_entry"),
);

// ---- the app's side: one session per row, with its own store and its own calendar ---------------
function makeSession(calendar, store = new MemoryStore(), secretSeed = 3) {
  const seen = { approvals: 0, signatures: [], bytes: [], budgets: [] };
  const wallet = {
    connect: async () => ({ pubkey: player.publicKey, label: "local keypair" }),
    signAndSend: async (instructions, payer) => {
      seen.approvals += 1;
      const tx = new Transaction({
        feePayer: payer,
        recentBlockhash: (await connection.getLatestBlockhash("finalized")).blockhash,
      }).add(...instructions);
      tx.sign(player);
      const raw = tx.serialize();
      seen.bytes.push(raw.length);
      // What the app asked for, read back out of its own instruction — so a budget that is too
      // small shows up as a number instead of a puzzle.
      const first = instructions[0]?.data;
      const budget = first && first[0] === 2 ? Buffer.from(first).readUInt32LE(1) : null;
      seen.budgets.push(budget);
      try {
        const signature = await connection.sendRawTransaction(raw);
        await connection.confirmTransaction(signature, "confirmed");
        seen.signatures.push(signature);
        return signature;
      } catch (e) {
        const logs = e.transactionLogs ?? e.logs ?? [];
        const hit = logs.map((l) => /consumed (\d+) of (\d+)/.exec(l)).find(Boolean);
        const detail = hit ? ` — consumed ${hit[1]} of ${hit[2]}, the app budgeted ${budget}` : "";
        throw new Error(`${String(e.message).split("\n")[0]}${detail}`);
      }
    },
    disconnect: async () => {},
  };
  const session = new Session({
    chain: new Chain(connection),
    wallet,
    store,
    calendar,
    now: () => nowChain,
    randomBytes: async (n) => Uint8Array.from({ length: n }, (_, i) => (i * 13 + secretSeed) % 256),
  });
  return { session, seen, store };
}
let nowChain = t0;

/** Compute units and confirmation, straight from the ledger. */
async function txFacts(signature) {
  for (let i = 0; i < 10; i += 1) {
    const tx = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (tx) return { confirmed: !tx.meta?.err, cu: tx.meta?.computeUnitsConsumed ?? null };
    await new Promise((r) => setTimeout(r, 500));
  }
  return { confirmed: false, cu: null };
}

/**
 * Runs `scripts/resolve-round.mjs` — the script the README gives to anybody who wants to
 * resolve a round themselves. Running it here is the proof that the page is not fiction.
 */
function runPublished(command, roundId, extra = []) {
  const result = spawnSync("node", [join(REPO, "scripts/resolve-round.mjs"), command,
    "--round", String(roundId), "--rpc", RPC, "--keypair", AUTHORITY_FILE, ...extra],
    { encoding: "utf8" });
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function verifyRound(roundId) {
  const result = spawnSync("node", [join(REPO, "scripts/verify-round.mjs"),
    "--round", String(roundId), "--rpc", RPC, "--calendar", PLAN_FILE, "--deep"],
    { encoding: "utf8" });
  return { pass: result.status === 0, output: result.stdout ?? "" };
}

// ---- rows ---------------------------------------------------------------------------------------
/** What the published script printed, so the run can show it instead of claiming it. */
const publishedProof = [];
const rows = [];
const record = async (id, what, seen, extra = {}) => {
  const facts = await Promise.all(seen.signatures.map(txFacts));
  rows.push({
    id,
    what,
    approvals: seen.approvals,
    signatures: seen.signatures,
    confirmed: facts.every((f) => f.confirmed) && facts.length > 0,
    cu: facts.map((f) => f.cu).join(" + "),
    budgeted: seen.budgets.join(" + "),
    bytes: seen.bytes.join(" + "),
    ...extra,
  });
};

const fail = (id, what, message) => {
  rows.push({ id, what, approvals: 0, signatures: [], confirmed: false, cu: "—", bytes: "—", error: message });
  console.log(`  FAILED ${id}: ${message}`);
};

/** Runs one row. A row that throws is a finding, not the end of the matrix. */
async function row(id, what, body) {
  try {
    return await body();
  } catch (e) {
    fail(id, what, e instanceof Error ? e.message.slice(0, 300) : String(e));
    return null;
  }
}

async function sealRow(id, what, roundId, pBps, sentence, share) {
  return row(id, what, async () => {
    nowChain = await clock();
    const { session, seen, store } = makeSession(calendarOf(roundId));
    const connected = await session.connect();
    if (!connected.ok) throw new Error(`connect: ${connected.reason}`);
    await session.saveAnswer(plan.rounds.find((r) => r.roundId === roundId), pBps, sentence, share);
    await session.evening();
    const entry = await new Chain(connection).entry(roundId, sgtMint);
    await record(id, what, seen, { entryOnChain: entry !== null, store, pBps });
    return { session, store, seen };
  });
}

console.log("\n--- setup");
await setup();

console.log("\n--- first seals (commit only)");
const r1 = await sealRow("R1", "first seal · Up 80 · no sentence", 0, 8_000, undefined, false);
const r2 = await sealRow("R2", "first seal · Down 80 · sentence private", 1, 2_000, "Funding flipped negative.", false);
const r3 = await sealRow("R3", "first seal · deliberate 50 · sentence shared", 2, 5_000, "Genuinely no idea.", true);

console.log("\n--- seals for the later rows");
const r4a = await sealRow("R4a", "seal that R4 will reveal · Up 90 · shared", 3, 9_000, "Momentum is up.", true);
const r5a = await sealRow("R5a", "seal that R5 will reveal · Down 70", 5, 3_000, undefined, false);
const r6a = await sealRow("R6a", "seal before the missed day · Up 65", 6, 6_500, "Before the gap.", false);
const r7a = await sealRow("R7a", "seal that R7 recovers · Up 75 · shared", 9, 7_500, "This one gets restored.", true);
const r8a = await sealRow("R8a", "seal the resolver will score · Down 85", 10, 1_500, undefined, false);
// round 7 is deliberately never sealed: that is the missed day.

console.log("\n--- the readings (what the resolver does)");
await waitFor(yesterday.referenceTime + 1, "set_reference");
const yesterdayIds = ROUNDS.filter((r) => r.when === "yesterday").map((r) => r.id);
// Call 7 is nobody's: never sealed, and now deliberately left without a reading, so that
// `cancel_round` can be measured on the thing it is for instead of on a refusal.
const CANCEL_ID = 7;
const toRead = yesterdayIds.filter((id) => id !== CANCEL_ID);
// The first one alone, so its cost is visible on its own; the rest batched, as the resolver
// does it. Both numbers matter: the single one for the budget, the batch for the window.
{
  const out = runPublished("reference", toRead[0]);
  console.log(`  set_reference ${toRead[0]} via scripts/resolve-round.mjs: ${out.ok ? "ok" : "FAILED"}`);
  if (!out.ok) throw new Error(`published set_reference failed:\n${out.output}`);
  publishedProof.push(out.output.trim());
}
await inBatches(toRead.slice(1), (id) => readingIx("set_reference", id), "set_reference");
await waitFor(yesterday.outcomeTime + 1, "resolve");
{
  const out = runPublished("resolve", toRead[0]);
  console.log(`  resolve ${toRead[0]} via scripts/resolve-round.mjs: ${out.ok ? "ok" : "FAILED"}`);
  if (!out.ok) throw new Error(`published resolve failed:\n${out.output}`);
  publishedProof.push(out.output.trim());
}
await inBatches(toRead.slice(1), (id) => readingIx("resolve", id), "resolve");
console.log(`  ${toRead.length} calls referenced and resolved, call ${CANCEL_ID} left unread on purpose`);

console.log("\n--- the evening and the rest");
nowChain = await clock();

// R4: reveal yesterday and seal today, in ONE transaction
await row("R4", "evening · reveal 3 + seal 4 · both sentences shared", async () => {
  if (!r4a) throw new Error("the seal for this row did not happen");
  const { session, seen } = makeSession(calendarOf(3, 4), r4a.store);
  await session.connect();
  await session.saveAnswer(plan.rounds.find((r) => r.roundId === 4), 7_000, "Tonight's sentence.", true);
  const result = await session.evening();
  const entry3 = await new Chain(connection).entry(3, sgtMint);
  const entry4 = await new Chain(connection).entry(4, sgtMint);
  await record("R4", "evening · reveal 3 + seal 4 · both sentences shared", seen, {
    revealed: entry3?.revealed === true,
    sealedToday: entry4 !== null,
    reveals: result.revealed.join(","),
  });
});

// R5: reveal only — no open call today
await row("R5", "reveal only · no seal in the transaction", async () => {
  if (!r5a) throw new Error("the seal for this row did not happen");
  const { session, seen } = makeSession(calendarOf(5), r5a.store);
  await session.connect();
  await session.evening();
  const entry = await new Chain(connection).entry(5, sgtMint);
  await record("R5", "reveal only · no seal in the transaction", seen, { revealed: entry?.revealed === true });
});

// R6: a day was missed — seal today, reveal the one from before the gap
await row("R6", "commit after a missed day · reveals the older call", async () => {
  if (!r6a) throw new Error("the seal for this row did not happen");
  const { session, seen } = makeSession(calendarOf(6, 7, 8), r6a.store);
  await session.connect();
  await session.saveAnswer(plan.rounds.find((r) => r.roundId === 8), 4_000, undefined, false);
  await session.evening();
  const before = await new Chain(connection).entry(6, sgtMint);
  const missed = await new Chain(connection).entry(7, sgtMint);
  const after = await new Chain(connection).entry(8, sgtMint);
  await record("R6", "commit after a missed day · reveals the older call", seen, {
    revealed: before?.revealed === true,
    missedStayedEmpty: missed === null,
    sealedToday: after !== null,
  });
});

// R7: a fresh install restores from the backup code, then reveals
await row("R7", "restore from the backup code, then reveal", async () => {
  if (!r7a) throw new Error("the seal for this row did not happen");
  const code = await r7a.session.exportSecret();
  // A different seed, so the fresh install really starts with a different secret — otherwise
  // this row would prove nothing.
  const { session, seen } = makeSession(calendarOf(9), new MemoryStore(), 99);
  await session.connect();
  const restored = await session.importSecret(code);
  await session.evening();
  const entry = await new Chain(connection).entry(9, sgtMint);
  await record("R7", "restore from the backup code, then reveal", seen, {
    recovered: restored.recovered.join(","),
    lost: restored.lost.length,
    revealed: entry?.revealed === true,
  });
});

// R8: the resolver scores separately; afterwards the next evening still works
await row("R8", "resolver scores separately · the next evening still confirms", async () => {
  if (!r8a) throw new Error("the seal for this row did not happen");
  const entryBefore = await new Chain(connection).entry(10, sgtMint);
  const { session, seen } = makeSession(calendarOf(10), r8a.store);
  await session.connect();
  await session.evening(); // reveal first, so the score is a real one and not a missing
  await send([scoreIx(10, entryPda(roundPda(10), sgtMint))], [player], "score_entry 10");
  const scored = await new Chain(connection).entry(10, sgtMint);

  nowChain = await clock();
  const { session: next, seen: seenNext } = makeSession(calendarOf(10, 11), r8a.store);
  await next.connect();
  await next.saveAnswer(plan.rounds.find((r) => r.roundId === 11), 6_000, undefined, false);
  await next.evening();
  const view = await next.record();
  await record("R8", "resolver scores separately · the next evening still confirms", seenNext, {
    scoredByResolver: scored?.scored === true,
    scoreBps: scored?.scoreBps,
    recordShowsIt: view.calls.some((c) => c.roundId === 10 && c.brier !== null),
    entryExisted: entryBefore !== null,
  });
});

// ---- what the resolver's remaining instructions cost --------------------------------------------
await row("M-cancel", "cancel_round on the call that lost its window", async () => {
  await send([ix(
    [meta(config, false, false), meta(roundPda(CANCEL_ID), false, true)],
    disc("cancel_round"),
  )], [player], "cancel_round");
  const after = await new Chain(connection).round(CANCEL_ID);
  if (after?.status !== 4) throw new Error(`cancel did not take: status ${after?.status}`);
});

// How much does one more entry in a batch really cost? The resolver budgets 13 000 per entry
// and packs ten of them; measured alone, one costs about 12 000 — but most of that is the fixed
// part of a transaction, so the marginal cost is the number that decides whether ten fit.
await row("M-score-batch", "score_entry, several in one transaction", async () => {
  // Only revealed entries can be scored before the window closes — the program refuses the rest,
  // and rightly so. These four were revealed by rows R4 to R7.
  const ids = [3, 5, 6, 9];
  await send(
    [web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ...ids.map((id) => scoreIx(id, entryPda(roundPda(id), sgtMint)))],
    [player],
    `score_entry ×${ids.length} (batched)`,
  );
});

// ---- verify every resolved call, with the script a stranger would use ----------------------------
console.log("\n--- verify-round.mjs");
const verified = new Map();
for (const id of yesterdayIds) {
  const { pass } = verifyRound(id);
  verified.set(id, pass);
  console.log(`  call ${id}: ${pass ? "PASS" : "FAIL"}`);
}

// ---- the table -----------------------------------------------------------------------------------
const roundOfRow = { R1: 0, R2: 1, R3: 2, R4a: 3, R4: 3, R5a: 5, R5: 5, R6a: 6, R6: 6, R7a: 9, R7: 9, R8a: 10, R8: 10 };
console.log("\n=== matrix ===");
console.log("row  | approvals | confirmed | CU used       | budgeted  | bytes     | verify | what");
let failures = 0;
for (const row of rows) {
  const verify = verified.get(roundOfRow[row.id]);
  const verifyText = verify === undefined ? "—" : verify ? "PASS" : "FAIL";
  const ok = row.confirmed && row.approvals === 1 && verify !== false;
  if (!ok) failures += 1;
  console.log(
    `${row.id.padEnd(4)} | ${String(row.approvals).padEnd(9)} | ${String(row.confirmed).padEnd(9)} | ` +
    `${String(row.cu).padEnd(13)} | ${String(row.budgeted ?? "—").padEnd(9)} | ${String(row.bytes).padEnd(9)} | ` +
    `${verifyText.padEnd(6)} | ${row.what}`,
  );
  for (const [k, v] of Object.entries(row)) {
    if (["id", "what", "approvals", "signatures", "confirmed", "cu", "budgeted", "bytes", "store"].includes(k)) continue;
    console.log(`     ${k}: ${v}`);
  }
  for (const s of row.signatures) console.log(`     sig ${s}`);
}
// ---- what the program searches for, and what that costs -------------------------------------
console.log("\n=== scripts/resolve-round.mjs, run against this validator ===");
for (const block of publishedProof) console.log(block.split("\n").map((l) => `  ${l}`).join("\n"));

console.log("\n=== PDA derivation: where the program searches instead of computing ===");
console.log("Only `commit` searches (lib.rs: entry `bump`, player `bump`). Every other account,");
console.log("and every instruction the resolver sends, carries a stored bump — constant cost.");
const playerBump = PublicKey.findProgramAddressSync(
  [Buffer.from("player"), config.toBuffer(), sgtMint.toBuffer()], PROGRAM,
)[1];
console.log(`  player PDA bump: ${playerBump} (${255 - playerBump} search steps, every commit pays it)`);
const bumps = plan.rounds.map((r) => ({
  id: r.roundId,
  bump: PublicKey.findProgramAddressSync(
    [Buffer.from("entry"), roundPda(r.roundId).toBuffer(), sgtMint.toBuffer()], PROGRAM,
  )[1],
}));
const worst = bumps.reduce((a, b) => (a.bump <= b.bump ? a : b));
console.log(`  entry PDA bumps: ${bumps.map((b) => b.bump).join(" ")}`);
console.log(`  deepest search in this run: call ${worst.id}, bump ${worst.bump}, ` +
  `${255 - worst.bump} steps ≈ ${(255 - worst.bump) * 1530} CU on top`);

console.log("\n=== what the resolver's instructions cost ===");
for (const a of adminCu) console.log(`  ${String(a.label).padEnd(34)} ${String(a.cu ?? "—").padStart(8)} CU`);

// ---- the long window: why close_entry is not in this run ---------------------------------------
// The attempt is kept as a measurement rather than deleted, because the result is the useful
// part. `close_entry` needs `reveal_close + close_after`, and `reveal_close` is `outcome + 72 h`.
// A test validator's clock can be warped — but only inside its epoch: the gain is
// `(warp_slot mod 432 000) × 0.3 s`, measured across four values on 22.09.2026:
//
//     648 000 slots → +64 801 s      1 300 000 → +1 201 s
//   2 000 000 slots → +81 601 s      2 630 631 → +11 590 s
//
// So one hop reaches at most ~36 h, and hops do not add up: every fresh chain starts back at the
// wall clock, no matter which accounts are copied onto it. 72 h is therefore out of reach here.
//
// Where it IS proven: the program's own tests run on LiteSVM, whose clock is settable. They cover
// the refusal before the date, the close after scoring, the close on a cancelled round, a
// stranger closing on a player's behalf, and a thief trying to redirect the rent — and they print
// the cost (9 138 CU), which is what the resolver's budget was corrected against.
if (WARP) {
  console.log("\n--- close_entry: not reachable here, and that is measured, not assumed");
  console.log("  a warp reaches at most ~36 h (gain = (warp_slot mod 432 000) × 0.3 s),");
  console.log("  and a fresh chain starts at the wall clock again — 72 h cannot be reached.");
  console.log("  close_entry is covered in programs/observed/tests/observed.rs (LiteSVM clock),");
  console.log("  measured there at 9 138 CU — the number the resolver's budget now carries.");
}

console.log(`\n${failures === 0 ? "ALL ROWS PASS" : `${failures} ROW(S) FAILED`} · ${rows.length} rows`);
if (!WARP) console.log("close_entry is covered by the program tests, not here — pass --warp for why.");
if (!KEEP) stopValidator();
process.exit(failures === 0 ? 0 : 1);
