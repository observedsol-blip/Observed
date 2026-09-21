#!/usr/bin/env node
// The same end-to-end round as drive.mjs — but the player's steps come from the APP's own code.
//
// Point of the exercise: if the app's commitment, PDAs, instruction layout and daily transaction
// are wrong in any byte, the program refuses them here, on a real validator, with the real
// program. Unit tests against fixtures cannot show that; this can.
//
//   node drive-app.mjs <step> <dir>     step = setup | seal | readings | evening | score | show
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const APP = join(import.meta.dirname, "..", "..", "app");
const require = createRequire(join(APP, "package.json"));
const web3 = require("@solana/web3.js");
const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } = web3;

// the app's own modules — this is the whole point
const { commitmentHash, saltFor } = await import(join(APP, "src/chain/commitment.ts"));
const { configPda, entryPda, playerPda, roundPda } = await import(join(APP, "src/chain/pda.ts"));
const { buildDaily, commitIx, revealIx } = await import(join(APP, "src/chain/ix.ts"));
const { decodeEntry, decodePlayer, decodeRound } = await import(join(APP, "src/chain/layout.ts"));
const { hexToBytes, bytesToHex, roundIsInTheCalendar, openForReveal, openForSealing } =
  await import(join(APP, "src/chain/calendar.ts"));
const { outcomeFor } = await import(join(APP, "src/core/revealing.ts"));

const [step, dir] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(join(dir, "plan.json"), "utf8"));
const idl = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "target/idl/observed.json"), "utf8"));
const connection = new Connection("http://127.0.0.1:8899", "confirmed");
const key = (file) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(file, "utf8"))));
const player = key(join(dir, "player.json"));
const authority = Keypair.fromSeed(Uint8Array.from(Array(32).fill(1)));

const disc = (name) => Uint8Array.from(idl.instructions.find((i) => i.name === name).discriminator);
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };

const sgtMint = new PublicKey(plan.sgtMint);
const sgtToken = new PublicKey(plan.sgtToken);
const feedAccount = new PublicKey(plan.rounds[0].priceAccount);
const config = configPda();
/** The season secret of this test device — in the app it comes from the wallet signature. */
const secret = Uint8Array.from(Array(32).fill(0x5a));
const P_BPS = 8_000;

/** The validator's own clock, not the wall clock: a fresh test validator starts at genesis and
 *  drifts behind real time, so every wait in this run has to follow the chain. */
const CLOCK = new PublicKey("SysvarC1ock11111111111111111111111111111111");
const chainTime = async () => {
  const info = await connection.getAccountInfo(CLOCK);
  return Number(new DataView(info.data.buffer, info.data.byteOffset, info.data.byteLength).getBigInt64(32, true));
};
const waitForChainTime = async (at, label) => {
  let now = await chainTime();
  if (now >= at) return;
  console.log(`  waiting ${at - now}s of chain time for ${label}…`);
  while (now < at) {
    await new Promise((r) => setTimeout(r, 2000));
    now = await chainTime();
  }
};

const send = async (ixs, signers, label) => {
  const tx = new Transaction().add(...ixs);
  const sig = await web3.sendAndConfirmTransaction(connection, tx, signers, { commitment: "confirmed" });
  console.log(`  ${label}: ${sig}`);
  return sig;
};

async function setup() {
  await send(
    [
      new TransactionInstruction({
        programId: new PublicKey(idl.address),
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: config, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([disc("initialize"), u64(plan.gameId), authority.publicKey.toBuffer(), authority.publicKey.toBuffer()]),
      }),
    ],
    [authority],
    "initialize",
  );
  await send(
    [
      new TransactionInstruction({
        programId: new PublicKey(idl.address),
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: false },
          { pubkey: config, isSigner: false, isWritable: true },
        ],
        data: Buffer.concat([disc("publish_calendar"), u16(plan.season), Buffer.from(plan.merkleRoot, "hex"), u32(64)]),
      }),
    ],
    [authority],
    "publish_calendar",
  );
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
    await send(
      [
        new TransactionInstruction({
          programId: new PublicKey(idl.address),
          keys: [
            { pubkey: authority.publicKey, isSigner: true, isWritable: true },
            { pubkey: config, isSigner: false, isWritable: true },
            { pubkey: roundPda(r.roundId), isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: Buffer.concat([disc("create_round"), u32(r.roundId), termsBytes, proof]),
        }),
      ],
      [authority],
      `create_round ${r.roundId}`,
    );
  }
  // the app checks the calendar it ships against the root on chain
  const cfg = await connection.getAccountInfo(config);
  const root = cfg.data.subarray(88, 120);
  for (const r of plan.rounds) {
    if (!roundIsInTheCalendar(r, root)) throw new Error(`round ${r.roundId} does not prove against the chain`);
  }
  console.log("  the app proved both rounds against the root on chain");
}

/** The app seals round 0 — commitment and instruction built by app/src/chain. */
async function seal() {
  const round = plan.rounds[0];
  const now = await chainTime();
  if (!openForSealing({ rounds: plan.rounds }, now)) throw new Error("the sealing window is closed");
  const salt = saltFor(secret, round.roundId);
  const commitment = commitmentHash({
    round: roundPda(round.roundId),
    termsHash: hexToBytes(round.termsHash),
    sgtMint,
    beneficiary: player.publicKey,
    pBps: P_BPS,
    salt,
  });
  const ix = commitIx({
    wallet: player.publicKey,
    sgtMint,
    sgtTokenAccount: sgtToken,
    roundId: round.roundId,
    commitment,
  });
  await send([ix], [player], `commit (app code), p=${P_BPS}`);
  const entry = decodeEntry(entryPda(roundPda(0), sgtMint), (await connection.getAccountInfo(entryPda(roundPda(0), sgtMint))).data);
  if (bytesToHex(entry.commitment) !== bytesToHex(commitment)) throw new Error("the chain stored a different commitment");
  console.log("  the commitment on chain is the one the app computed");
}

/** The two readings — this is the resolver's job, done here so the run is self-contained. */
async function readings() {
  for (const [name, at] of [["set_reference", plan.rounds[0].referenceTime], ["resolve", plan.rounds[0].outcomeTime]]) {
    await waitForChainTime(at, name);
    await send(
      [
        new TransactionInstruction({
          programId: new PublicKey(idl.address),
          keys: [
            { pubkey: player.publicKey, isSigner: true, isWritable: true },
            { pubkey: config, isSigner: false, isWritable: false },
            { pubkey: roundPda(0), isSigner: false, isWritable: true },
            { pubkey: feedAccount, isSigner: false, isWritable: false },
          ],
          data: Buffer.from(disc(name)),
        }),
      ],
      [player],
      name,
    );
  }
}

/** The evening: ONE transaction that reveals round 0 and seals round 1 — built by the app. */
async function evening() {
  await waitForChainTime(plan.rounds[0].outcomeTime + 3, "the evening");
  const now = await chainTime();
  const roundState = decodeRound(roundPda(0), (await connection.getAccountInfo(roundPda(0))).data);
  const open = openForReveal({ rounds: plan.rounds }, now).map((r) => r.roundId);
  console.log(`  open to reveal: [${open.join(", ")}], sealing open: ${openForSealing({ rounds: plan.rounds }, now)?.roundId}`);

  const salt0 = saltFor(secret, 0);
  const salt1 = saltFor(secret, 1);
  const commitment1 = commitmentHash({
    round: roundPda(1),
    termsHash: hexToBytes(plan.rounds[1].termsHash),
    sgtMint,
    beneficiary: player.publicKey,
    pBps: 3_000,
    salt: salt1,
  });
  const built = buildDaily({
    wallet: player.publicKey,
    sgtMint,
    sgtTokenAccount: sgtToken,
    reveals: [{ roundId: 0, pBps: P_BPS, salt: salt0 }],
    seal: { roundId: 1, commitment: commitment1 },
    memos: [new TextEncoder().encode("the sentence, in the clear, at reveal time")],
  });
  console.log(`  daily transaction: ${built.size} bytes, ${built.computeUnits} CU, ${built.instructions.length} instructions`);
  await send(built.instructions, [player], "evening (reveal 0 + seal 1 + memo)");

  const entry0 = decodeEntry(entryPda(roundPda(0), sgtMint), (await connection.getAccountInfo(entryPda(roundPda(0), sgtMint))).data);
  if (!entry0.revealed) throw new Error("round 0 is not revealed");
  if (entry0.pBps !== P_BPS) throw new Error(`revealed ${entry0.pBps}, sealed ${P_BPS}`);
  const entry1 = await connection.getAccountInfo(entryPda(roundPda(1), sgtMint));
  if (!entry1) throw new Error("round 1 was not sealed");
  const verdict = outcomeFor(entry0, roundState);
  console.log(`  revealed ${entry0.pBps / 100}%, round 0 outcome ${roundState.outcome}, verdict "${verdict.kind}" (${verdict.movedBps} bps)`);
}

async function score() {
  await send(
    [
      new TransactionInstruction({
        programId: new PublicKey(idl.address),
        keys: [
          { pubkey: config, isSigner: false, isWritable: false },
          { pubkey: roundPda(0), isSigner: false, isWritable: false },
          { pubkey: entryPda(roundPda(0), sgtMint), isSigner: false, isWritable: true },
          { pubkey: playerPda(sgtMint), isSigner: false, isWritable: true },
        ],
        data: Buffer.from(disc("score_entry")),
      }),
    ],
    [player],
    "score_entry",
  );
}

async function show() {
  const round = decodeRound(roundPda(0), (await connection.getAccountInfo(roundPda(0))).data);
  const entry = decodeEntry(entryPda(roundPda(0), sgtMint), (await connection.getAccountInfo(entryPda(roundPda(0), sgtMint))).data);
  const p = decodePlayer((await connection.getAccountInfo(playerPda(sgtMint))).data);
  console.log(JSON.stringify({
    round: { id: round.roundId, status: round.status, outcome: round.outcome, marginBps: round.outcomeMarginBps, bandBps: round.bandBps, revealClose: round.revealClose, reference: round.reference.price, evidence: round.evidence.price },
    entry: { revealed: entry.revealed, pBps: entry.pBps, scored: entry.scored, scoreBps: entry.scoreBps },
    player: p,
    verdict: outcomeFor(entry, round),
  }, null, 2));
}

const steps = { setup, seal, readings, evening, score, show };
if (!steps[step]) throw new Error(`usage: drive-app.mjs <${Object.keys(steps).join("|")}> <dir>`);
console.log(`--- ${step}`);
await steps[step]();
