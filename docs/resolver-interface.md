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
Er hat **keine Befugnis im Programm**. Sein Schlüssel zahlt nur Gebühren und wird als
`referencer`/`resolver` protokolliert. Jede Instruktion, die er aufruft, ist permissionless;
das Programm prüft die Evidenz, nicht den Absender.

| Instruktion | Wann fällig | Vorbedingung im Programm |
|---|---|---|
| `set_reference(round)` | ab `commit_close`, bis `resolve_deadline` | Round `Open`; Pyth-Update mit `prev_publish_time < commit_close ≤ publish_time ≤ commit_close + 60 s`, Full, Feed, Konfidenz ≤ `max_conf_bps` |
| `resolve(round)` | ab `outcome_time`, bis `resolve_deadline` | Round `Referenced`; Pyth-Update analog zu `outcome_time` |
| `cancel_round(round)` | ab `resolve_deadline` | Round nicht `Resolved`/`Cancelled` |
| `score_entry(round, entry)` | aufgedeckt: ab `resolve`; Missing: ab `reveal_close` | Round `Resolved`, Entry nicht gescored |

Die Zeitpunkte stehen in jeder Runde (`commit_open`, `commit_close`, `outcome_time`,
`reveal_close`, `resolve_deadline`) und kommen aus dem Kalender (CALENDAR.md). Der Resolver
kennt keine festen Uhrzeiten: Ein Lauf pro Stunde liest den Zustand und erledigt, was fällig ist.

**Nicht** Aufgabe des Resolvers: `create_round` (alle Runden der Saison werden zu Beginn vom
Owner angelegt), `publish_calendar`, `pause`, Programm-Upgrade.

## Was der Resolver vom Programm voraussetzt
Diese Werte sind im Resolver hart kodiert. Ändert sich eins davon im Programm, muss der
Resolver nachziehen:
- Programm-ID `48YybyMgkdzPQN5R3V1xsFHkUMxDvBDBDwW48cRTx2ni` (Devnet-/Test-Build; die
  Mainnet-ID wird beim Deploy eingetragen).
- Diskriminatoren von `set_reference`, `resolve`, `score_entry`, `cancel_round` und der
  Konten `Round`, `Entry` (aus `target/idl/observed.json`).
- Byte-Layout von `Round` und `Entry`. Das `Entry`-Layout ist über eine Fixture abgesichert:
  Der Rust-Test `entry_layout_fixture` schreibt `tests/fixtures/generated/entry-layout.json`;
  eine Kopie liegt im Resolver unter `test/fixtures/`, und `npm test` prüft jedes Feld dagegen.
  **Nach jeder Änderung an `Entry` die Datei neu erzeugen und in den Resolver kopieren.**
- Seeds: `config` = `["config", game_id_le]`, `round` = `["round", config, round_id_le]`,
  `player` = `["player", config, sgt_mint]`.

Da das Programm ab dem 08.10. eingefroren ist, sind diese Werte ab dann stabil.
