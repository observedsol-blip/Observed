# Observed — for testers

One question a day about something nobody knows yet. You answer with a side and a number, seal
it, and open it the next evening. Over a few weeks that becomes a record you cannot rewrite.

This is a test build. It runs on Solana mainnet with real (tiny) amounts, and it needs a Seeker
with its Genesis Token.

## Before you install

**Uninstall "Observed Diag" if you have it.** That was the diagnostics build. It is a different
app and it will not be in your way, but you do not need two.

**What to look for on your home screen:** a dark tile with a serif **"O."** — the full stop is
blue. The diagnostics build had the grey Expo default icon.

## What you need

| | |
|---|---|
| A Seeker | with the Genesis Token in the wallet you will use |
| SOL | **0.05 SOL** is plenty for the whole season |
| Two minutes a day | in the evening, or any time until 06:00 the next morning |

**Where the SOL goes.** Each sealed answer parks about **0.002 SOL** as a deposit, plus a network
fee of roughly 0.0001 SOL. Nothing is paid to us — there are no app fees. The deposit is **yours**
and comes back to your wallet automatically once the call is closed, from **9 November** onwards.
With 0.05 SOL you can seal every day of the season and still have a reserve.

## The question

Most days it is a direction: **"Will SOL be higher at 16:00 than at 04:02 UTC?"** Strictly higher —
if the two prices are equal, the answer is No. On five days of the season the question is about a
**movement** instead ("more than 1 % away from the reference, either way"), and those days carry a
line saying why, for example "US jobs report at 12:30 UTC."

Every question of the season was fixed and published before the first day. The app cannot invent
one, and nobody can slip an extra one in.

## The day

Times are shown in your local time in the app. In UTC the day looks like this:

| | |
|---|---|
| **18:00** (16:00 UTC) | The new question opens. Yesterday's outcome is in. |
| until **06:00** (04:00 UTC) | You can seal. |
| **06:02** (04:02 UTC) | The reference price is taken — after sealing closes, so nobody who sealed could have seen it. |
| **18:00** (16:00 UTC) | The outcome price is taken. |

So: **open the app in the evening, do the day in one go.** One approval in the wallet covers
everything — it reveals what is open and seals today's answer in a single transaction.

## What you do

1. **Pick a side.** Up or Down.
2. **Say how sure.** Move the scale: 50 to 100 in steps of 5. It starts at 50 and says `How sure?`
   until you touch it — **"Seal today" stays inactive until you do.** That is deliberate: a 50 you
   never chose is not an answer. If you truly have no opinion, set the scale to 50 on purpose;
   that is a real 50/50, and it counts as "no side" — neither a hit nor a miss.
3. **Optionally write one sentence.** Why did you pick that side? It stays on your phone unless
   you switch on "Share it after the reveal".
4. **Tap "Seal today".** One approval in the wallet. Done.
5. **Next evening:** open the app. You see what you wrote, what you sealed, and whether the call
   went your way.

**You have three days to reveal.** If you skip an evening, the calls you already sealed are not
lost — open the app within 72 hours of the outcome and they go out with your next seal, in the same
single approval. After that, a sealed answer that was never revealed counts as a **full miss**
(1.000, the worst score any answer can get). Silence is never cheaper than an honest answer.

## Reminders

After your first sealed call the app offers **"Remind me each evening"**. Only then does Android
ask for the notification permission — nothing is asked on first start, and nothing is scheduled
until you tap. The reminders are local: they are planned on your phone, no server is involved, and
they carry no answer of yours.

**The app makes no sound.** Not when sealing, not when revealing. If you hear anything, that is
your phone, not us.

## What can go wrong, and what it means

| What you see | What it is |
|---|---|
| "Not enough SOL to seal" | Top up. Your answer is already saved on your phone; seal it before the window closes. |
| "No Genesis Token found in this wallet" | You connected a wallet without the token. Switch wallets. |
| "Window closed" | You were too late for today. Open calls can still be revealed. |
| The wallet takes 10–15 seconds | Normal. Seed Vault is not fast. |
| Nothing happens after the approval | Reopen the app. It asks the chain what really happened and never seals twice. |

**Do not uninstall the app while you have open answers.** Answers you have sealed but not yet
revealed live on this phone. If you must reinstall, go to **Settings → Backup code** first and tap
**"Copy backup code"** — 64 characters, straight to your clipboard. Keep it private: with it,
somebody could read your sealed answers before you reveal them.

After a reinstall, paste it into **"Restore your open calls"**. What you get back is stated plainly:
`2 calls restored.`, or `2 calls restored. 1 call can't be opened with this code — it will count as
a miss.`, or `This code doesn't match your sealed calls.`, or `No open calls to restore.`

The field refuses a wallet recovery phrase on sight. **Never paste your wallet phrase into any app,
including this one.**

## What I need from you

Short and honest is better than detailed. After your first evening, and then whenever something
is odd:

1. **How many approval sheets did the wallet show?** One or two?
2. **Did you understand what you were being asked?** Where did you hesitate?
3. **What did you do the next evening — did you open the app on your own, or did you forget?**
4. **Anything that felt wrong, slow, or dishonest.**

And on day four or five, one question that matters more than the rest: **do you still remember
what you wrote on day one — before you look?**

## What this is not

It is not a prediction market. There is no stake, no payout, no prize. Nobody wins money, and
nobody can lose any beyond the fees and the deposit that comes back.
