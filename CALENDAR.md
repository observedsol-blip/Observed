# Calendar (season 1)

Generation rules (frozen before season start):
- Feeds: SOL/USD, BTC/USD, ETH/USD, SKR/USD (only if Spike 1 confirms night-time coverage) — rotation defined below.
- Threshold = reference price (last Pyth update before 00:00 UTC on the question day) +/- x %, x from the fixed list [0.5, 1.0, 1.5, 2.0] rotating; equality resolves No.
- Windows per round: commit 00:00-12:00 UTC, outcome 24:00 UTC, reveal until 12:00 UTC next day, resolve deadline outcome + 24 h.
- Season length: 64 leaves (Merkle depth 6); unused leaves = sha256(0x00 || [0;32]).

Canonical terms blob per round (must match docs/01-PROGRAM.md `terms_hash` byte layout) — one line per round, appended at publish time:

| round | date (UTC) | feed | threshold | terms_hash |
|---|---|---|---|---|
| 0 | | | | |

**Merkle root (= Config.calendar_root):** _filled at publish_
**publish_calendar tx:** _signature_
