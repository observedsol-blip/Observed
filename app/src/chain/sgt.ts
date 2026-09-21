// Finding the Genesis Token of this device, with the same checks the program makes.
//
// The app checks before it asks for an approval: a seal that the program will reject costs the
// player an approval and tells them nothing. The constants are the ones in the program
// (programs/observed/src/lib.rs) — the group and the mint authority, never a list of mints:
// every Seeker has its own mint, and a list would be wrong the day a new device ships.
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_ID } from "./ids.ts";
import { decodeTokenAccount } from "./layout.ts";

export const SGT_GROUP = new PublicKey("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te");
export const SGT_MINT_AUTHORITY = new PublicKey("GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4");

/** Token-2022 puts extensions after the 165-byte base account, behind an account-type byte. */
const TLV_START = 166;
const EXT_TOKEN_GROUP_MEMBER = 23;
/** Base mint layout: mint_authority option(4) + authority(32), supply(8), decimals(1), … */
const MINT_AUTHORITY_TAG = 0;
const MINT_AUTHORITY = 4;
const MINT_SUPPLY = 36;
const MINT_DECIMALS = 44;

export type MintFacts = {
  mintAuthority: PublicKey | null;
  supply: number;
  decimals: number;
  group: PublicKey | null;
  memberMint: PublicKey | null;
};

const EMPTY: MintFacts = {
  mintAuthority: null,
  supply: 0,
  decimals: 0,
  group: null,
  memberMint: null,
};

/**
 * What the program checks, read out of a Token-2022 mint — with every offset bounds-checked.
 *
 * The bytes come from an RPC we do not control. A truncated or hostile account has to end in
 * "this is not a Genesis Token", never in an exception that takes the wallet connection down
 * with it (audit 21.09.2026, finding 9).
 */
export function readMint(data: Uint8Array): MintFacts {
  if (data.length < MINT_DECIMALS + 1) return { ...EMPTY };
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const hasAuthority = view.getUint32(MINT_AUTHORITY_TAG, true) === 1;
  const facts: MintFacts = {
    mintAuthority:
      hasAuthority && data.length >= MINT_AUTHORITY + 32
        ? new PublicKey(data.subarray(MINT_AUTHORITY, MINT_AUTHORITY + 32))
        : null,
    supply: Number(view.getBigUint64(MINT_SUPPLY, true)),
    decimals: data[MINT_DECIMALS],
    group: null,
    memberMint: null,
  };
  let at = TLV_START;
  while (at + 4 <= data.length) {
    const type = view.getUint16(at, true);
    const length = view.getUint16(at + 2, true);
    if (type === 0 && length === 0) break;
    // A length that reaches past the end is a broken account, not a shorter extension.
    if (at + 4 + length > data.length) break;
    if (type === EXT_TOKEN_GROUP_MEMBER && length >= 64) {
      facts.memberMint = new PublicKey(data.subarray(at + 4, at + 36));
      facts.group = new PublicKey(data.subarray(at + 36, at + 68));
    }
    at += 4 + length;
  }
  return facts;
}

export type SgtCheck =
  | { ok: true; mint: PublicKey; tokenAccount: PublicKey }
  | { ok: false; reason: "no-token-account" | "not-a-genesis-token" };

/** Mirrors `verify_sgt`: mint authority, supply 1, decimals 0, group membership, amount 1. */
export function checkGenesisToken(args: {
  mint: PublicKey;
  mintData: Uint8Array;
  tokenAccount: PublicKey;
  tokenAccountData: Uint8Array;
  owner: PublicKey;
}): SgtCheck {
  let token: ReturnType<typeof decodeTokenAccount>;
  try {
    token = decodeTokenAccount(args.tokenAccountData);
  } catch {
    return { ok: false, reason: "not-a-genesis-token" };
  }
  const mint = readMint(args.mintData);
  const ok =
    token.owner.equals(args.owner) &&
    token.mint.equals(args.mint) &&
    token.amount === 1 &&
    mint.supply === 1 &&
    mint.decimals === 0 &&
    mint.mintAuthority !== null &&
    mint.mintAuthority.equals(SGT_MINT_AUTHORITY) &&
    mint.group !== null &&
    mint.group.equals(SGT_GROUP) &&
    mint.memberMint !== null &&
    mint.memberMint.equals(args.mint);
  return ok
    ? { ok: true, mint: args.mint, tokenAccount: args.tokenAccount }
    : { ok: false, reason: "not-a-genesis-token" };
}

/** What the app needs from the RPC to run the check — one call, then one account read. */
export type TokenReader = {
  tokenAccountsOf: (owner: PublicKey) => Promise<{ pubkey: PublicKey; data: Uint8Array }[]>;
  accountData: (pubkey: PublicKey) => Promise<Uint8Array | null>;
};

export async function findGenesisToken(reader: TokenReader, owner: PublicKey): Promise<SgtCheck> {
  const accounts = await reader.tokenAccountsOf(owner);
  if (accounts.length === 0) return { ok: false, reason: "no-token-account" };
  for (const a of accounts) {
    // One unreadable account among many must not end the search: it is one token that is not
    // the Genesis Token, not a broken wallet (audit 21.09.2026, finding 9).
    let token: ReturnType<typeof decodeTokenAccount>;
    try {
      token = decodeTokenAccount(a.data);
    } catch {
      continue;
    }
    if (token.amount !== 1) continue;
    const mintData = await reader.accountData(token.mint);
    if (!mintData) continue;
    const check = checkGenesisToken({
      mint: token.mint,
      mintData,
      tokenAccount: a.pubkey,
      tokenAccountData: a.data,
      owner,
    });
    if (check.ok) return check;
  }
  return { ok: false, reason: "not-a-genesis-token" };
}

export { TOKEN_2022_ID };
