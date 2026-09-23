#!/usr/bin/env node
// Resolve a round yourself — the three instructions nobody needs permission for.
//
//   node scripts/resolve-round.mjs create    --round 7 --calendar tests/fixtures/calendar/season1.json \
//                                            --rpc https://api.mainnet-beta.solana.com --keypair ~/my.json
//   node scripts/resolve-round.mjs reference --round 7 --rpc ... --keypair ...
//   node scripts/resolve-round.mjs resolve   --round 7 --rpc ... --keypair ...
//
// `create_round`, `set_reference` and `resolve` are permissionless: the program checks the
// Merkle proof, the clock and the price account, never who is asking. That is the whole point,
// and it is worth nothing if nobody knows how. These are the commands.
//
// It creates no key and it reads no key you do not name: `--keypair` is required and has no
// default, so nothing of yours is touched by accident. The fee payer is that key, and the only
// thing it ever spends is the network fee (plus the rent for the Round account on `create`,
// which is not refundable — the program has no instruction that closes a Round).
//
// What each command needs:
//   create     the published calendar file, for the terms and the Merkle proof
//   reference  nothing but the round id — the price account is read off the Round
//   resolve    the same
//
// Timing, from the calendar: `reference` is accepted in [reference_time, +window_secs] and
// `resolve` in [outcome_time, +window_secs]. Outside those the program refuses, and it is
// right to.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

// web3.js lives in the app's node_modules, the same way the verifier finds it: this directory
// has no package.json of its own, and the script should run from a plain checkout.
const require = createRequire(join(import.meta.dirname, "..", "app", "package.json"));
const web3 = require("@solana/web3.js");

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } = web3;

const PROGRAM_ID = new PublicKey("48YybyMgkdzPQN5R3V1xsFHkUMxDvBDBDwW48cRTx2ni");
const GAME_ID = 1n;

const argv = process.argv.slice(2);
const command = argv[0];
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};
const need = (k) => {
  const v = arg(k, null);
  if (v === null) {
    console.error(`missing --${k}`);
    process.exit(2);
  }
  return v;
};

if (!["create", "reference", "resolve"].includes(command)) {
  console.error("usage: resolve-round.mjs <create|reference|resolve> --round N --rpc URL --keypair FILE");
  process.exit(2);
}

const ROUND_ID = Number(need("round"));
const RPC = arg("rpc", "http://127.0.0.1:8899");
const KEYPAIR = need("keypair").replace(/^~(?=\/|$)/, homedir());

/** Anchor's instruction discriminator: the first eight bytes of sha256("global:<name>"). */
const disc = (name) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);

const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };

const configPda = () =>
  PublicKey.findProgramAddressSync([Buffer.from("config"), u64(GAME_ID)], PROGRAM_ID)[0];
const roundPda = (id) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("round"), configPda().toBuffer(), u32(id)],
    PROGRAM_ID,
  )[0];

const meta = (pubkey, isSigner, isWritable) => ({ pubkey, isSigner, isWritable });

const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(KEYPAIR, "utf8"))));
const connection = new Connection(RPC, "confirmed");

/** The Round account's own layout, only the two fields these commands need. */
const ROUND_PRICE_ACCOUNT = 79;
const ROUND_STATUS = 183;

async function roundAccount(id) {
  const info = await connection.getAccountInfo(roundPda(id));
  if (!info) throw new Error(`round ${id} does not exist on chain yet — run \`create\` first`);
  return {
    priceAccount: new PublicKey(info.data.subarray(ROUND_PRICE_ACCOUNT, ROUND_PRICE_ACCOUNT + 32)),
    status: info.data[ROUND_STATUS],
  };
}

async function send(instruction, label) {
  const tx = new Transaction().add(instruction);
  const signature = await web3.sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });
  const got = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  console.log(`${label}: ok`);
  console.log(`  signature ${signature}`);
  console.log(`  compute units ${got?.meta?.computeUnitsConsumed ?? "?"}`);
  return signature;
}

if (command === "create") {
  const calendar = JSON.parse(readFileSync(need("calendar"), "utf8"));
  const leaf = calendar.rounds.find((r) => r.roundId === ROUND_ID);
  if (!leaf) throw new Error(`the calendar has no round ${ROUND_ID}`);

  // Byte for byte what `RoundTerms` deserialises (programs/observed/src/lib.rs).
  const terms = Buffer.concat([
    Buffer.from([leaf.version, leaf.kind, leaf.sourceKind]),
    Buffer.from(leaf.feedId, "hex"),
    new PublicKey(leaf.priceAccount).toBuffer(),
    i32(leaf.offsetBps),
    u16(leaf.maxConfBps),
    u16(leaf.bandBps),
    u16(leaf.windowSecs),
    u16(leaf.maxAgeSecs),
    u32(leaf.closeAfterSecs),
    i64(leaf.earliestCloseUnix),
    i64(leaf.commitOpen),
    i64(leaf.commitClose),
    i64(leaf.referenceTime),
    i64(leaf.outcomeTime),
  ]);
  const proof = Buffer.concat([
    u32(leaf.proof.length),
    ...leaf.proof.map((p) => Buffer.from(p, "hex")),
  ]);

  console.log(`create_round ${ROUND_ID} — "${leaf.question}"`);
  await send(
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        meta(payer.publicKey, true, true),
        meta(configPda(), false, true),
        meta(roundPda(ROUND_ID), false, true),
        meta(SystemProgram.programId, false, false),
      ],
      data: Buffer.concat([disc("create_round"), u32(ROUND_ID), terms, proof]),
    }),
    `create_round ${ROUND_ID}`,
  );
} else {
  const round = await roundAccount(ROUND_ID);
  const name = command === "reference" ? "set_reference" : "resolve";
  console.log(`${name} ${ROUND_ID} — price account ${round.priceAccount.toBase58()}`);
  await send(
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        meta(payer.publicKey, true, false),
        meta(configPda(), false, false),
        meta(roundPda(ROUND_ID), false, true),
        meta(round.priceAccount, false, false),
      ],
      data: disc(name),
    }),
    `${name} ${ROUND_ID}`,
  );
}
