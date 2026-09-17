// SPIKE 3 ONLY — test harness, not product UI (no design-bible styling, no product copy).
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { PublicKey } from "@solana/web3.js";
import {
  clearLog,
  connectWallet,
  connection,
  getRecord,
  listRounds,
  loadLog,
  log,
  markUnknown,
  reconcile,
  sealToday,
  selfTest,
  SealRecord,
  wipeAll,
} from "./src/spike";

const START_ROUND = Math.floor(Date.now() / 86_400_000); // day number, just a starting point

export default function App() {
  const [player, setPlayer] = useState<PublicKey | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [round, setRound] = useState(START_ROUND);
  const [p, setP] = useState(4000);
  const [records, setRecords] = useState<SealRecord[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (who: PublicKey | null) => {
    const rounds = await listRounds();
    const recs = (await Promise.all(rounds.map(getRecord))).filter((r): r is SealRecord => r !== null);
    setRecords(recs.sort((a, b) => b.round - a.round));
    setLines([...(await loadLog())].reverse());
    if (who) setBalance((await connection.getBalance(who)) / 1e9);
  }, []);

  useEffect(() => {
    (async () => {
      await log(`APP START — self-test commitment: ${(await selfTest()) ? "PASS" : "FAIL"}`);
      await refresh(null);
    })();
  }, [refresh]);

  const run = (label: string, fn: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      await log(`${label} error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      await refresh(player);
      setBusy(false);
    }
  };

  const onConnect = run("connect", async () => {
    const who = await connectWallet();
    setPlayer(who);
    await log(`connected ${who.toBase58().slice(0, 6)}… — reconciling`);
    await reconcile(who);
    const rounds = await listRounds();
    if (rounds.length) setRound(Math.max(...rounds) + 1);
    await refresh(who);
  });

  const seal = (mode: "send" | "sign-only") =>
    run("seal", async () => {
      if (!player) throw new Error("connect first");
      await sealToday(player, round, p, mode);
    });

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.pad}>
        <Text style={s.h}>SPIKE 3 · devnet · not the app</Text>
        <Text style={s.t}>wallet: {player ? player.toBase58() : "not connected"}</Text>
        <Text style={s.t}>balance: {balance ?? "–"} SOL (devnet)</Text>

        <Row>
          <Btn label="Connect wallet" onPress={onConnect} />
          <Btn label="Reconcile" onPress={run("reconcile", async () => {
            if (player) await reconcile(player);
          })} />
        </Row>

        <Text style={s.h2}>Round {round}</Text>
        <Row>
          <Btn label="round −1" onPress={() => setRound(round - 1)} />
          <Btn label="round +1" onPress={() => setRound(round + 1)} />
        </Row>
        <Text style={s.h2}>p = {p / 100}%</Text>
        <Row>
          <Btn label="−5" onPress={() => setP(Math.max(0, p - 500))} />
          <Btn label="+5" onPress={() => setP(Math.min(10000, p + 500))} />
        </Row>

        <Row>
          <Btn label="SEAL (reveal prev + commit)" onPress={seal("send")} strong />
        </Row>
        <Row>
          <Btn label="Sign only (count sheets)" onPress={seal("sign-only")} />
          <Btn label={`Mark round ${round} unknown`} onPress={run("mark", () => markUnknown(round))} />
        </Row>

        <Text style={s.h2}>Records</Text>
        {records.length === 0 && <Text style={s.t}>none</Text>}
        {records.map((r) => (
          <Text key={r.round} style={s.t}>
            #{r.round} {r.status} p={r.p_bps / 100}% persisted→wallet{" "}
            {r.walletRequestAt ? `${r.walletRequestAt - r.persistedAt} ms` : "–"}
            {r.signature ? ` sig ${r.signature.slice(0, 8)}…` : ""} {r.note ? `(${r.note})` : ""}
          </Text>
        ))}

        <Text style={s.h2}>Log (newest first)</Text>
        <Row>
          <Btn label="Copy log" onPress={async () => { await Clipboard.setStringAsync([...lines].reverse().join("\n")); }} />
          <Btn label="Clear log" onPress={run("clear", clearLog)} />
          <Btn
            label="Wipe records"
            onPress={() =>
              Alert.alert("Wipe", "Delete all local records and auth token?", [
                { text: "Cancel" },
                { text: "Wipe", style: "destructive", onPress: run("wipe", wipeAll) },
              ])
            }
          />
        </Row>
        {lines.map((l, i) => (
          <Text key={i} style={s.log}>{l}</Text>
        ))}
        {busy && <Text style={s.h2}>working…</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={s.row}>{children}</View>;
}
function Btn({ label, onPress, strong }: { label: string; onPress: () => void; strong?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[s.btn, strong && s.strong]}>
      <Text style={s.btnT}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#111" },
  pad: { padding: 16, paddingTop: 48 },
  h: { color: "#fff", fontSize: 18, fontWeight: "600", marginBottom: 8 },
  h2: { color: "#fff", fontSize: 15, marginTop: 16, marginBottom: 4 },
  t: { color: "#ccc", fontSize: 13, marginBottom: 2 },
  log: { color: "#9c9", fontSize: 11, fontFamily: "monospace" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 4 },
  btn: { backgroundColor: "#333", paddingVertical: 12, paddingHorizontal: 14 },
  strong: { backgroundColor: "#3A6EA5" },
  btnT: { color: "#fff", fontSize: 14 },
});
