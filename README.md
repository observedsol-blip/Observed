# Observed

One question a day, one probability, one Seed Vault approval — and, over weeks, proof of whether your confidence is right. Built for the Solana Seeker. No stake, no fees, no prizes.

Start here: `docs/00-SPEC.md`. Program: `docs/01-PROGRAM.md`. Security: `SECURITY.md`. Calendar: `CALENDAR.md`.

---

## Resolve a round yourself

Three of the program's instructions take no authority at all. `create_round` checks a Merkle
proof against the calendar that was published before the season started. `set_reference` and
`resolve` check the clock and the price account the round names. **None of them checks who is
asking.**

So the service that normally does this can be down, out of SOL, or gone, and the season
continues — by anybody. That is only worth something if the commands are written down, so here
they are.

You need a Solana keypair file with a little SOL in it, and this repository — for the calendar,
and for `@solana/web3.js`, which is already installed under `app/`.

```sh
# 1. put the round on chain — needs the calendar, for the terms and the Merkle proof
node scripts/resolve-round.mjs create \
  --round 7 \
  --calendar tests/fixtures/calendar/season1.json \
  --rpc https://api.mainnet-beta.solana.com \
  --keypair ~/my-key.json

# 2. the reference reading, in [reference_time, +60 s] — 04:02 UTC in season 1
node scripts/resolve-round.mjs reference --round 7 --rpc <url> --keypair ~/my-key.json

# 3. the outcome reading, in [outcome_time, +60 s] — 16:00 UTC
node scripts/resolve-round.mjs resolve --round 7 --rpc <url> --keypair ~/my-key.json
```

The script creates no key and reads none you do not name: `--keypair` is required and has no
default. Steps 2 and 3 need nothing but the round number — the price account is read off the
round itself, so you cannot point it at a feed the calendar did not name.

**What it costs you:** the network fee, plus the rent for the Round account in step 1. That rent
is **not** refundable — the program has no instruction that closes a Round. Steps 2 and 3 cost a
fee and nothing else.

**When it is refused, and rightly so:** outside the window (`TooEarly`,
`OutsideSubmissionWindow`), with a reading that is too old (`StaleReading`), too uncertain
(`ConfidenceTooWide`) or not fully verified (`NotFullyVerified`), from the wrong account
(`WrongPriceAccount`), or with terms that are not in the published calendar (`BadMerkleProof`).
Trying after somebody else was faster fails too (`RoundNotOpen`, `NoReference`) — that is the
system working, not a problem.

Afterwards, check what landed with the verifier, which reads nothing but the chain:

```sh
node scripts/verify-round.mjs --round 7 --rpc <url> \
  --calendar tests/fixtures/calendar/season1.json --deep
```

### These commands are run, not claimed

`spikes/e2e/matrix.mjs` uses this very script for one `create_round` and for the first
`set_reference` and `resolve` of every run, against a local validator with the real program. If
this page goes stale, the matrix fails. From the run of 23.09.2026:

```
--- setup
  create_round 11 via scripts/resolve-round.mjs: ok

--- the readings (what the resolver does)
  set_reference 0 via scripts/resolve-round.mjs: ok
  resolve 0 via scripts/resolve-round.mjs: ok

=== scripts/resolve-round.mjs, run against this validator ===
  set_reference 0 — price account 7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE
  set_reference 0: ok
    signature 5yN4kjmeaYJMTgvsK8MeArzYrzZxkQPVCeWNk25QFnhPdXAzpu3MdEfBBZ6eCYFyzGtV2935TLXiEg52vo9iynwd
    compute units 10502
  resolve 0 — price account 7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE
  resolve 0: ok
    signature 3dBiwqsFaNJf7Jv2PHnCTdRPoPm1VY6CiphWVHPfDHkXD6NzpNwu2deGp6gQRuKsHJXjMfZwxGudwSPJvdBESzaD
    compute units 11013

ALL ROWS PASS · 13 rows
```

**What is deliberately not on this page:** `score_entry`, `close_entry` and `cancel_round` are
permissionless too. `score_entry` and `close_entry` move a player's deposit and `cancel_round`
ends a round for everybody — they belong with the operator's runbook
(`docs/operations-daily-job.md`), not with "help out for an evening".
