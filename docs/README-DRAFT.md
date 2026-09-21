# Observed — README (Entwurf, noch nicht die echte README)

> Entwurf vom 21.09.2026, auf den Stand vom 22.09.2026 gezogen. Ersetzt die vierzeilige README **erst nach Freigabe**. Zahlen mit
> `TBD` stehen erst nach dem Mainnet-Deploy am 24./26.09. fest.

---

## What this is

One binary question a day, answered with a side and a number, sealed before anyone can know the
answer, opened the next evening. Over a season it becomes a record you cannot rewrite: not
whether you were right, but whether you were as sure as you should have been. Built for the
Solana Seeker; the Genesis Token is the ticket, one device, one answer per day. No stake, no
payout, no prize.

## What the program enforces, and what the app merely provides

The distinction matters, so it comes before anything else.

**The program enforces:**
- One entry per Genesis Token and call. The SGT is checked by mint authority, supply, decimals,
  group membership and balance — not against a list of addresses.
- An answer is sealed as a hash and cannot be changed afterwards. The number becomes public only
  when the player reveals it.
- The question, the price account, the threshold, the measurement band and every deadline are
  fixed before the season starts, as a Merkle tree whose root is on chain. A call that is not in
  that tree cannot be created. Most days the question is a **direction** — is the price higher at
  16:00 than the reference at 04:02 UTC, strictly higher — and on five days it is a movement of at
  least 1 % either way.
- A sealed answer can be revealed for **72 hours** after the outcome. Miss three evenings in a row
  and it is gone; miss one and the app catches up in the same single approval the next time.
- The reference price is read **after** sealing closes. The program refuses any calendar where an
  admissible reference could have been published while sealing was still open.
- Both readings come from the one Pyth account named in the call, at most 60 seconds old, fully
  verified, within a confidence bound. The first valid submission fixes the value; everyone can
  see which one it was.
- A missing reveal costs a full miss. Silence is never cheaper than an honest answer.
- Nobody — not the owner, not the resolver — can change an outcome after the fact. There is no
  instruction for it.

**The app provides (and could, in principle, lie about):**
- The wording of the question, the local times, the crowd distribution, the streak, the Brier
  value and every sentence on the screen. All of it is derived from what the chain stores; none
  of it is enforced by the chain.
- The sentence you write is on your phone unless you switch on sharing. If you do share it, its
  hash goes into the sealing transaction and the text into the reveal — so anyone can check that
  the sentence is the one you sealed, and not one written after the outcome.
- The reminders. They are local, planned on the phone, offered only after the first sealed call,
  and the permission is asked only when you tap the offer.
- The app makes no sound at all.

Anything in the second list can be checked against the first. How, is below.

## What it costs

There are no app fees, and this is the only sentence about money that matters: **we take
nothing.** What it does cost is the network's own price.

| | |
|---|---|
| Deposit per sealed answer | ≈ 0.00217 SOL — rent for the entry account. **Comes back** to your wallet when the call is closed (from 9 Nov 2026) |
| Network fee per day | ≈ 0.0001 SOL, plus priority fee on a busy evening |
| A whole season, 64 calls | under 0.01 SOL in fees; the deposits return |

The earlier claim "no fees" was wrong and has been removed: a Solana transaction always costs a
fee, and an account always costs rent. Saying otherwise would be the first thing a juror checks.

## Authorities, stated plainly

The program has a single authority, held offline by the owner: deploy, calendar, pause and
upgrade. **That is a trust assumption, and it is not hidden:** whoever holds that key can upgrade
the program, and a future version could behave differently from the one that is deployed today.

- There is no multisig before the submission. A multisig set up in a hurry is a second untested
  thing, not a safer one.
- There is no instruction to rotate the authority; losing the key would mean the program can
  never be changed again, which is a failure mode we accept over the alternative.
- What an upgrade **cannot** do: change a call that has already been decided. The outcome, the
  readings and the entries are on chain, and every historical value stays readable.

`SECURITY.md` names the same things with the threat model.

## Versions and how to build it

| | |
|---|---|
| Anchor | 1.2.0 |
| Solana CLI | 4.0.0 (Agave) |
| Rust | 1.98.1 (pinned in `rust-toolchain.toml`) |
| Node | 24 (for the resolver and the app's tests) |
| Expo SDK | 54, React Native 0.81.5 |

```
anchor build                 # the program — always before cargo test, see below
cargo test --test observed   # 50 tests
cargo test --test season     # the whole season in fast forward, 64 calls, 20 devices
cargo test --test capacity   # the daily transaction against the 1 232 byte limit
cargo clippy --all-targets -- -D warnings
cd app && npm install && npm test   # 129 app tests
```

Measured on 22.09.2026: `anchor build` 6 s incremental (1 min 11 s on a clean clone), 50 + 1 + 2 + 3
program tests green, season run 29,6 s, 129 app tests in 0,4 s, clippy silent.

**`cargo test` tests the built binary, not the source.** The tests load `target/deploy/observed.so`
through `include_bytes!`. Without a build first you are testing the previous state and getting green
ticks for a change that is not in it. Build, then test, then deploy that same file.

**Reproducibility, honestly:** two builds of the same commit with the same toolchain in different
directories produce `.so` files of identical size that differ in a few hundred bytes (measured:
896 of 345 288). The build is therefore **not byte-identical** across machines. What is published
instead is the SHA-256 of the deployed file plus the output of `solana program dump`, truncated to
the file's own length — the dump is zero-padded, and without truncating, the two checksums never
match. The whole sequence was rehearsed against a local validator on 22.09.2026 and produced
identical checksums. The mainnet value is `TBD` until the deploy, because `--features mainnet`
changes the binary.

## Verify a call yourself

Nothing here needs our code, and this is where the evidence lives — the app has no evidence screen
on purpose. One command, read-only, no key, no install beyond the repository:

```
node scripts/verify-round.mjs --round 11
node scripts/verify-round.mjs --round 11 --rpc https://your-endpoint --deep
```

A call number is enough; the RPC defaults to the public mainnet endpoint and the calendar to the
one in this repository. Exit code 0 means every check passed. What it does, and what you could do
by hand instead:

1. **Read the call.** `solana account <round PDA>` — or the explorer link in the app. It holds the
   terms hash, the price account, both readings with their publish times and slots, the outcome
   and the margin.
2. **Recompute the terms hash** from the values in the account and check it against the Merkle
   root in the config account. That proves the question was fixed before the season started.
3. **Check the reference.** Its `publish_time` must be after sealing closed, and its `posted_slot`
   names the transaction in which Pyth posted it. Look that transaction up; it is not ours.
4. **Recompute the outcome.** Both prices, one exponent, one cross-multiplication. No rounding.
5. **Check an entry.** `commitment = sha256("observed/commit/v1" ‖ program ‖ round ‖ terms_hash ‖
   mint ‖ wallet ‖ p_bps ‖ salt)`. After a reveal, salt and p_bps are public — the hash has to
   match the one that was stored before the outcome existed.
6. **Check a shared sentence.** `sha256(salt ‖ sentence)` must equal the single 64-hex memo in the
   very transaction that carried that wallet's commit. A commit cannot happen outside the sealing
   window, so such a memo is necessarily older than the outcome.

The script does all six, prints both readings with `publish_time`, posting slot and submitter, and
says `PASS` or names the check that failed. It opens every revealed seal it fetched (a sample by
default, all of them with `--deep`) — the salt is public once an answer is revealed, so anybody can
redo that arithmetic.

## What is not finished

- The app has no tests on a real device beyond the measured wallet flow (one approval per day,
  confirmed on a Seeker on 21.09.2026). There is no UI test library; the screens are drawn from
  views that are tested, but the drawing itself is not.
- The season has not run on mainnet yet.
- There is no external audit. There is an internal one, with its findings and their fixes in
  `docs/HANDOFF.md` — including two that changed behaviour: sealing is refused until both halves
  of the answer are a decision, and a shared sentence only counts if its hash was in the commit
  transaction.
- The preview (a simulated call for first-time visitors outside the window) is not built.

---

**Offene Punkte für die echte README:** Prüfsumme und Programm-ID nach dem Deploy, der
Verifikationsskript-Pfad, Screenshots, und der eine Satz über Trepa (E9), falls er drin bleiben
soll.
