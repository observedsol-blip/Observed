#!/usr/bin/env node
// Drives one end-to-end round against a local validator: the owner's steps (initialize,
// publish_calendar, create_round) and the player's steps (commit, reveal), plus a state dump.
// The resolver's steps (set_reference, resolve, score_entry) are NOT here — those are done by
// the real Worker, so the run proves program and resolver together.
//
//   node drive.mjs <step> <dir>        step = setup | commit | reveal | show
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const web3 = require("/home/observed/observed-resolver/node_modules/@solana/web3.js");
const { Connection, Keypair, PublicKey, SystemProgram, Transaction } = web3;

const [step, dir] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(join(dir, "plan.json"), "utf8"));
const idl = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "target/idl/observed.json"), "utf8"));
const connection = new Connection("http://127.0.0.1:8899", "confirmed");
const key = (file) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(file, "utf8"))));
const player = key(join(dir, "..", "player.json")); // keypairs live next to the account files
// The deploy authority is a well-known test key (seed [1;32]) — the program refuses anyone else.
const authority = Keypair.fromSeed(Uint8Array.from(Array(32).fill(1)));
const PROGRAM_ID = new PublicKey(idl.address);
const TOKEN_2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

const disc = (name) => Uint8Array.from(idl.instructions.find((i) => i.name === name).discriminator);
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };

const pda = (seeds) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
const config = pda([Buffer.from("config"), u64(plan.gameId)]);
const round = pda([Buffer.from("round"), config.toBuffer(), u32(0)]);
const sgtMint = new PublicKey(plan.sgtMint);
const entry = pda([Buffer.from("entry"), round.toBuffer(), sgtMint.toBuffer()]);
const playerPda = pda([Buffer.from("player"), config.toBuffer(), sgtMint.toBuffer()]);

const meta = (pubkey, isSigner, isWritable) => ({ pubkey, isSigner, isWritable });
const ix = (keys, data) => new web3.TransactionInstruction({ programId: PROGRAM_ID, keys, data: Buffer.from(data) });
const cat = (...parts) => Buffer.concat(parts.map((p) => Buffer.from(p)));

async function send(signers, instructions, label) {
  const tx = new Transaction().add(...instructions);
  const signature = await web3.sendAndConfirmTransaction(connection, tx, signers, { commitment: "confirmed" });
  console.log(`${label}: ${signature}`);
  return signature;
}

const SALT = Buffer.alloc(32, 7);
const P_BPS = 6500;
const commitment = () =>
  createHash("sha256")
    .update(
      cat(
        Buffer.from("observed/commit/v1", "utf8"),
        PROGRAM_ID.toBuffer(),
        round.toBuffer(),
        Buffer.from(plan.termsHash, "hex"),
        sgtMint.toBuffer(),
        player.publicKey.toBuffer(),
        u16(P_BPS),
        SALT,
      ),
    )
    .digest();

const termsBytes = () => {
  const t = plan.terms;
  return cat(
    Buffer.from([t.version, t.kind, t.sourceKind]),
    Buffer.from(t.feedId, "hex"),
    new PublicKey(t.priceAccount).toBuffer(),
    i32(t.offsetBps), u16(t.maxConfBps), u16(t.bandBps), u16(t.windowSecs), u16(t.maxAgeSecs),
    i64(t.commitOpen), i64(t.commitClose), i64(t.referenceTime), i64(t.outcomeTime),
  );
};

if (step === "setup") {
  await send(
    [authority],
    [
      ix(
        [meta(authority.publicKey, true, true), meta(config, false, true), meta(SystemProgram.programId, false, false)],
        cat(disc("initialize"), u64(plan.gameId), authority.publicKey.toBuffer(), authority.publicKey.toBuffer()),
      ),
    ],
    "initialize",
  );
  await send(
    [authority],
    [
      ix(
        [meta(authority.publicKey, true, false), meta(config, false, true)],
        cat(disc("publish_calendar"), u16(plan.season), Buffer.from(plan.merkleRoot, "hex"), u32(64)),
      ),
    ],
    "publish_calendar",
  );
  const proof = cat(u32(plan.proof.length), ...plan.proof.map((p) => Buffer.from(p, "hex")));
  await send(
    [authority],
    [
      ix(
        [
          meta(authority.publicKey, true, true),
          meta(config, false, true),
          meta(round, false, true),
          meta(SystemProgram.programId, false, false),
        ],
        cat(disc("create_round"), u32(0), termsBytes(), proof),
      ),
    ],
    "create_round",
  );
} else if (step === "commit") {
  await send(
    [player],
    [
      ix(
        [
          meta(player.publicKey, true, true),
          meta(sgtMint, false, false),
          meta(new PublicKey(plan.sgtToken), false, false),
          meta(config, false, false),
          meta(round, false, true),
          meta(entry, false, true),
          meta(playerPda, false, true),
          meta(TOKEN_2022, false, false),
          meta(SystemProgram.programId, false, false),
        ],
        cat(disc("commit"), commitment()),
      ),
    ],
    "commit",
  );
} else if (step === "reveal") {
  await send(
    [player],
    [
      ix(
        [
          meta(player.publicKey, true, false),
          meta(config, false, false),
          meta(round, false, true),
          meta(entry, false, true),
          meta(playerPda, false, true),
        ],
        cat(disc("reveal"), u16(P_BPS), SALT),
      ),
    ],
    "reveal",
  );
} else if (step === "show") {
  const data = (await connection.getAccountInfo(round)).data;
  const num = (o) => Number(data.readBigInt64LE(o));
  const out = {
    round: {
      status: data.readUInt8(171),
      outcome: data.readUInt8(172),
      marginBps: data.readInt32LE(357),
      bandBps: data.readUInt16LE(117),
      commitCount: data.readUInt32LE(361),
      revealCount: data.readUInt32LE(365),
      reference: { price: num(173), publishTime: num(193), postedSlot: Number(data.readBigUInt64LE(201)), submittedSlot: Number(data.readBigUInt64LE(209)), submittedAt: num(217), submitter: new PublicKey(data.subarray(225, 257)).toBase58() },
      evidence: { price: num(257), publishTime: num(277), submittedAt: num(301), submitter: new PublicKey(data.subarray(309, 341)).toBase58() },
    },
  };
  const entryInfo = await connection.getAccountInfo(entry);
  if (entryInfo) {
    out.entry = {
      revealed: entryInfo.data.readUInt8(176) === 1,
      pBps: entryInfo.data.readUInt16LE(177),
      scored: entryInfo.data.readUInt8(179) === 1,
      scoredAsMissing: entryInfo.data.readUInt8(180) === 1,
      scoreBps: entryInfo.data.readUInt16LE(181),
    };
  }
  const playerInfo = await connection.getAccountInfo(playerPda);
  if (playerInfo) {
    out.player = {
      commits: playerInfo.data.readUInt32LE(40),
      reveals: playerInfo.data.readUInt32LE(44),
      missingScored: playerInfo.data.readUInt32LE(48),
      scoreSum: Number(playerInfo.data.readBigUInt64LE(52)),
      scoredRounds: playerInfo.data.readUInt32LE(60),
    };
  }
  console.log(JSON.stringify(out, null, 2));
} else {
  throw new Error("step must be setup | commit | reveal | show");
}
