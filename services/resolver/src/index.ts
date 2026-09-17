// Observed resolver — one hourly run, no fixed clock times. Every run does the same thing:
// look at the chain, do whatever is due, within a time budget. A missed run heals itself,
// because the work is derived from state, not from a schedule.
//
// Priority inside a run: missing reference → missing resolution → due cancel_round → as many
// score_entry as fit into the budget (batched, several per transaction).
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import {
  cancelRoundIx,
  configPda,
  loadRounds,
  loadUnscoredEntries,
  playerPda,
  resolveIx,
  RoundStatus,
  scoreEntryIx,
  setReferenceIx,
  type Round,
} from "./chain";
import { postAndConsume, PythUnavailable } from "./pyth";
import { priorityFee, sendWithRetry, SendFailed } from "./send";
import { backlogAlarm, backlogOk, runFailed, runOk, runStarted, type HealthUrls } from "./health";

export type Env = {
  RPC_URL: string;
  PYTH_API_KEY: string;
  HOT_WALLET_KEY: string; // base58 secret key, Worker secret, never logged
  HEALTHCHECK_RUN_URL: string;
  HEALTHCHECK_BACKLOG_URL: string;
  GAME_ID: string;
};

/** Soft budget per run. Cron triggers on the paid plan allow far more; we stop early on purpose. */
const BUDGET_MS = 60_000;
/** Score entries per transaction. Each score_entry is ~11 700 CU, so 10 stay well under the cap. */
const SCORE_BATCH = 10;
const SCORE_CU_PER_ENTRY = 13_000;
const ORACLE_CU = 60_000;
/** Below this the service is one dead round away from being useless — alarm, do not stay silent. */
const BALANCE_FLOOR_LAMPORTS = 50_000_000; // 0.05 SOL
const BACKLOG_ALARM_SECS = 12 * 3600;

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(run(env));
  },
  // `wrangler dev --test-scheduled` hits this, and it is handy for a manual kick.
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== "/__scheduled") return new Response("observed resolver", { status: 200 });
    const log = await run(env);
    return new Response(log.join("\n"), { headers: { "content-type": "text/plain" } });
  },
};

async function run(env: Env): Promise<string[]> {
  const started = Date.now();
  const left = () => BUDGET_MS - (Date.now() - started);
  const log: string[] = [];
  const say = (line: string) => {
    log.push(line);
    console.log(line);
  };

  const health: HealthUrls = { run: env.HEALTHCHECK_RUN_URL, backlog: env.HEALTHCHECK_BACKLOG_URL };
  await runStarted(health);

  try {
    const connection = new Connection(env.RPC_URL, "confirmed");
    const payer = Keypair.fromSecretKey(bs58.decode(env.HOT_WALLET_KEY));
    const config = configPda(BigInt(env.GAME_ID));
    const now = Math.floor(Date.now() / 1000);

    const balance = await connection.getBalance(payer.publicKey);
    say(`payer ${payer.publicKey.toBase58()} balance ${(balance / 1e9).toFixed(4)} SOL`);

    const rounds = await loadRounds(connection, config);
    const active = rounds.filter((r) => now < r.resolveDeadline + 7 * 86_400);
    say(`rounds: ${rounds.length} total, ${active.length} in the last week`);

    let actions = 0;

    // 1) missing reference: first valid update after commit close
    for (const r of active) {
      if (left() < 15_000) break;
      if (r.status !== RoundStatus.Open || now < r.commitClose || now >= r.resolveDeadline) continue;
      actions += await withReport(say, `set_reference round ${r.roundId}`, async () => {
        const sigs = await postAndConsume(
          connection,
          payer,
          env.PYTH_API_KEY,
          hex(r.feedId),
          r.commitClose,
          (priceUpdate) => setReferenceIx(payer.publicKey, config, r.pubkey, priceUpdate),
          await priorityFee(connection, [r.pubkey]),
        );
        return sigs[sigs.length - 1];
      });
    }

    // 2) missing resolution: first valid update after the outcome time
    for (const r of active) {
      if (left() < 15_000) break;
      if (r.status !== RoundStatus.Referenced || now < r.outcomeTime || now >= r.resolveDeadline) continue;
      actions += await withReport(say, `resolve round ${r.roundId}`, async () => {
        const sigs = await postAndConsume(
          connection,
          payer,
          env.PYTH_API_KEY,
          hex(r.feedId),
          r.outcomeTime,
          (priceUpdate) => resolveIx(payer.publicKey, config, r.pubkey, priceUpdate),
          await priorityFee(connection, [r.pubkey]),
        );
        return sigs[sigs.length - 1];
      });
    }

    // 3) rounds that ran out of time: NO_RESOLVE, stated rather than left hanging
    for (const r of active) {
      if (left() < 8_000) break;
      const unresolved = r.status === RoundStatus.Open || r.status === RoundStatus.Referenced;
      if (!unresolved || now < r.resolveDeadline) continue;
      actions += await withReport(say, `cancel_round ${r.roundId}`, () =>
        sendWithRetry(connection, payer, [cancelRoundIx(config, r.pubkey)], {
          computeUnits: 20_000,
          label: `cancel ${r.roundId}`,
        }),
      );
    }

    // 4) scoring, batched, for as long as the budget allows
    let scored = 0;
    for (const r of active) {
      if (left() < 8_000) break;
      if (r.status !== RoundStatus.Resolved) continue;
      const entries = await loadUnscoredEntries(connection, r.pubkey);
      // a missing reveal may only be scored once the reveal window is closed
      const due = now >= r.revealClose ? entries : entries.filter((e) => e.revealed);
      for (let i = 0; i < due.length && left() > 8_000; i += SCORE_BATCH) {
        const batch = due.slice(i, i + SCORE_BATCH);
        const ixs = batch.map((e) => scoreEntryIx(config, r.pubkey, e.pubkey, playerPda(config, e.sgtMint)));
        const ok = await withReport(say, `score_entry ×${batch.length} round ${r.roundId}`, () =>
          sendWithRetry(connection, payer, ixs, {
            computeUnits: batch.length * SCORE_CU_PER_ENTRY,
            label: `score ${r.roundId}`,
          }),
        );
        actions += ok;
        if (ok) scored += batch.length;
      }
    }

    // backlog check: anything stuck for more than 12 h, or an empty wallet, is an alarm
    const stuck = active.filter(
      (r) =>
        (r.status === RoundStatus.Open || r.status === RoundStatus.Referenced) &&
        now - r.outcomeTime > BACKLOG_ALARM_SECS,
    );
    const summary = `actions=${actions} scored=${scored} stuck=${stuck.length} balance=${(balance / 1e9).toFixed(4)} SOL ms=${Date.now() - started}`;
    say(summary);

    if (balance < BALANCE_FLOOR_LAMPORTS) {
      await backlogAlarm(health, `hot wallet below floor: ${(balance / 1e9).toFixed(4)} SOL — top it up`);
    } else if (stuck.length > 0) {
      await backlogAlarm(health, `unresolved for more than 12 h: rounds ${stuck.map((r) => r.roundId).join(", ")}`);
    } else {
      await backlogOk(health, summary);
    }
    await runOk(health, summary);
    return log;
  } catch (e) {
    const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    say(`RUN FAILED — ${message}`);
    await runFailed(health, message);
    return log;
  }
}

/** Runs one action, logs the outcome, and returns 1 if it did something. Never throws. */
async function withReport(
  say: (line: string) => void,
  label: string,
  action: () => Promise<string>,
): Promise<number> {
  try {
    const signature = await action();
    say(`${label}: ok ${signature.slice(0, 16)}…`);
    return 1;
  } catch (e) {
    if (e instanceof SendFailed && e.reason === "rejected") {
      // Someone else already did it, or the program refuses it — both are fine, not an outage.
      say(`${label}: skipped (${e.message.slice(0, 120)})`);
      return 0;
    }
    if (e instanceof PythUnavailable) {
      say(`${label}: pyth unavailable (${e.message})`);
      return 0;
    }
    say(`${label}: FAILED ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`);
    return 0;
  }
}
