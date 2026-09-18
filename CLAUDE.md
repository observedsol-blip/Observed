# Observed — Clock In Hackathon (deadline 8 Oct 2026, 23:59 PDT = 9 Oct 08:59 CEST)

Source of truth: @docs/00-SPEC.md
Program design: @docs/01-PROGRAM.md · Stack: @docs/02-TECH-STACK.md · Screens/copy: @docs/03-SCREEN-MAP.md
Design bible brief: @docs/04-DESIGN-BIBLE-BRIEF.md · Launch: @docs/05-LAUNCH-PLAN.md
Shared memory with the chat side: @docs/HANDOFF.md — read it first, every session.
Decisions: @docs/DECISIONS-2026-09-18.md (latest) · claim and cheat demo: @docs/ANSPRUCH-UND-DEMO.md · direction: @docs/ZIELBILD.md
The spec wins over anything in code, chat or your own judgment. Do not edit docs/00-SPEC.md; propose a dated line instead.

# Commands
- Program: `anchor build` · `anchor test` (localnet, fixtures in tests/fixtures) · `cargo clippy --all-targets -- -D warnings` · `cargo fmt`
- App: `cd app && npm run typecheck && npm test` · device build: `npm run android:seeker` (I install/verify on the Seeker myself)
- Never run any deploy or `solana program` command against mainnet. Mainnet deploys are manual, by me, from a machine you don't run on.

# Rules
- Every instruction ships with Anchor tests incl. the negative cases in docs/01-PROGRAM.md §6; "done" = docs/01-PROGRAM.md §5c.
- Checked math only. No `unwrap`/`expect` in program code. No `UncheckedAccount`, no `remaining_accounts`.
- Program IDs (Token-2022, Pyth receiver), SGT group and mint authority are `const`s, never passed accounts.
- Keys and secrets live outside the repo (`~/.config/observed/`). Never read, print, copy or reference their contents.
- UI copy comes verbatim from docs/03-SCREEN-MAP.md. Do not invent strings. Forbidden words there are forbidden in code and comments.
- Persist the reveal record BEFORE any wallet prompt (docs/01-PROGRAM.md §4). Never re-seal on an `unknown` tx status.
- When you finish a spike, write numbers (tx count, bytes, CUs, fees, approvals) to docs/spikes/<name>.md — facts, not estimates.
- If a plan deviates from the spec or the spec is silent on something you need, stop and say exactly which sentence — before building.
- Write to docs/HANDOFF.md whenever you disprove an assumption from chat or spec, have a measurement that changes a decision, or need something only Dinkelberg or the chat can supply. One line: date · who · claim · evidence · consequence. Disagreement stays visible — never silently overwrite the other side's position.
- New UI strings live in docs/COPY-NEUE-TEILE.md until they are merged into docs/03-SCREEN-MAP.md. Code still takes strings from 03 only.
- On compaction, preserve: modified files, last test output, open spec questions.
