# Resolver — Schnittstelle zum Programm

Der Resolver (Cloudflare Worker) liegt **nicht** in diesem Repository, sondern in
`observedsol-blip/observed-resolver`.

## Warum getrennt
Nach der Einreichung am 08.10.2026 ist dieses Repository eingefroren: Bis zur Bekanntgabe
am 10.11.2026 wird hier nichts mehr geändert (Regel des Hackathons). Der Resolver muss in
dieser Zeit aber betrieben und notfalls repariert werden können — ein Pyth-Schlüssel läuft
ab, ein RPC-Anbieter ändert Limits, ein Bug zeigt sich erst unter Last. Deshalb lebt der
Dienst in einem eigenen Repository. Änderungen dort berühren den eingereichten Stand nicht:
Programm, App und Dokumente bleiben unter dem Einreichungs-Tag unverändert.

Der eingereichte Stand ist der Git-Tag **`submission-2026-10-08`** in diesem Repository
(gesetzt am Tag der Einreichung, siehe docs/05-LAUNCH-PLAN.md).

## Was der Resolver tut — und was nicht
Er hat **keine Befugnis im Programm**. Sein Schlüssel zahlt nur Gebühren und steht als
`submitter` in der jeweiligen Lesung. Jede Instruktion, die er aufruft, ist permissionless;
das Programm prüft die Lesung, nicht den Absender. **Er postet nichts:** Er übergibt nur das
in der Runde benannte, von Pyth gesponserte Konto (`round.price_account`). Kein Hermes, kein
Schlüssel, keine Pyth-Kosten.

| Instruktion | Wann fällig | Vorbedingung im Programm |
|---|---|---|
| `set_reference(round)` | **nur** in [`reference_time`, `reference_time` + W], W = 60 s (Saison 1: 04:02–04:03 UTC) | Round `Open`; Konto = `round.price_account`, Owner `rec2HH…`, `Full`, Feed, Alter ≤ A = 60 s, Konfidenz ≤ `max_conf_bps` |
| `resolve(round)` | **nur** in [`outcome_time`, `outcome_time` + W] | Round `Referenced`; dieselbe Regel |
| `cancel_round(round)` | sobald ein Fenster ohne Lesung abgelaufen ist (spätestens `resolve_deadline`) | Round nicht `Resolved`/`Cancelled` |
| `score_entry(round, entry)` | aufgedeckt: ab `resolve`; Missing: ab `reveal_close` | Round `Resolved`, Entry nicht gescored |

Die Zeitpunkte stehen in jeder Runde und kommen aus dem Kalender (CALENDAR.md). Weil die
Lesungen nur 60 s lang möglich sind, reicht der stündliche Lauf dafür **nicht**: Ein zweiter
Cron (`1 4 * * *` und `59 15 * * *`) wartet bis `reference_time` bzw. `outcome_time` und sendet dann innerhalb
von W mit bis zu drei Versuchen. Fällt dieser Lauf aus, ist die Runde NO_RESOLVE; der
stündliche Lauf erledigt danach `cancel_round` und das Scoring.

**Nicht** Aufgabe des Resolvers: `create_round` (alle Runden der Saison werden zu Beginn vom
Owner angelegt), `publish_calendar`, `pause`, Programm-Upgrade.

## Was der Resolver vom Programm voraussetzt
Diese Werte sind im Resolver hart kodiert. Ändert sich eins davon im Programm, muss der
Resolver nachziehen:
- Programm-ID `48YybyMgkdzPQN5R3V1xsFHkUMxDvBDBDwW48cRTx2ni` (Devnet-/Test-Build; die
  Mainnet-ID wird beim Deploy eingetragen).
- Diskriminatoren von `set_reference`, `resolve`, `score_entry`, `cancel_round` und der
  Konten `Round`, `Entry` (aus `target/idl/observed.json`).
- Byte-Layout von `Round` (486 B seit Terms v3 mit `reference_time`, `band_bps` und `outcome_margin_bps`) und `Entry` (184 B, unverändert).
  Beide Größen sind im Test `account_sizes_are_pinned` festgenagelt. Das `Entry`-Layout ist über eine Fixture abgesichert:
  Der Rust-Test `entry_layout_fixture` schreibt `tests/fixtures/generated/entry-layout.json`;
  eine Kopie liegt im Resolver unter `test/fixtures/`, und `npm test` prüft jedes Feld dagegen.
  **Nach jeder Änderung an `Entry` die Datei neu erzeugen und in den Resolver kopieren.**
- Seeds: `config` = `["config", game_id_le]`, `round` = `["round", config, round_id_le]`,
  `player` = `["player", config, sgt_mint]`.

Da das Programm ab dem 08.10. eingefroren ist, sind diese Werte ab dann stabil.
