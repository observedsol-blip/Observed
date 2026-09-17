// Spike 2: fetch a real Seeker Genesis Token (someone else's, picked from recent group activity)
// from mainnet, read-only, and write test fixtures.
// - group + mint: byte-exact snapshots
// - token account: byte-exact EXCEPT the owner (bytes 32..64), replaced by a deterministic test key,
//   so no third-party wallet address lands in the repo.
// Usage: REPO_ROOT=~/observed NODE_PATH=~/observed/spikes/pyth/client/node_modules \
//          npx --prefix spikes/pyth/client tsx spikes/sgt/scripts/fetch-fixtures.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

const RPC = process.env.RPC_URL ?? "https://api.mainnet-beta.solana.com";
const TOKEN_2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const SGT_GROUP = new PublicKey("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te");
const SGT_MINT_AUTHORITY = new PublicKey("GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4");
const OUT = `${process.env.REPO_ROOT ?? "."}/tests/fixtures/sgt/`;

// Deterministic test owner; the Rust tests derive the same key from the same seed.
export const TEST_OWNER_SEED = createHash("sha256").update("observed/test/sgt-owner").digest();
const testOwner = Keypair.fromSeed(TEST_OWNER_SEED).publicKey;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const c = new Connection(RPC, "confirmed");
  const sigs = await c.getSignaturesForAddress(SGT_GROUP, { limit: 15 });
  await sleep(2000);
  let mint: PublicKey | null = null;
  let tokenAccount: PublicKey | null = null;
  let memberNumber: number | null = null;
  for (const s of sigs) {
    if (s.err) continue;
    const tx = await c.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
    await sleep(2500);
    const keys = tx?.transaction.message.accountKeys.map((k) => k.pubkey) ?? [];
    // a freshly minted SGT shows up as a Token-2022 post balance of exactly 1 with 0 decimals
    const bal = (tx?.meta?.postTokenBalances ?? []).find(
      (b) => b.programId === TOKEN_2022.toBase58() && b.uiTokenAmount.amount === "1" && b.uiTokenAmount.decimals === 0,
    );
    if (!bal) continue;
    const candidate = new PublicKey(bal.mint);
    if (candidate.equals(SGT_GROUP) || candidate.equals(SGT_MINT_AUTHORITY)) continue;
    const info = await c.getParsedAccountInfo(candidate);
    await sleep(2500);
    const parsed = (info.value?.data as { parsed?: { type?: string; info?: Record<string, unknown> } })?.parsed;
    const exts = (parsed?.info?.extensions as Array<{ extension: string; state: Record<string, unknown> }>) ?? [];
    const member = exts.find((e) => e.extension === "tokenGroupMember");
    if (parsed?.type === "mint" && member?.state.group === SGT_GROUP.toBase58() && parsed.info?.supply === "1") {
      mint = candidate;
      tokenAccount = keys[bal.accountIndex];
      memberNumber = Number(member.state.memberNumber);
      break;
    }
  }
  if (!mint || !tokenAccount) throw new Error("no SGT mint found in recent group activity");
  const holder = { address: tokenAccount };

  mkdirSync(OUT, { recursive: true });
  const testTokenAccount = Keypair.fromSeed(
    createHash("sha256").update("observed/test/sgt-token-account").digest(),
  ).publicKey;
  const snap = async (name: string, key: PublicKey, note: string, patchOwner = false) => {
    await sleep(2500);
    const r = await c.getAccountInfoAndContext(key);
    if (!r.value) throw new Error(`missing ${name}`);
    const data = Buffer.from(r.value.data);
    if (patchOwner) testOwner.toBuffer().copy(data, 32); // SPL token account layout: mint[0..32], owner[32..64]
    writeFileSync(
      `${OUT}${name}.json`,
      JSON.stringify(
        {
          pubkey: (patchOwner ? testTokenAccount : key).toBase58(),
          note,
          source: `mainnet getAccountInfo, slot ${r.context.slot}, ${new Date().toISOString()}`,
          owner: r.value.owner.toBase58(),
          lamports: r.value.lamports,
          executable: r.value.executable,
          data_base64: data.toString("base64"),
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`${name}: ${data.length} bytes, slot ${r.context.slot}`);
  };

  await snap("sgt-group", SGT_GROUP, "Seeker Genesis Token group (Token-2022 mint with TokenGroup), byte-exact");
  await snap("sgt-mint", mint, `real SGT mint (group member #${memberNumber}), byte-exact`);
  await snap(
    "sgt-token-account",
    holder.address,
    "real SGT token account, byte-exact EXCEPT owner (bytes 32..64) replaced by the test key sha256('observed/test/sgt-owner') so no third-party wallet is stored; state as on mainnet; account address replaced by the test key sha256(\"observed/test/sgt-token-account\") (the real address would link to the holder)",
    true,
  );
  console.log(`test owner: ${testOwner.toBase58()}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
