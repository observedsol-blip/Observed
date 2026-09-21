// Diagnostics — debug build only. Three taps, three numbers, nothing on mainnet.
//
// This screen exists to answer the questions that cannot be answered without a Seeker in hand:
//   1. How many approvals does ONE transaction with two instructions cost?
//   2. How long does the round trip to the wallet and back take?
//   3. Can Seed Vault sign a message at all, and is the signature deterministic?
// Everything runs on devnet and nothing is ever sent: the transaction is signed and thrown away.
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { MwaWallet } from "../platform/mwaWallet.ts";
import { MEMO_ID, SECRET_MESSAGE_PREFIX } from "../chain/ids.ts";
import { secretFromSignature, secretMessage } from "../core/secret.ts";
import { bytesToHex } from "../chain/calendar.ts";
import { color, space, type } from "../tokens";

const hex = (b: Uint8Array) => bytesToHex(b);
const short = (s: string) => `${s.slice(0, 8)}…${s.slice(-6)}`;

export default function Diagnostics() {
  const [lines, setLines] = useState<string[]>([
    "Diagnostics — debug build",
    "devnet only · nothing is sent · no real seal",
  ]);
  const [busy, setBusy] = useState(false);
  const [wallet] = useState(
    () =>
      new MwaWallet({
        cluster: "solana:devnet",
        // The diagnostics never send, so a fixed blockhash is enough to build a transaction.
        getBlockhash: async () => "11111111111111111111111111111111",
        sendRaw: async () => {
          throw new Error("diagnostics never send");
        },
      }),
  );
  const say = (line: string) => setLines((l) => [...l, line]);

  const run = async (label: string, what: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    say(`--- ${label}`);
    const started = Date.now();
    try {
      await what();
    } catch (e) {
      say(`  FAILED after ${Date.now() - started} ms: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const connect = () =>
    run("Connect", async () => {
      const started = Date.now();
      const session = await wallet.connect();
      say(`  wallet: ${session.label ?? "(no label)"}`);
      say(`  address: ${short(session.pubkey.toBase58())}`);
      say(`  back in the app after ${Date.now() - started} ms`);
      say(`  auth token: ${session.authToken ? "yes" : "no"}`);
    });

  const signTwoInOne = () =>
    run("Sign 2 in 1", async () => {
      const session = await wallet.connect();
      const memo = (text: string) =>
        new TransactionInstruction({
          programId: MEMO_ID,
          keys: [],
          data: Buffer.from(new TextEncoder().encode(text)),
        });
      const started = Date.now();
      // Two harmless instructions in ONE transaction — the shape of the real evening.
      await wallet
        .signAndSend([memo("observed diagnostics 1"), memo("observed diagnostics 2")], session.pubkey)
        .catch((e) => {
          // signAndSend refuses to send in this screen; a throw from OUR sendRaw means the
          // signing itself worked, which is what we are measuring.
          if (e instanceof Error && e.message.includes("diagnostics never send")) return "";
          throw e;
        });
      say(`  one transaction, two instructions`);
      say(`  signed and back after ${Date.now() - started} ms`);
      say(`  >>> COUNT THE SHEETS: how many approvals did the wallet show? <<<`);
    });

  const signMessageTwice = () =>
    run("signMessage", async () => {
      const session = await wallet.connect();
      const message = secretMessage(session.pubkey);
      say(`  message: ${SECRET_MESSAGE_PREFIX}${short(session.pubkey.toBase58())}`);
      const t1 = Date.now();
      const first = await wallet.signMessage(message);
      const ms1 = Date.now() - t1;
      const t2 = Date.now();
      const second = await wallet.signMessage(message);
      const ms2 = Date.now() - t2;
      const same = hex(first) === hex(second);
      say(`  signature 1: ${short(hex(first))} (${ms1} ms)`);
      say(`  signature 2: ${short(hex(second))} (${ms2} ms)`);
      say(`  deterministic: ${same ? "YES" : "NO"}`);
      say(`  secret would be: ${short(hex(secretFromSignature(first)))}`);
      if (!same) say("  >>> NOT deterministic: recovery after a reinstall will NOT work <<<");
      say(`  >>> COUNT THE SHEETS for each signature <<<`);
    });

  const copy = () => Clipboard.setStringAsync(lines.join("\n"));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.ground }} contentContainerStyle={{ padding: space.lg }}>
      <Text style={{ color: color.ink, fontSize: 18, marginBottom: space.md }}>Diagnostics — debug build</Text>
      <View style={{ gap: space.sm, marginBottom: space.lg }}>
        <Button label="1 · Connect" onPress={connect} busy={busy} />
        <Button label="2 · Sign 2 in 1" onPress={signTwoInOne} busy={busy} />
        <Button label="3 · signMessage twice" onPress={signMessageTwice} busy={busy} />
        <Button label="Copy results" onPress={copy} busy={false} />
      </View>
      {lines.map((l, i) => (
        <Text
          key={i}
          selectable
          style={[type.monoSmall, { color: l.startsWith("  >>>") ? color.pencil : color.ink }]}
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
