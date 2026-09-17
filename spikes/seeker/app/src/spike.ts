// SPIKE 3 ONLY — devnet. Mirrors docs/01-PROGRAM.md §4 client order:
// 1) salt + commitment, persist record (pending) BEFORE any wallet prompt,
// 2) wallet request (MWA signAndSendTransactions),
// 3) confirmed → committed; timeout/unknown → never re-seal, read Entry PDA instead.
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { transact, Web3MobileWallet } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { Buffer } from "buffer";

export const PROGRAM_ID = new PublicKey("2yoZYJMfBkBhtB6cdRJQQKrX3Me5zFZyT7y4P9kDkRxQ");
export const RPC_URL = "https://api.devnet.solana.com";
export const CHAIN = "solana:devnet";
const APP_IDENTITY = { name: "Observed Spike 3", uri: "https://github.com/observedsol-blip/Observed" };

const DISC_COMMIT = Uint8Array.from([223, 140, 142, 165, 229, 208, 156, 74]);
const DISC_REVEAL = Uint8Array.from([9, 35, 59, 190, 167, 249, 76, 115]);
const DISC_ENTRY = Uint8Array.from([63, 18, 152, 113, 215, 246, 221, 250]);
const DOMAIN = Buffer.from("observed/commit/v1", "utf8");

export type Status = "pending" | "committed" | "unknown" | "failed" | "revealed";
export type SealRecord = {
  round: number;
  p_bps: number;
  salt: string; // hex
  commitment: string; // hex
  status: Status;
  persistedAt: number;
  walletRequestAt?: number;
  signature?: string;
  note?: string;
};

export const connection = new Connection(RPC_URL, "confirmed");

// ---------- log (not secret; kept so the tester can copy it) ----------
const LOG_KEY = "spike3_log";
let logLines: string[] = [];
export async function loadLog() {
  logLines = JSON.parse((await SecureStore.getItemAsync(LOG_KEY)) ?? "[]");
  return logLines;
}
export async function log(line: string) {
  const stamped = `${new Date().toISOString().slice(11, 23)} ${line}`;
  logLines = [...logLines, stamped].slice(-80);
  await SecureStore.setItemAsync(LOG_KEY, JSON.stringify(logLines));
  return logLines;
}
export async function clearLog() {
  logLines = [];
  await SecureStore.setItemAsync(LOG_KEY, "[]");
}

// ---------- records: one SecureStore entry per round (Android Keystore-backed AES-GCM) ----------
const recKey = (round: number) => `spike3_round_${round}`;
const INDEX_KEY = "spike3_rounds";

export async function listRounds(): Promise<number[]> {
  return JSON.parse((await SecureStore.getItemAsync(INDEX_KEY)) ?? "[]");
}
export async function getRecord(round: number): Promise<SealRecord | null> {
  const raw = await SecureStore.getItemAsync(recKey(round));
  return raw ? (JSON.parse(raw) as SealRecord) : null;
}
export async function putRecord(r: SealRecord) {
  // awaited on purpose: the wallet prompt must not start before this resolves
  await SecureStore.setItemAsync(recKey(r.round), JSON.stringify(r));
  const rounds = await listRounds();
  if (!rounds.includes(r.round)) await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify([...rounds, r.round]));
}
export async function wipeAll() {
  for (const r of await listRounds()) await SecureStore.deleteItemAsync(recKey(r));
  await SecureStore.deleteItemAsync(INDEX_KEY);
  await SecureStore.deleteItemAsync("spike3_auth");
}

// ---------- commitment (Spec §4 layout with spike placeholders, see program lib.rs) ----------
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const u32le = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const u16le = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };

export function roundPubkey(round: number) {
  return PublicKey.findProgramAddressSync([Buffer.from("round"), u32le(round)], PROGRAM_ID)[0];
}
export function entryPda(round: number, player: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("entry"), u32le(round), player.toBuffer()], PROGRAM_ID)[0];
}
export async function commitmentFor(round: number, beneficiary: PublicKey, p_bps: number, salt: Uint8Array) {
  const data = Buffer.concat([
    DOMAIN,
    PROGRAM_ID.toBuffer(),
    roundPubkey(round).toBuffer(),
    Buffer.alloc(32), // terms_hash placeholder
    beneficiary.toBuffer(), // sgt_mint placeholder
    beneficiary.toBuffer(),
    u16le(p_bps),
    Buffer.from(salt),
  ]);
  return new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data));
}

/** Rust vector from programs/seal_spike/tests/seal.rs::commitment_test_vector */
export async function selfTest() {
  const got = hex(
    await commitmentFor(42, new PublicKey("GmaDrppBC7P5ARKV8g3djiwP89vz1jLK23V2GBjuAEGB"), 4000, new Uint8Array(32).fill(0xab)),
  );
  return got === "e48a73fcfb6f825b06621bbcc53e1a4bf3c02fc2163ae54f36ae047416233117";
}

// ---------- instructions ----------
function commitIx(player: PublicKey, round: number, commitment: Uint8Array) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: player, isSigner: true, isWritable: true },
      { pubkey: entryPda(round, player), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([DISC_COMMIT, u32le(round), Buffer.from(commitment)]),
  });
}
function revealIx(player: PublicKey, round: number, p_bps: number, salt: Uint8Array) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: player, isSigner: true, isWritable: false },
      { pubkey: entryPda(round, player), isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([DISC_REVEAL, u32le(round), u16le(p_bps), Buffer.from(salt)]),
  });
}

export type EntryState = { exists: false } | { exists: true; commitment: string; revealed: boolean; p_bps: number };
export async function readEntry(round: number, player: PublicKey): Promise<EntryState> {
  const acc = await connection.getAccountInfo(entryPda(round, player), "confirmed");
  if (!acc || !acc.owner.equals(PROGRAM_ID)) return { exists: false };
  const d = Buffer.from(acc.data);
  if (!d.subarray(0, 8).equals(Buffer.from(DISC_ENTRY))) return { exists: false };
  return { exists: true, commitment: d.subarray(44, 76).toString("hex"), revealed: d[84] === 1, p_bps: d.readUInt16LE(85) };
}

// ---------- wallet ----------
async function authorizeIn(wallet: Web3MobileWallet): Promise<PublicKey> {
  const cached = await SecureStore.getItemAsync("spike3_auth");
  const res = await wallet.authorize({ identity: APP_IDENTITY, chain: CHAIN, auth_token: cached ?? undefined });
  await SecureStore.setItemAsync("spike3_auth", res.auth_token);
  return new PublicKey(Buffer.from(res.accounts[0].address, "base64"));
}

export async function connectWallet(): Promise<PublicKey> {
  return transact(async (wallet) => authorizeIn(wallet));
}

/**
 * The daily gesture: reveal(round-1) if we hold a committed record for it, plus commit(round),
 * in ONE transaction. Record is persisted before transact() is called.
 */
export async function sealToday(player: PublicKey, round: number, p_bps: number, mode: "send" | "sign-only") {
  const existing = await getRecord(round);
  if (existing && existing.status !== "failed") {
    await log(`round ${round}: record exists (${existing.status}) — no re-seal`);
    return;
  }
  const salt = existing?.status === "failed" ? Buffer.from(existing.salt, "hex") : Crypto.getRandomBytes(32);
  const commitment = existing?.status === "failed"
    ? Buffer.from(existing.commitment, "hex")
    : await commitmentFor(round, player, p_bps, salt);
  const record: SealRecord = existing?.status === "failed"
    ? { ...existing, status: "pending", note: "retry of same commitment" }
    : { round, p_bps, salt: hex(salt), commitment: hex(commitment), status: "pending", persistedAt: Date.now() };
  await putRecord(record);
  const check = await getRecord(round);
  await log(`round ${round}: PERSISTED pending (read-back ${check?.commitment === record.commitment ? "ok" : "MISMATCH"}) p=${record.p_bps}`);

  const prev = await getRecord(round - 1);
  const ixs: TransactionInstruction[] = [];
  if (prev && prev.status === "committed") {
    ixs.push(revealIx(player, prev.round, prev.p_bps, Buffer.from(prev.salt, "hex")));
  }
  ixs.push(commitIx(player, round, commitment));
  await log(`round ${round}: tx = ${ixs.length === 2 ? `reveal(${round - 1}) + commit(${round})` : `commit(${round})`}`);

  try {
    const signature = await transact(async (wallet) => {
      const who = await authorizeIn(wallet);
      if (!who.equals(player)) throw new Error("wallet account changed");
      const { blockhash } = await connection.getLatestBlockhash("confirmed"); // fresh, inside the session
      const tx = new Transaction({ feePayer: player, recentBlockhash: blockhash }).add(...ixs);
      const t = Date.now();
      await putRecord({ ...record, walletRequestAt: t });
      await log(`round ${round}: WALLET REQUEST (${t - record.persistedAt} ms after persist) mode=${mode}`);
      if (mode === "sign-only") {
        await wallet.signTransactions({ transactions: [tx] });
        return "sign-only";
      }
      const [sig] = await wallet.signAndSendTransactions({ transactions: [tx] });
      return sig;
    });
    if (signature === "sign-only") {
      await putRecord({ ...record, status: "failed", note: "sign-only test, not sent" });
      await log(`round ${round}: SIGNED ONLY (not sent) — record marked failed so it can be retried`);
      return;
    }
    await log(`round ${round}: wallet returned signature ${signature.slice(0, 12)}…`);
    const latest = (await getRecord(round)) ?? record;
    await putRecord({ ...latest, status: "unknown", signature });
    await reconcile(player);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await putRecord({ ...record, status: "unknown", note: msg.slice(0, 120) });
    await log(`round ${round}: wallet/send error → unknown: ${msg.slice(0, 120)}`);
    await reconcile(player);
  }
}

/** Never re-seal on unknown: read the Entry PDA and decide. Runs on app start too. */
export async function reconcile(player: PublicKey) {
  for (const round of await listRounds()) {
    const r = await getRecord(round);
    if (!r) continue;
    if (r.status === "pending" || r.status === "unknown") {
      const e = await readEntry(round, player);
      const next: Status = e.exists && e.commitment === r.commitment ? "committed" : e.exists ? "failed" : "failed";
      const why = e.exists ? (e.commitment === r.commitment ? "Entry matches commitment" : "Entry exists with OTHER commitment") : "no Entry on chain";
      await putRecord({ ...r, status: next, note: why });
      await log(`reconcile round ${round}: ${r.status} → ${next} (${why})`);
    }
    if (r.status === "committed") {
      const e = await readEntry(round, player);
      if (e.exists && e.revealed) {
        await putRecord({ ...r, status: "revealed" });
        await log(`reconcile round ${round}: committed → revealed (on chain p=${e.p_bps})`);
      }
    }
  }
}

export async function markUnknown(round: number) {
  const r = await getRecord(round);
  if (!r) return;
  await putRecord({ ...r, status: "unknown", note: "manually set for test" });
  await log(`round ${round}: manually set to unknown`);
}
