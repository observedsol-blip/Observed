// Spike 1: post a historical Pyth update on devnet, consume it with the spike program,
// measure everything, and probe the rejection cases by simulation.
// Usage: npx tsx post.ts <FEED> <T ISO> <full|partial> <keep|close> <label>
// Reads the API key (~/.config/observed/pyth_api_key) and the devnet wallet
// (~/.config/solana/id.json) at runtime. Never prints either.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";

const FEEDS: Record<string, string> = {
  SOL: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  BTC: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SKR: "38846ec4d0dbe808091817f5c0d6ab8058e25422348ddf97db52b6c378a93bf9",
};
const SPIKE_PROGRAM = new PublicKey("CvygcyyJavsRaVGGMg4trsWFTADVhcwrJsYuSboHzsEw");
const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const HERMES = "https://hermes.pyth.network";

function checkIx(priceUpdate: PublicKey, feedIdHex: string, t: number, maxConfBps: number) {
  const disc = createHash("sha256").update("global:check_first_after").digest().subarray(0, 8);
  const data = Buffer.alloc(8 + 32 + 8 + 2);
  disc.copy(data, 0);
  Buffer.from(feedIdHex, "hex").copy(data, 8);
  data.writeBigInt64LE(BigInt(t), 40);
  data.writeUInt16LE(maxConfBps, 48);
  return new TransactionInstruction({
    programId: SPIKE_PROGRAM,
    keys: [{ pubkey: priceUpdate, isSigner: false, isWritable: false }],
    data,
  });
}

async function main() {
  const [feedName, tIso, mode = "full", closeArg = "keep", label = "run"] = process.argv.slice(2);
  const feedId = FEEDS[feedName];
  if (!feedId || !tIso) throw new Error("usage: post.ts <FEED> <T ISO> <full|partial> <keep|close> <label>");
  const t = Math.floor(Date.parse(tIso) / 1000);

  const apiKey = readFileSync(join(homedir(), ".config/observed/pyth_api_key"), "utf8").trim();
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(join(homedir(), ".config/solana/id.json"), "utf8"))),
  );
  const wallet = {
    publicKey: payer.publicKey,
    payer,
    async signTransaction<T extends VersionedTransaction>(tx: T) {
      tx.sign([payer]);
      return tx;
    },
    async signAllTransactions<T extends VersionedTransaction>(txs: T[]) {
      txs.forEach((tx) => tx.sign([payer]));
      return txs;
    },
  };

  const res = await fetch(`${HERMES}/v2/updates/price/${t}?ids[]=${feedId}&encoding=base64&parsed=true`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Hermes HTTP ${res.status}: ${body.slice(0, 200)}`);
  const upd = JSON.parse(body);
  const parsed = upd.parsed[0];
  const updateData: string[] = upd.binary.data;

  const connection = new Connection(RPC, "confirmed");
  const receiver = new PythSolanaReceiver({ connection, wallet: wallet as never });

  const balanceBefore = await connection.getBalance(payer.publicKey);
  const builder = receiver.newTransactionBuilder({ closeUpdateAccounts: closeArg === "close" });
  if (mode === "partial") await builder.addPostPartiallyVerifiedPriceUpdates(updateData);
  else await builder.addPostPriceUpdates(updateData);
  const priceUpdateAccount = builder.getPriceUpdateAccount("0x" + feedId);
  if (mode === "full") {
    await builder.addPriceConsumerInstructions(async (get) => [
      { instruction: checkIx(get("0x" + feedId), feedId, t, 10_000), signers: [] },
    ]);
  }
  const built = await builder.buildVersionedTransactions({ computeUnitPriceMicroLamports: 1000 });

  const txs: Array<Record<string, unknown>> = [];
  for (const [i, { tx, signers }] of built.entries()) {
    const bytes = tx.serialize().length;
    tx.sign([payer, ...signers]);
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    const latest = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction(
      { signature: sig, blockhash: tx.message.recentBlockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
      "confirmed",
    );
    let info = null;
    for (let k = 0; k < 15 && !info; k++) {
      info = await connection.getTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
      if (!info) await new Promise((r) => setTimeout(r, 1000));
    }
    const logs = info?.meta?.logMessages ?? [];
    txs.push({
      index: i,
      signature: sig,
      bytes,
      signatures: tx.signatures.length,
      instructions: tx.message.compiledInstructions.length,
      feeLamports: info?.meta?.fee ?? null,
      computeUnits: info?.meta?.computeUnitsConsumed ?? null,
      err: info?.meta?.err ?? null,
      spikeLog: logs.filter((l) => l.includes("ok: price=")),
    });
    console.log(`tx ${i}: ${bytes} bytes, ${tx.signatures.length} sig(s), fee ${info?.meta?.fee}, CU ${info?.meta?.computeUnitsConsumed}`);
  }

  const balanceAfter = await connection.getBalance(payer.publicKey);
  const acct = await connection.getAccountInfo(priceUpdateAccount, "confirmed");
  const totalFees = txs.reduce((s, x) => s + Number(x.feeLamports ?? 0), 0);

  // Rejection probes by simulation (only while the account still exists).
  const probes: Record<string, unknown> = {};
  if (acct) {
    const pt = Number(parsed.price.publish_time);
    const prev = Number(parsed.metadata?.prev_publish_time);
    const cases: Array<[string, TransactionInstruction]> = [
      ["valid", checkIx(priceUpdateAccount, feedId, t, 10_000)],
      ["wrong_feed", checkIx(priceUpdateAccount, FEEDS[feedName === "BTC" ? "ETH" : "BTC"], t, 10_000)],
      ["t_after_publish (BeforeT)", checkIx(priceUpdateAccount, feedId, pt + 1, 10_000)],
      ["t_equals_prev (NotFirstAfter)", checkIx(priceUpdateAccount, feedId, prev, 10_000)],
      ["max_conf_0 (ConfidenceTooWide)", checkIx(priceUpdateAccount, feedId, t, 0)],
      ["foreign_owner (payer as update)", checkIx(payer.publicKey, feedId, t, 10_000)],
    ];
    for (const [name, ix] of cases) {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const msg = new TransactionMessage({ payerKey: payer.publicKey, recentBlockhash: blockhash, instructions: [ix] }).compileToV0Message();
      const vtx = new VersionedTransaction(msg);
      vtx.sign([payer]);
      const sim = await connection.simulateTransaction(vtx, { sigVerify: false });
      probes[name] = {
        ok: sim.value.err === null,
        err: sim.value.err,
        unitsConsumed: sim.value.unitsConsumed,
        log: (sim.value.logs ?? []).filter((l) => /Error|ok: price|failed/.test(l)).slice(0, 3),
      };
      console.log(`probe ${name}: ${sim.value.err === null ? "OK" : "REJECTED"}`);
    }
  }

  const result = {
    label,
    feed: feedName,
    feedId,
    t,
    tIso: new Date(t * 1000).toISOString(),
    mode,
    closeUpdateAccounts: closeArg === "close",
    hermes: {
      publish_time: parsed.price.publish_time,
      prev_publish_time: parsed.metadata?.prev_publish_time ?? null,
      price: parsed.price.price,
      conf: parsed.price.conf,
      expo: parsed.price.expo,
      updateDataBytes: Buffer.from(updateData[0], "base64").length,
    },
    transactions: txs,
    txCount: txs.length,
    totalFeeLamports: totalFees,
    balanceDeltaLamports: balanceBefore - balanceAfter,
    netRentLockedLamports: balanceBefore - balanceAfter - totalFees,
    priceUpdateAccount: priceUpdateAccount.toBase58(),
    priceUpdateAccountExists: acct !== null,
    priceUpdateAccountLamports: acct?.lamports ?? null,
    priceUpdateAccountBytes: acct?.data.length ?? null,
    probes,
  };

  mkdirSync("../results", { recursive: true });
  writeFileSync(`../results/${label}.json`, JSON.stringify(result, null, 2));
  if (acct) {
    mkdirSync("../fixtures", { recursive: true });
    writeFileSync(
      `../fixtures/${label}.json`,
      JSON.stringify(
        {
          pubkey: priceUpdateAccount.toBase58(),
          owner: acct.owner.toBase58(),
          lamports: acct.lamports,
          executable: acct.executable,
          data_base64: Buffer.from(acct.data).toString("base64"),
        },
        null,
        2,
      ),
    );
  }
  const { transactions: _t, probes: _p, ...summary } = result;
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
