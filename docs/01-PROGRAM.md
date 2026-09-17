# OBSERVED — Programm-Design v1 (Anchor)

Leitet sich aus `00-SPEC.md` ab. Alles, was hier steht, ist Umsetzung der Spec; bei Widerspruch gilt die Spec.

## 0. Annahmen, die Spike 1–3 bestätigen müssen

- Pyth Benchmarks liefert ein historisches Update mit `publish_time` im Fenster, das über `pyth-solana-receiver` mit `VerificationLevel::Full` postbar ist (Anzahl Tx, Compute, Kosten notieren). SKR/USD existiert als Pyth-Feed und publiziert nachts dicht genug für das 60-s-Fenster — sonst raus aus der Rotation.
- SGT ist Token-2022 mit `TokenGroupMember`; Gruppe `GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te`, Mint-Authority `GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4` (aus docs.solanamobile.com; im Spike gegen den echten Token prüfen).
- Seed Vault Wallet zeigt für eine Transaktion mit zwei Instruktionen **eine** Freigabe.

## 1. PDAs

| Account | Seeds | Zweck |
|---|---|---|
| `Config` | `["config", game_id]` | Autoritäten, Version, Pause-Flag, Rundenzähler |
| `Round` | `["round", config, round_id_le]` | eine Runde |
| `Entry` | `["entry", round, sgt_mint]` | genau ein Eintrag pro Gerät und Runde |
| `Player` | `["player", config, sgt_mint]` | kumulativer Verlauf pro Gerät |

## 2. Accounts (Felder)

**Config**: `version u8`, `calendar_authority Pubkey`, `pause_authority Pubkey`, `paused bool`, `next_round_id u32`, `season u16`, `calendar_root [u8;32]`, `first_round_id u32`, `max_round_id u32`, `bump`. (Upgrade-Autorität ist keine Config-Größe; sie ist die Programm-Autorität und wird als solche angezeigt.)

**Round**: `round_id u32`, `terms_hash [u8;32]` (Hash der maschinenlesbaren Bedingungen), `feed_id [u8;32]`, `offset_bps i32` (Schwelle = Referenz × (1 + offset/10 000); kann negativ sein), `max_conf_bps u16`, `commit_open i64`, `commit_close i64`, `outcome_time i64` (T), `reveal_close i64`, `resolve_deadline i64` (T+86 400), `status u8` {Open, Closed, Referenced, Resolved, Cancelled}, `outcome u8` {Unset, Yes, No}, `ref_price i64`, `ref_expo i32`, `ref_conf u64`, `ref_publish_time i64`, `ref_prev_publish_time i64`, `threshold_mantissa i64` (berechnet, gleicher Exponent wie ref), `referencer Pubkey`, `evidence_price i64`, `evidence_conf u64`, `evidence_publish_time i64`, `evidence_prev_publish_time i64`, `resolver Pubkey`, `commit_count u32`, `reveal_count u32`, `histogram [u32;21]`, `bump`. Kein Fragetext on-chain — der Client erzeugt ihn aus Regel und Zahlen.

**Entry**: `round Pubkey`, `sgt_mint Pubkey`, `beneficiary Pubkey`, `rent_refund_to Pubkey`, `commitment [u8;32]`, `committed_at i64`, `revealed bool`, `p_bps u16`, `scored bool`, `scored_as_missing bool`, `score_bps u16`, `bump`.

**Player**: `sgt_mint`, `commits u32`, `reveals u32`, `missing_scored u32`, `score_sum u64`, `scored_rounds u32`, `bump`. Kein `missing`-Feld: Missing = commits − reveals − offene Einträge, vom Client abgeleitet (offene = Einträge in Runden, deren `reveal_close` noch nicht erreicht ist; das sind höchstens zwei).

Größen mit `#[derive(InitSpace)]` berechnen; nie schätzen.

## 3. Instruktionen

### `initialize(game_id, calendar_authority, pause_authority)`
Legt `Config` an. Autoritäten werden in Settings der App und im Repo veröffentlicht.

### `publish_calendar(season, calendar_root, leaf_count)` — nur `calendar_authority`
- Zulässig nur wenn `calendar_root == [0;32]` (erste Saison) **oder** `next_round_id > max_round_id` (vorherige Saison vollständig). `1 ≤ leaf_count ≤ 64`, sonst Fehler (kein Unterlauf bei `leaf_count − 1`). Setzt `season`, `calendar_root`, `first_round_id = next_round_id`, `max_round_id = first_round_id + leaf_count − 1` (checked).

### `create_round(round_id, terms, merkle_proof)` — **permissionless** (jeder darf aufrufen, Payer zahlt die Round-Miete)
- Prüft `round_id == next_round_id ≤ max_round_id`, `commit_open < commit_close < outcome_time`, `reveal_close = outcome_time + 12 h`, `resolve_deadline = outcome_time + 24 h`.
- **`terms_hash` kanonisch**, Byte für Byte: `sha256("observed/terms/v2" ‖ season_u16_le ‖ round_id_u32_le ‖ feed_id[32] ‖ offset_bps_i32_le ‖ max_conf_bps_u16_le ‖ commit_open_i64_le ‖ commit_close_i64_le ‖ outcome_time_i64_le)` — ohne Schwelle und ohne Text.
- Verifiziert `terms_hash` als Blatt an Index `round_id − first_round_id` unter `calendar_root`. Merkle mit Domänentrennung gegen Second-Preimage: `leaf = sha256(0x00 ‖ terms_hash)`, `node = sha256(0x01 ‖ left ‖ right)`; ungerade Ebenen werden mit sich selbst gepaart; der Beweis ist `Vec<[u8;32]>` und die Position wird aus den Bits des Index abgeleitet (kein frei wählbares Links/Rechts). Blatt-Tiefe fest: 64 Blätter (Tiefe 6), damit eine Saison die Kohorte **und** den gesamten Bewertungszeitraum bis zur Gewinnerbekanntgabe am 11. November abdeckt; unbenutzte Blätter = `sha256(0x00 ‖ [0;32])`. Gleichheit ist immer Nein — es gibt kein Feld dafür.
- Speichert Bedingungen. Ohne gültigen Beweis keine Runde — niemand, auch keine Autorität, kann eine Frage nachschieben.

### `set_reference(round)` — permissionless
Accounts: `round`, `price_update: Account<PriceUpdateV2>`, `referencer (Signer)`.
- `round.status == Open`, `now ≥ commit_close`, `now < resolve_deadline`.
- Update: `feed_id` gleich, `Full`, `prev_publish_time < R ≤ publish_time ≤ R+60` mit R = `commit_close`, `price > 0`, Konfidenzregel (kein Ersatz durch späteres Update).
- `threshold_mantissa = ref_price × (10 000 + offset_bps) / 10 000` in i128, checked, gleicher Exponent; Rundung zur Null. Kopiert Referenzwerte, setzt `Referenced`, `referencer`. Das Oracle-Konto darf danach in derselben Tx-Folge geschlossen werden (Spike 1: Posten + `set_reference` + Close = 2 Transaktionen, 0 Miete netto).
- Zweiter Aufruf → Fehler. Ohne gültige Referenz bis `resolve_deadline` → `cancel_round`.

### `commit(round, commitment, sgt_mint)` — Signer = Spieler
Accounts: `player_wallet (Signer, payer)`, `sgt_mint`, `sgt_token_account`, `round`, `entry (init)`, `player (init_if_needed)`, `config`, `token_2022_program`, `system_program`.
Prüfungen (alle als Anchor-Constraints, keine `UncheckedAccount`, keine `remaining_accounts`):
1. `round` über Seeds an `config` gebunden; `!config.paused`; `round.status == Open`; `now ∈ [commit_open, commit_close)` (Clock-Sysvar).
2. `sgt_mint.owner == TOKEN_2022_PROGRAM_ID` (Konstante, nicht als Account übergeben) und `sgt_token_account.owner == TOKEN_2022_PROGRAM_ID`; Mint via `StateWithExtensions::<Mint>::unpack`; `TokenGroupMember` vorhanden, `member.group == GT22…`, `member.mint == sgt_mint`; `mint_authority == GT2z…`; `supply == 1`, `decimals == 0`. Adressen als `const` im Programm, gegen die Doku verifiziert.
3. Token-Account: `mint == sgt_mint`, `owner == player_wallet`, `amount == 1`; `delegate` und `state` werden **nicht** geprüft: echte SGT-Konten sind `frozen`, bewegt werden sie nur über den Permanent Delegate von Solana Mobile (Spike 2). Eine Prüfung auf `Initialized` würde jeden echten SGT ablehnen.
4. `Entry` mit `init` (PDA garantiert Einmaligkeit pro Mint und Runde). `beneficiary = player_wallet`, `rent_refund_to = player_wallet`, `round = round.key()`, `sgt_mint = sgt_mint.key()`.
5. `Player` mit `init_if_needed` **nur** mit Constraint `player.sgt_mint == sgt_mint.key()` (bei bereits existierendem Account) — sonst Reinit-Risiko; Seeds `["player", config, sgt_mint]`.
6. `Player.commits += 1`, `Round.commit_count += 1` (checked).
Kein Klartext, kein `p_bps` in dieser Instruktion. Die Zuordnung Wallet ↔ Gerät ist damit öffentlich; das steht in Spec §4.

### `reveal(round, p_bps, salt)` — Signer = `entry.beneficiary`
- Constraints: `entry.round == round.key()`, `has_one = beneficiary` (Signer), `player.sgt_mint == entry.sgt_mint`.
- `now ∈ [outcome_time, reveal_close)`, `!entry.revealed`, `p_bps ≤ 10 000`, `p_bps % 500 == 0`.
- Hash nach Spec neu berechnen und mit `commitment` vergleichen.
- Kein Catch-up-Sonderfall: außerhalb `[outcome_time, reveal_close)` gibt es keinen Reveal; damit ist beim Commit von R höchstens R−1 offen. Missing wird nicht gebucht, sondern abgeleitet.
- Setzt `revealed`, `p_bps`; `Round.reveal_count += 1`, `Round.histogram[p_bps/500] += 1`.
- Kein Scoring hier (Ergebnis kann noch fehlen).

### `score_entry(round)` — permissionless, idempotent
- Constraints: `entry.round == round.key()`, `player.sgt_mint == entry.sgt_mint`, `round` an `config` gebunden.
- `round.status == Resolved`, `!entry.scored`, und entweder `entry.revealed` **oder** `now ≥ reveal_close` (Missing-Fall).
- Aufgedeckt: `k = p_bps/500`, `y = outcome==Yes`, `score_bps = 25·(k−20y)²` in i32 rechnen.
- Missing (nicht aufgedeckt, Fenster zu): `score_bps = 2 500`, `entry.scored_as_missing = true`, `Player.missing_scored += 1`.
- `Player.score_sum += score_bps`, `scored_rounds += 1`, `entry.scored = true`.
- Wer es aufruft: der Spieler selbst beim nächsten Commit (Client-Muster), sonst der Cron nach `reveal_close` für alle offenen Einträge der Runde (bounded: einer pro Aufruf, Cron iteriert).
- Kann vom Client direkt nach `reveal` in dieselbe Tx gelegt werden, wenn `Resolved` bereits gilt.

### `resolve(round)` — permissionless
Accounts: `round`, `price_update: Account<PriceUpdateV2>` (Anchor prüft Owner = Pyth-Receiver-Programm-ID als Konstante und den Diskriminator; nie als `UncheckedAccount`), `resolver (Signer)`. Kein CPI in dieser Instruktion.
- `round.status == Referenced` (ohne Referenz keine Auflösung), `now ≥ outcome_time`, `now < resolve_deadline`.
- Update: `price_message.feed_id == round.feed_id`, `verification_level == Full`, `prev_publish_time < T ≤ publish_time ≤ T+60`, `price > 0`, `conf·10 000 / price ≤ max_conf_bps` (u128-Arithmetik; sonst Fehler; kein Ersatz durch späteres Update). `exponent` des Updates wird gegen `ref_expo` normiert; weichen sie ab, wird auf den kleineren Exponenten skaliert (checked) — nie abgeschnitten.
- Outcome: `price > threshold → Yes`; sonst `No` (Gleichheit = Nein; Mantisse/Exponent normieren, checked math).
- Kopiert Evidenzwerte, setzt `Resolved`, `resolver`. Zweiter Aufruf → Fehler `AlreadyResolved` (kein zweiter Effekt).

### `cancel_round(round)` — permissionless
- `now ≥ resolve_deadline`, `status ≠ Resolved` → `Cancelled` (UI: NO_RESOLVE). Einträge bleiben, kein Score. Ein Nicht-Reveal zählt trotzdem als Missing (Reveal-Fenster war 12 h vor dem Cancel zu; Absenz ist Absenz).

### `close_entry(round)` — Signer = `entry.rent_refund_to`
- Erst nach `now ≥ reveal_close` **und** (`Resolved && entry.scored` oder `Cancelled`). Bei `Resolved` reicht „nicht aufgedeckt“ **nicht** — sonst ließe sich der Eintrag vor dem Missing-Scoring schließen und die 0,250-Strafe umgehen. Wer schließen will, ruft vorher selbst das permissionless `score_entry` (Missing-Fall) auf; der Client tut das automatisch in derselben Transaktion. Anchor `close = rent_refund_to`.

### `pause(flag)` — nur `pause_authority`
Blockiert nur `commit`.

### Autoritäten (Betrieb)
- `calendar_authority` und `pause_authority`: je ein Squads-Multisig (2-von-3, Hardware-Key + Seeker + Backup) — kein Einzel-Keypair auf einem Rechner. Für den Hackathon mindestens ein Hardware-Wallet, nie ein Keypair im Repo oder im Claude-Code-Arbeitsverzeichnis.
- Upgrade-Autorität: gleiches Multisig; jede Änderung mit öffentlicher Ankündigung (SECURITY.md) vor dem Deploy.
- **Verifiable Build**: `solana-verify build` + `solana-verify verify-from-repo`, damit die Jury on-chain Bytes gegen das Repo prüfen kann. Program-ID, Commit-Hash und Build-Hash in SECURITY.md.
- Resolver-Cron-Key: Hot Wallet mit Kleinstbetrag (nur Gebühren für Oracle-Posting + `resolve`), rotierbar, keine Autorität im Programm.

## 4. Client-Muster (keine eigene Instruktion)
Tägliche Transaktion des Spielers = `[reveal(R−1), score_entry(R−1) falls Resolved, commit(R)]`. Jede Instruktion bleibt einzeln aufrufbar (fehlender Salt, annullierte Vorrunde, Pause). `set_reference` und `resolve` inklusive Oracle-Posting sind **nicht** Teil dieser Transaktion — sie kosten mehrere Freigaben und laufen standardmäßig über den Cron; in der App optional als eigener Knopf.

Reihenfolge im Client, festgezogen:
1. Salt erzeugen, Commitment rechnen, Reveal-Datensatz `{round, p_bps, salt, commitment, status: pending}` verschlüsselt persistieren.
2. Wallet-Anfrage (MWA `signAndSendTransactions`).
3. Ergebnis: `confirmed` → Datensatz `status: committed` + Signatur. `timeout/unknown` → **nicht** neu versiegeln; `Entry`-PDA lesen: existiert mit gleichem Commitment → `committed`; existiert nicht → `failed`, Datensatz behalten, erneut anbieten.
4. Ohne lokalen Datensatz zu einem existierenden `Entry` → „This answer can't be revealed. It will count as missing.“

## 5. Fehlermatrix

| Fall | Verhalten |
|---|---|
| Ergebnis fehlt zur Aufdeckfrist | `reveal` speichert p, `score_entry` später |
| Keine Evidenz bis Deadline | `cancel_round` → NO_RESOLVE sichtbar |
| Resolve/Cancel-Rennen | disjunkte Zeitprädikate: resolve `< deadline`, cancel `≥ deadline` |
| Doppelter Resolve | Fehler, erster Ausgang bleibt |
| Doppelter Reveal/Score | Fehler über Flags |
| Konfidenz zu groß beim ersten Update | Fehler; Runde läuft in Cancel, wenn kein gültiges erstes Update existiert |
| Pause | nur Commit blockiert |
| SGT migriert | Entry-PDA über Mint; Reveal über `beneficiary`, kein Tokenbesitz nötig |
| Nächste Runde fehlt | Reveal-only-Pfad im Client |
| Oracle-Konto später überschrieben | Evidenz liegt kopiert in `Round` |

## 5b. Bedrohungsmodell

| Angreifer / Versuch | Abwehr (Zeile im Design) |
|---|---|
| Spieler antwortet spät mit Mehrwissen | Commit-Schluss 12 h vor T; Clock-Sysvar (§3 commit) |
| Spieler deckt nur Treffer auf | Missing wird als 2 500 (= 50 %) gescored, Anzeige immer inklusive Missing (§3 score_entry, Spec §6); Verschweigen ist nie besser als ehrliche Unsicherheit |
| Spieler rät Commitment anderer (21 Werte) | 32-Byte-Salt, Domäne, Runde, Mint, Begünstigter im Hash (Spec §4) |
| Replay eines Commitments in anderer Runde/Gerät | round_pubkey + sgt_mint im Hash; Entry-PDA pro Runde und Mint |
| Mehrfachstimme durch SGT-Migration | Entry- und Player-PDA über die **Mint**, nicht die Wallet; Mint bleibt bei Migration gleich (Solana-Mobile-Doku, Spike 2); Altkonto mit 0 scheitert an `amount == 1` |
| Solana Mobile friert/verschiebt/schließt SGTs (Freeze-Authority, Permanent Delegate, Close-Authority = `GT2z…`) | außerhalb unserer Kontrolle, benannte Vertrauensannahme; offene Einträge hängen an der Mint, Reveal am Begünstigten und braucht keinen Tokenbesitz |
| Gefälschte SGT (kopierte Pointer/Authority) | echte `TokenGroupMember`-Extension, Gruppe + Mint-Authority als Konstanten (§3 commit) |
| Mehrere Geräte pro Person | akzeptiert, offen kommuniziert („ein Gerät, eine Antwort“) |
| Resolver wählt günstiges Update | eindeutiges erstes Update (`prev_publish_time < T`), Full-Verifikation, Feed-ID, Konfidenzregel ohne Ersatz (§3 resolve) |
| Resolver liefert fremdes/gefälschtes Oracle-Konto | `Account<PriceUpdateV2>`, Owner = Receiver-Programm, Diskriminator |
| Zwei Resolver im selben Slot | erster gewinnt, zweiter `AlreadyResolved`; kein doppelter Effekt |
| Resolve und Cancel gleichzeitig | disjunkte Zeitprädikate |
| Jemand schiebt Frage nach / ändert Regel | Merkle-Wurzel on-chain, index-gebundener Beweis, kanonischer `terms_hash`; `create_round` permissionless, es gibt keine Fragen-Autorität (§3) |
| Spätes Versiegeln mit Wissen über die Kursbewegung | Referenzpreis = erstes Update **nach** Abgabeschluss; beim Versiegeln kennt ihn niemand (§3 set_reference) |
| Referenzposter wählt günstiges Update | eindeutiges erstes Update nach R, Full, Feed, Konfidenz ohne Ersatz (§3 set_reference) |
| Kalender-Autorität setzt falsche Regeln | einmal pro Saison, vor der ersten Runde, veröffentlicht in CALENDAR.md; Regeln ohne Zahlen sind vorab prüfbar |
| Pause-Autorität will Reveals verhindern | `pause` blockiert nur `commit` |
| Autoritäts-Key gestohlen | Multisig, Hardware, keine Keys im Repo; Upgrade nur mit Ankündigung |
| Programm-Upgrade ändert Regeln still | Verifiable Build, SECURITY.md, veröffentlichte Autoritäten (Vertrauensannahme benannt) |
| Client-Salt gestohlen (Root/Backup) | Keystore-verschlüsselt, Backup ausgeschlossen; Schaden = eine Antwort früher sichtbar, kein Geld |
| Entry vorzeitig geschlossen und neu angelegt | `close_entry` erst nach `reveal_close` |
| Entry vor dem Missing-Scoring geschlossen (Strafe umgehen) | `close_entry` bei `Resolved` nur wenn `scored`; Missing-Scoring ist permissionless und Teil der Close-Transaktion |
| Reinit von `Player` mit fremder Mint | `init_if_needed` mit Mint-Constraint |
| Integer-Overflow (Score, Zähler, Preis) | checked math, u128 für Konfidenzquote, i32/i64 für Brier |
| Clock-Drift des Leaders (±Sekunden) | Fenster in Stunden; Pyth-Fenster nutzt `publish_time`, nicht die Chain-Uhr |
| Proxy/Cron-Ausfall | Posten braucht Pyth-Zugang (API-Key, seit 26.08.2026); jeder mit Zugang kann posten, das Programm prüft die Evidenz unabhängig vom Poster; postet niemand rechtzeitig, endet die Runde in NO_RESOLVE — nie improvisiert |
| Spam-Commits | jeder Commit braucht ein SGT + Miete |
| Deanonymisierung | Wallet ↔ Gerät ist on-chain öffentlich — Spec §4 sagt es; Salt schützt nur den Wert bis zum Reveal |

Nicht abgedeckt, bewusst: Kollusion mehrerer Geräte, Automatisierung der Antworten (kein Einsatz, kein Anreiz), Verkauf des Geräts (Player-Verlauf wandert mit dem Gerät — Spec §4).

## 5c. Abnahmekriterien (Claude Code schließt selbst)
Eine Instruktion ist fertig, wenn ihre Positivfälle **und** alle sie betreffenden Zeilen aus §5b/§6 als Anchor-Tests grün sind, `cargo clippy -- -D warnings` leer ist, und der Reviewer-Subagent keine Lücke gegen dieses Dokument meldet.

## 6. Tests (Pflicht vor Mainnet)
Fixtures liegen als Account-Snapshots im Repo (`tests/fixtures/*.json`, Dumps ohne Schlüssel), damit jeder die Tests ohne Seeker ausführen kann. Fixtures: echte SGT (Mint und Gruppe als Mainnet-Snapshot; Token-Konto `frozen` mit Test-Owner — muss **angenommen** werden; altes Nullkonto nach Migration, falsche Wallet, falsches Programm, Fake-Mint mit kopierten Pointern ohne Gruppenmitgliedschaft, Fake-`TokenGroupMember` mit falscher Gruppe, falsche Mint-Authority, supply ≠ 1, decimals ≠ 0, `member.mint ≠ mint`, zweiter Entry mit derselben Mint); Pyth (für Referenz und Ergebnis getrennt): falscher Feed, `Partial`-Verifikation, fremder Owner, Update mit `prev_publish_time ≥ T`, Update außerhalb 60 s, Konfidenz zu groß, Preis ≤ 0, abweichender Exponent, `resolve` ohne Referenz (muss scheitern), Schwellenberechnung mit negativem Offset und Überlauf; `set_reference`: vor `commit_close` (muss scheitern), nicht erstes Update nach 12:00, Konfidenz > `max_conf_bps`, zweiter Aufruf, kein gültiges Update bis `resolve_deadline` → nur `cancel_round` möglich; Reveal: falscher Salt, falsches p, doppelt, außerhalb des Fensters, falscher Signer, Entry anderer Runde; Score: Entry/Player-Mismatch, Missing vor `reveal_close` (muss scheitern), Missing nach `reveal_close` (= 2 500); Kalender: Runde ohne Beweis, falscher Index, vertauschte Geschwister, `round_id > max_round_id`, zweites `publish_calendar` vor Saisonende, `leaf_count = 0` und `leaf_count = 65` (müssen scheitern), `publish_calendar` als erste Saison mit `calendar_root == 0`; Close: vor `reveal_close`; bei `Resolved` ohne `scored` (muss scheitern); Zeit: alle Fenstergrenzen ±1 s; Overflow-Fälle.

## 7. Spikes (Tag 1, in dieser Reihenfolge)
1. **Pyth:** mehrere Stunden altes Update via `@pythnetwork/pyth-solana-receiver` (`addPostPriceUpdates`, Full) posten, Minimalinstruktion konsumiert es; Tx-Zahl, Bytes, `unitsConsumed`, Fees, Rent notieren — für zwei Postings pro Tag (Referenz 12:00, Ergebnis 00:00), also die Tageskosten des Cron; zusätzlich: wie viele Wallet-Freigaben kostet ein Spieler, der selbst postet? Alle Ablehnfälle aus §6 prüfen.
2. **SGT:** eigenen Token dekodieren; Verifier gegen Fixtures; Migration simulieren, zweiter Eintrag muss scheitern. Bleibt die Mint bei einer Migration gleich? Solange nicht bestätigt, ist die Bedrohungsmodell-Zeile „Mehrfachstimme durch SGT-Migration“ offen.
3. **Seeker:** Tx mit `reveal + commit` über MWA; Freigaben zählen; App nach Broadcast killen, Preimage gegen `Entry` abgleichen; fehlender Salt, offenes Ergebnis, annullierte Vorrunde, Pause.
