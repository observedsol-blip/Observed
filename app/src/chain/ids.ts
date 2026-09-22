// Everything the app has to agree with the program about. One place, so a change is one edit.
// Values come from programs/observed/src/lib.rs and target/idl/observed.json; the tests in
// app/test check them against fixtures the program itself wrote.
import { PublicKey } from "@solana/web3.js";

/** Devnet/test build. The mainnet id is written here at deploy time (docs/runbook-mainnet.md). */
export const PROGRAM_ID = new PublicKey("48YybyMgkdzPQN5R3V1xsFHkUMxDvBDBDwW48cRTx2ni");
export const TOKEN_2022_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
export const MEMO_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const SYSTEM_ID = new PublicKey("11111111111111111111111111111111");

export const GAME_ID = 1n;

/** Anchor discriminators (target/idl/observed.json). A wrong byte here fails at the program. */
export const IX = {
  commit: Uint8Array.from([223, 140, 142, 165, 229, 208, 156, 74]),
  reveal: Uint8Array.from([9, 35, 59, 190, 167, 249, 76, 115]),
  scoreEntry: Uint8Array.from([231, 190, 137, 114, 174, 90, 253, 147]),
} as const;

export const ACCOUNT_DISC = {
  config: Uint8Array.from([155, 12, 170, 224, 30, 250, 204, 130]),
  entry: Uint8Array.from([63, 18, 152, 113, 215, 246, 221, 250]),
  player: Uint8Array.from([205, 222, 112, 7, 165, 155, 206, 218]),
  round: Uint8Array.from([87, 127, 165, 51, 73, 78, 116, 174]),
} as const;

/** Hash domains. Both are frozen: change one and no open answer can ever be revealed. */
export const COMMIT_DOMAIN = "observed/commit/v1";
export const SALT_DOMAIN = "observed/salt/v1";
export const TERMS_DOMAIN = "observed/terms/v3";
/** The message signed to recover the season secret (E2). Domain-specific on purpose. */
export const SECRET_MESSAGE_PREFIX = "observed-v1-secret:";

/**
 * How long a sealed answer can be revealed after the outcome — the program's REVEAL_WINDOW_SECS
 * (programs/observed/src/lib.rs). It stood three times as `72 * 3600` in the session before the
 * audit of 21.09.2026; three places to change is two too many for a number that decides whether
 * an answer still counts.
 */
export const REVEAL_WINDOW_SECS = 72 * 3_600;

/** The loader that owns upgradeable programs; its ProgramData account names the authority. */
export const BPF_LOADER_UPGRADEABLE_ID = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

export const LEAF_TAG = 0x00;
export const NODE_TAG = 0x01;
export const CALENDAR_DEPTH = 6;

/** 21 positions, 0…10 000 in steps of 500 — the program refuses anything else. */
export const BUCKET_STEP = 500;
export const MAX_P_BPS = 10_000;

export const RoundStatus = { Open: 0, Closed: 1, Referenced: 2, Resolved: 3, Cancelled: 4 } as const;
export const Outcome = { Unset: 0, Yes: 1, No: 2 } as const;

/** Transaction limits the daily transaction has to respect (measured in tests/capacity.rs). */
export const TX_SIZE_LIMIT = 1232;
/**
 * Measured on a validator: commit 26 650 CU, reveal 16 182 CU (`spikes/e2e/matrix.mjs`, 22.09.2026).
 *
 * The budget sits far above those numbers on purpose, and the reason is a finding rather than
 * caution. `commit` lets the program derive the Entry PDA with `find_program_address`, which
 * tries bumps from 255 downwards and pays roughly 1 530 CU for each candidate it rejects. Almost
 * every call lands on 255 and costs nothing extra — but in the matrix run one call out of twelve
 * had bump **246**: nine extra steps, about 13 800 CU, and the daily transaction failed **after
 * the wallet approval**, because 30 000 × 1.2 leaves only 35 850 usable units.
 *
 * That is the same shape of bug as the raw memo bytes: fine for most people on most days, and
 * ruinous for whoever draws the unlucky address. Over a season of 64 calls on twenty devices the
 * deepest search to expect is around ten steps, so this carries room for twenty. Asking for more
 * units than needed costs nothing here: the app sets no priority price, and the fee is per
 * signature, not per requested unit.
 *
 * The cheaper fix belongs in the program — take the bump the client already knows and use
 * `create_program_address`. That is a program change, and therefore not this week's.
 */
export const CU_COMMIT = 60_000;
export const CU_REVEAL = 22_000;
/** The memo program is NOT cheap: a 42-byte memo cost 14 918 CU on the validator — it validates
 *  UTF-8 and logs the whole thing. Budgeting a thousand per memo (as this did at first) makes
 *  the evening transaction fail after the approval, which is the worst possible moment.
 *  Linear fit through the measurement, with the 20 % head room added by buildDaily on top. */
export const CU_MEMO_BASE = 10_000;
export const CU_MEMO_PER_BYTE = 160;
export const cuForMemo = (bytes: number) => CU_MEMO_BASE + CU_MEMO_PER_BYTE * bytes;
