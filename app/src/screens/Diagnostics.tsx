// Diagnostics — debug build only. Nothing on mainnet, nothing sent, no real seal.
//
// What it is for: the numbers that cannot be measured without a Seeker in hand.
//   1. How many approval sheets does the DAILY transaction cost — on its own, and after a cold
//      start? Everything above this screen assumes "one approval a day".
//   2. Does the auth token survive the app being closed? If it does not, every morning costs a
//      full authorization and the answer to (1) is two, not one.
//
// The first version called connect() before every test, so every count was "connect + sign" and
// answered neither question. Now connecting is its own button and the sign buttons never
// reconnect — signAndSend opens the wallet exactly once by itself.
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Connection, TransactionInstruction, type PublicKey } from "@solana/web3.js";
import { MwaWallet } from "../platform/mwaWallet.ts";
import { SecureStoreAdapter } from "../platform/secureStore.ts";
import { MEMO_ID } from "../chain/ids.ts";
import { color, space, type } from "../tokens";

const short = (s: string) => `${s.slice(0, 8)}…${s.slice(-6)}`;

export default function Diagnostics() {
  const [store] = useState(() => new SecureStoreAdapter());
  const [connection] = useState(() => new Connection("https://api.devnet.solana.com", "confirmed"));
  const [wallet] = useState(
    () =>
      new MwaWallet({
        cluster: "solana:devnet",
        getBlockhash: async () => (await connection.getLatestBlockhash("finalized")).blockhash,
        sendRaw: async () => {
          throw new Error("diagnostics never send");
        },
        tokens: {
          load: () => store.get("mwa-auth-token"),
          save: async (t) =>
            t === null ? store.delete("mwa-auth-token") : store.set("mwa-auth-token", t),
          loadAddress: () => store.get("mwa-address"),
          saveAddress: async (a) =>
            a === null ? store.delete("mwa-address") : store.set("mwa-address", a),
        },
      }),
  );
  const [payer, setPayer] = useState<PublicKey | null>(null);
  const [lines, setLines] = useState<string[]>([
    "Diagnostics — debug build",
    "devnet only · nothing is sent · no real seal",
    "",
    "THE TEST THAT MATTERS:",
    "close the app completely, reopen it, and tap 3",
    "WITHOUT tapping 1 first. Count the sheets.",
    "That is the daily case: one tap, how many approvals?",
    "",
  ]);
  const [busy, setBusy] = useState(false);
  const say = (line: string) => setLines((l) => [...l, line]);

  const memo = (text: string) =>
    new TransactionInstruction({
      programId: MEMO_ID,
      keys: [],
      data: Buffer.from(new TextEncoder().encode(text)),
    });

  const run = async (label: string, what: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    say(`--- ${label}`);
    const started = Date.now();
    try {
      await what();
    } catch (e) {
      const name = e instanceof Error ? e.name : typeof e;
      say(
        `  FAILED after ${Date.now() - started} ms [${name}]: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    } finally {
      setBusy(false);
    }
  };

  /** Signs without sending. Only OUR own "never send" is swallowed. */
  const sign = async (ixs: TransactionInstruction[], who: PublicKey) => {
    await wallet.signAndSend(ixs, who).catch((e) => {
      if (e instanceof Error && e.message.includes("diagnostics never send")) return "";
      throw e;
    });
  };

  /** The address to sign for. After a cold start the app does not know it yet — that costs one
   *  extra trip to the wallet, and the line says so, because it would otherwise look like an
   *  extra approval for the signature. */
  const addressFor = async (): Promise<PublicKey> => {
    if (payer) return payer;
    const stored = await wallet.storedAddress();
    if (stored) {
      setPayer(stored);
      say(`  address from the last session, no wallet trip: ${short(stored.toBase58())}`);
      return stored;
    }
    say("  (no address known yet — connecting once to learn it; this costs a trip)");
    const session = await wallet.connect();
    setPayer(session.pubkey);
    return session.pubkey;
  };

  const connect = () =>
    run("1 · Connect", async () => {
      const stored = await wallet.hasStoredSession();
      say(`  stored session before this: ${stored ? "yes" : "no"}`);
      const started = Date.now();
      const session = await wallet.connect();
      setPayer(session.pubkey);
      say(`  wallet: ${session.label ?? "(no label)"}`);
      say(`  address: ${short(session.pubkey.toBase58())}`);
      say(`  back in the app after ${Date.now() - started} ms`);
      say("  >>> SHEETS for connecting alone: ? <<<");
    });

  const signOne = () =>
    run("2 · Sign 1 memo (no connect)", async () => {
      const who = await addressFor();
      const started = Date.now();
      await sign([memo("observed diagnostics")], who);
      say(`  one instruction, signed and back after ${Date.now() - started} ms`);
      say("  >>> SHEETS for signing alone: ? <<<");
    });

  const signDaily = () =>
    run("3 · Sign the daily transaction (no connect)", async () => {
      const who = await addressFor();
      const started = Date.now();
      // The shape of the real evening: reveal yesterday + seal today, in ONE transaction.
      await sign([memo("observed reveal"), memo("observed seal")], who);
      say(`  two instructions in one transaction, back after ${Date.now() - started} ms`);
      say("  >>> SHEETS for the daily transaction: ? <<<");
      say("  >>> now close the app, reopen, tap 3 again, count again <<<");
    });

  const forget = () =>
    run("Forget the session", async () => {
      await wallet.disconnect();
      setPayer(null);
      say("  token deleted — the next sign starts from nothing");
    });

  const copy = () => Clipboard.setStringAsync(lines.join("\n"));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.ground }}
      contentContainerStyle={{ padding: space.lg }}
    >
      <Text style={{ color: color.ink, fontSize: 18, marginBottom: space.md }}>
        Diagnostics — debug build
      </Text>
      <View style={{ gap: space.sm, marginBottom: space.lg }}>
        <Button label="1 · Connect" onPress={connect} busy={busy} />
        <Button label="2 · Sign 1 memo (no connect)" onPress={signOne} busy={busy} />
        <Button label="3 · Sign daily tx (no connect)" onPress={signDaily} busy={busy} />
        <Button label="Forget the session" onPress={forget} busy={busy} />
        <Button label="Copy results" onPress={copy} busy={false} />
      </View>
      {lines.map((l, i) => (
        <Text
          key={i}
          selectable
          style={[type.monoSmall, { color: l.includes(">>>") ? color.pencil : color.ink }]}
        >
          {l}
        </Text>
      ))}
    </ScrollView>
  );
}

function Button({ label, onPress, busy }: { label: string; onPress: () => void; busy: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy}
      style={{
        borderWidth: 1,
        borderColor: color.ink,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        opacity: busy ? 0.4 : 1,
      }}
    >
      <Text style={[type.mono, { color: color.ink }]}>{label}</Text>
    </TouchableOpacity>
  );
}
