// The two hashes the app must get exactly right.
//
// If the commitment differs from the program's by one byte, the seal can never be revealed and
// the answer counts as a full miss. If the salt rule changes, every open answer in the world
// becomes unrevealable. Both are pinned by vectors the program wrote
// (tests/fixtures/generated/app-vectors.json, checked in app/test/vectors.test.ts).
import { sha256 } from "@noble/hashes/sha256";
import { PublicKey } from "@solana/web3.js";
import { BUCKET_STEP, COMMIT_DOMAIN, MAX_P_BPS, PROGRAM_ID, SALT_DOMAIN } from "./ids.ts";

const utf8 = (s: string) => new TextEncoder().encode(s);

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const u16le = (n: number) => {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
};
const u32le = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
};

/**
 * salt(round) = sha256("observed/salt/v1" || secret || round_id_le)
 *
 * The program never sees this — it only ever sees the finished salt at reveal time. That is
 * exactly why it is frozen here and pinned in Rust (programs/observed/tests/vectors.rs):
 * the same phone must derive the same salt months later, and a reinstalled app must derive it
 * again from the recovered secret.
 */
export function saltFor(secret: Uint8Array, roundId: number): Uint8Array {
  if (secret.length !== 32) throw new Error(`secret must be 32 bytes, got ${secret.length}`);
  return sha256(concat([utf8(SALT_DOMAIN), secret, u32le(roundId)]));
}

/**
 * commitment = sha256("observed/commit/v1" || program_id || round || terms_hash || sgt_mint ||
 *                     beneficiary || p_bps_le || salt)
 */
export function commitmentHash(args: {
  round: PublicKey;
  termsHash: Uint8Array;
  sgtMint: PublicKey;
  beneficiary: PublicKey;
  pBps: number;
  salt: Uint8Array;
}): Uint8Array {
  if (args.termsHash.length !== 32) throw new Error("terms hash must be 32 bytes");
  if (args.salt.length !== 32) throw new Error("salt must be 32 bytes");
  assertProbability(args.pBps);
  return sha256(
    concat([
      utf8(COMMIT_DOMAIN),
      PROGRAM_ID.toBytes(),
      args.round.toBytes(),
      args.termsHash,
      args.sgtMint.toBytes(),
      args.beneficiary.toBytes(),
      u16le(args.pBps),
      args.salt,
    ]),
  );
}

/** The program refuses anything else, and it refuses it after the wallet approval. */
export function assertProbability(pBps: number): void {
  if (!Number.isInteger(pBps) || pBps < 0 || pBps > MAX_P_BPS || pBps % BUCKET_STEP !== 0) {
    throw new Error(`p_bps must be 0..=10000 in steps of ${BUCKET_STEP}, got ${pBps}`);
  }
}

/** Brier in basis points, exactly as `brier_score_bps` in the program: 25·(k − 20y)², k = p/500. */
export function brierBps(pBps: number, yes: boolean): number {
  assertProbability(pBps);
  const k = pBps / BUCKET_STEP;
  const d = k - (yes ? 20 : 0);
  return 25 * d * d;
}
