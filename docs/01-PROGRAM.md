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

**Round** (472 B inkl. Diskriminator, im Test `account_sizes_are_pinned` festgenagelt): `round_id u32`, `terms_hash [u8;32]`, `version u8`, `kind u8` {0 ABOVE, 1 MOVE}, `source_kind u8` {1 = Preiskonto}, `feed_id [u8;32]`, `price_account Pubkey` (das eine Konto, aus dem gelesen werden darf), `offset_bps i32`, `max_conf_bps u16`, `window_secs u16` (W), `max_age_secs u16` (A), `commit_open i64`, `commit_close i64`, `outcome_time i64` (T), `reveal_close i64`, `resolve_deadline i64` (T+86 400), `status u8` {Open, Closed, Referenced, Resolved, Cancelled}, `outcome u8` {Unset, Yes, No}, `reference Reading`, `evidence Reading`, `threshold_mantissa i64` und `threshold_low_mantissa i64` (nur Anzeige; entschieden wird exakt, siehe `resolve`), `commit_count u32`, `reveal_count u32`, `histogram [u32;21]`, `reserved [u8;32]`, `bump`. Kein Fragetext on-chain — der Client erzeugt ihn aus Regel und Zahlen.

**Reading** (84 B, generisch statt Pyth-Namen): `price i64`, `conf u64`, `expo i32`, `publish_time i64`, `posted_slot u64` (Slot der Update-Transaktion — verknüpft den Wert mit genau einer Transaktion im Ledger), `submitted_slot u64`, `submitted_at i64` (Clock-Zeit der Einreichung), `submitter Pubkey`. Damit ist die Auswahl nicht verhindert, aber dauerhaft sichtbar: Aus dem Ledger lässt sich die Menge der zulässigen Werte rekonstruieren und neben den gewählten legen (HANDOFF 19.09.).

**Entry**: `round Pubkey`, `sgt_mint Pubkey`, `beneficiary Pubkey`, `rent_refund_to Pubkey`, `commitment [u8;32]`, `committed_at i64`, `revealed bool`, `p_bps u16`, `scored bool`, `scored_as_missing bool`, `score_bps u16`, `bump`.

**Player**: `sgt_mint`, `commits u32`, `reveals u32`, `missing_scored u32`, `score_sum u64`, `scored_rounds u32`, `bump`. Kein `missing`-Feld: Missing = commits − reveals − offene Einträge, vom Client abgeleitet (offene = Einträge in Runden, deren `reveal_close` noch nicht erreicht ist; das sind höchstens zwei).

Größen mit `#[derive(InitSpace)]` berechnen; nie schätzen.

## 3. Instruktionen

### `initialize(game_id, calendar_authority, pause_authority)` — nur `DEPLOY_AUTHORITY`
Legt `Config` an. Der Payer muss der Konstanten `DEPLOY_AUTHORITY` entsprechen, sonst wäre der Deploy-Tag ein Rennen: Wer zuerst `initialize` ruft, besäße Kalender- und Pause-Autorität dieser `game_id`. Ohne Cargo-Feature steht dort der Devnet-Testschlüssel; der Mainnet-Build läuft **nur** mit `--features mainnet`, und der schlägt fehl, solange der Offline-Schlüssel nicht eingetragen ist. Autoritäten werden in Settings der App und im Repo veröffentlicht.

### `publish_calendar(season, calendar_root, leaf_count)` — nur `calendar_authority`
- Zulässig nur wenn `calendar_root == [0;32]` (erste Saison) **oder** `next_round_id > max_round_id` (vorherige Saison vollständig). `1 ≤ leaf_count ≤ 64`, sonst Fehler (kein Unterlauf bei `leaf_count − 1`). Setzt `season`, `calendar_root`, `first_round_id = next_round_id`, `max_round_id = first_round_id + leaf_count − 1` (checked).

### `create_round(round_id, terms, merkle_proof)` — **permissionless** (jeder darf aufrufen, Payer zahlt die Round-Miete)
- Prüft `round_id == next_round_id ≤ max_round_id`, dann `RoundTerms::validate`: `version == 3`, `source_kind == 1`, `kind` ∈ {ABOVE, MOVE} (ABOVE: `offset_bps > −10 000`; MOVE: `0 < offset_bps < 10 000`), `max_conf_bps > 0`, `1 ≤ W, A ≤ 3 600`, `commit_open < commit_close` und `commit_close + W < outcome_time`. Setzt `reveal_close = outcome_time + 12 h`, `resolve_deadline = outcome_time + 24 h`.
- **`terms_hash` kanonisch (v3)**, Byte für Byte: `sha256("observed/terms/v3" ‖ season_u16_le ‖ round_id_u32_le ‖ version_u8 ‖ kind_u8 ‖ source_kind_u8 ‖ feed_id[32] ‖ price_account[32] ‖ offset_bps_i32_le ‖ max_conf_bps_u16_le ‖ window_secs_u16_le ‖ max_age_secs_u16_le ‖ commit_open_i64_le ‖ commit_close_i64_le ‖ outcome_time_i64_le)` — ohne Schwelle und ohne Text. Alles, was die Auswertung bestimmt, steht darin.
- Verifiziert `terms_hash` als Blatt an Index `round_id − first_round_id` unter `calendar_root`. Merkle mit Domänentrennung gegen Second-Preimage: `leaf = sha256(0x00 ‖ terms_hash)`, `node = sha256(0x01 ‖ left ‖ right)`; ungerade Ebenen werden mit sich selbst gepaart; der Beweis ist `Vec<[u8;32]>` und die Position wird aus den Bits des Index abgeleitet (kein frei wählbares Links/Rechts). Blatt-Tiefe fest: 64 Blätter (Tiefe 6), damit eine Saison die Kohorte **und** den gesamten Bewertungszeitraum bis zur Gewinnerbekanntgabe am 11. November abdeckt; unbenutzte Blätter = `sha256(0x00 ‖ [0;32])`. Gleichheit ist immer Nein — es gibt kein Feld dafür.
- Speichert Bedingungen. Ohne gültigen Beweis keine Runde — niemand, auch keine Autorität, kann eine Frage nachschieben.

### `set_reference(round)` — permissionless
Accounts: `round`, `price_update: Account<PriceUpdateV2>` mit `address = round.price_account`, `referencer (Signer)`. Owner = Pyth-Receiver des neuen Stacks (`rec2HH…`, SDK-Feature `pro-compatible`); Konten des alten Receivers (`rec5E…`) werden abgelehnt.
- **Regel O1 (DECISIONS 18./19.09.2026): die erste gültige Einreichung gewinnt.** Mit R = `commit_close` ist eine Einreichung gültig, wenn `R ≤ now ≤ R + W`, das Update `Full` ist, die Feed-ID stimmt, `now − publish_time ≤ A`, `price > 0` und `conf·10 000 / price ≤ max_conf_bps`. Fixiert wird, was in diesem Moment im benannten Konto steht. Ein Wert von kurz vor R ist zulässig, solange er nicht älter als A ist.
- Speichert die Lesung als `reference: Reading` (inkl. `posted_slot`, Einreichungs-Slot, Clock-Zeit, Einreicher), setzt `Referenced`. Anzeige-Schwellen `threshold_mantissa = ref × (10 000 + x) / 10 000`, bei MOVE zusätzlich `threshold_low_mantissa = ref × (10 000 − x) / 10 000` (Rundung zur Null, nur Anzeige).
- Zweiter Aufruf → `RoundNotOpen`, der erste Wert bleibt. Nach `R + W` → `OutsideSubmissionWindow`; dann ist `cancel_round` sofort möglich.
- Nicht verhindert, sondern sichtbar gemacht: Der erste Einreicher bestimmt den Messzeitpunkt innerhalb von W. Gemessene Spanne und Zahl der Tage, an denen das den Ausgang hätte drehen können: HANDOFF 18.09.; Belegtabelle je Runde folgt.

### `commit(round, commitment, sgt_mint)` — Signer = Spieler
Accounts: `player_wallet (Signer, payer)`, `sgt_mint`, `sgt_token_account`, `round`, `entry (init)`, `player (init_if_needed)`, `config`, `token_2022_program`, `system_program`.
Prüfungen (Konten-Prüfungen als Anchor-Constraints, keine `UncheckedAccount`, keine `remaining_accounts`). **Ausnahme SGT-Extension-Prüfung:** Sie darf als Guard im Handler laufen, wenn (a) alle Konten typisiert sind (`InterfaceAccount<Mint>`/`InterfaceAccount<TokenAccount>` mit `mint::token_program`/`token::token_program` = Token-2022, `token::mint`, `token::authority = player_wallet`, Seeds und Owner als Constraints), (b) sie eine einzige Funktion `verify_sgt(mint, token_account)` ist, die Mint-Authority, supply, decimals, amount, `TokenGroupMember.group` und `member.mint` prüft, und (c) sie der **erste Aufruf im Handler** ist, vor jeder Zustandsänderung (Zähler, Entry-Felder, Player). Grund: eigene Fehlercodes je Ablehnungsgrund (Spike 2).
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
- Missing (nicht aufgedeckt, Fenster zu): `score_bps = 10 000` (voller Fehlschlag, = `MISSING_SCORE_BPS`), `entry.scored_as_missing = true`, `Player.missing_scored += 1`. Niedriger darf der Wert nicht sein: Das Reveal-Fenster öffnet **nach** dem Ausgang, Schweigen ist also immer eine informierte Entscheidung (Review 18.09.2026).
- `Player.score_sum += score_bps`, `scored_rounds += 1`, `entry.scored = true`.
- Wer es aufruft: der Spieler selbst beim nächsten Commit (Client-Muster), sonst der Cron nach `reveal_close` für alle offenen Einträge der Runde (bounded: einer pro Aufruf, Cron iteriert).
- Kann vom Client direkt nach `reveal` in dieselbe Tx gelegt werden, wenn `Resolved` bereits gilt.

### `resolve(round)` — permissionless
Accounts: `round`, `price_update: Account<PriceUpdateV2>` mit `address = round.price_account` (Owner und Diskriminator prüft `Account`; nie `UncheckedAccount`), `resolver (Signer)`. Kein CPI.
- `round.status == Referenced` (ohne Referenz keine Auflösung). Dieselbe Regel O1 wie bei der Referenz, mit T = `outcome_time`: `T ≤ now ≤ T + W`, Alter ≤ A, `Full`, Feed, Preis > 0, Konfidenz.
- Outcome exakt, ohne Rundung: beide Preise auf den kleineren Exponenten skaliert (checked, nie abgeschnitten), dann ABOVE: `out·10 000 > ref·(10 000 + x)`; MOVE: `out·10 000 > ref·(10 000 + x)` **oder** `out·10 000 < ref·(10 000 − x)`. Beides strikt, Gleichheit = Nein. Wortlaut entsprechend: „more than x % above or below“, nie „at least“.
- Speichert `evidence: Reading`, setzt `Resolved`. Zweiter Aufruf → `NoReference` (Status ist nicht mehr `Referenced`), kein zweiter Effekt.

### `cancel_round(round)` — permissionless
- Möglich, sobald eine fehlende Lesung nicht mehr kommen kann: `Open` und `now > commit_close + W`, oder `Referenced` und `now > outcome_time + W`, oder spätestens `now ≥ resolve_deadline`. Nicht bei `Resolved`/`Cancelled`. → `Cancelled` (UI: „Nicht ausgewertet — Preisdaten fehlten“). Einträge bleiben, **niemand wird gescored — auch nicht als Missing**. Ausnutzbar ist die frühe Sichtbarkeit nicht: In einer annullierten Runde wird niemand gewertet, in einer aufgelösten kostet Schweigen 1,000; zu wissen, dass eine Runde annulliert ist, ändert keines von beidem. Erzwungen durch `score_entry`, das `Resolved` verlangt.

### `close_entry(round)` — Signer = `entry.rent_refund_to`
- Erst nach `now ≥ reveal_close` **und** (`Resolved && entry.scored` oder `Cancelled`). Bei `Resolved` reicht „nicht aufgedeckt“ **nicht** — sonst ließe sich der Eintrag vor dem Missing-Scoring schließen und die volle Missing-Strafe umgehen. Wer schließen will, ruft vorher selbst das permissionless `score_entry` (Missing-Fall) auf; der Client tut das automatisch in derselben Transaktion. Anchor `close = rent_refund_to`.

### `pause(flag)` — nur `pause_authority`
Blockiert nur `commit`.

### Autoritäten (Betrieb)
- `calendar_authority` und `pause_authority`: je ein Squads-Multisig (2-von-3, Hardware-Key + Seeker + Backup) — kein Einzel-Keypair auf einem Rechner. Für den Hackathon mindestens ein Hardware-Wallet, nie ein Keypair im Repo oder im Claude-Code-Arbeitsverzeichnis.
- Upgrade-Autorität: gleiches Multisig; jede Änderung mit öffentlicher Ankündigung (SECURITY.md) vor dem Deploy.
- **Verifiable Build**: `solana-verify build` + `solana-verify verify-from-repo`, damit die Jury on-chain Bytes gegen das Repo prüfen kann. Program-ID, Commit-Hash und Build-Hash in SECURITY.md.
- Resolver-Cron-Key: Hot Wallet mit Kleinstbetrag (nur Gebühren für Oracle-Posting + `resolve`), rotierbar, keine Autorität im Programm.

## 4. Client-Muster (keine eigene Instruktion)
Tägliche Transaktion des Spielers = `[reveal(R−1), score_entry(R−1) falls Resolved, commit(R)]`. Jede Instruktion bleibt einzeln aufrufbar (fehlender Salt, annullierte Vorrunde, Pause). `set_reference` und `resolve` inklusive Oracle-Posting sind **nicht** Teil dieser Transaktion — sie kosten mehrere Freigaben und laufen standardmäßig über den Cron; in der App optional als eigener Knopf.

**Compute-Budget explizit setzen**, nicht auf den Standard verlassen: gemessen `commit` 27 859 CU + `reveal` 15 023 CU ≈ 43 000 CU für die tägliche Transaktion (LiteSVM, ohne `score_entry`; mit `score_entry` ≈ 55 000). Client setzt `ComputeBudgetInstruction::set_compute_unit_limit` auf den gemessenen Wert + 20 % und dazu den Priority-Fee-Preis (02 §Transaktions-Landing).

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
| Oracle-Konto später überschrieben | Lesung liegt kopiert in `Round` (`Reading`), `posted_slot` zeigt auf die Update-Transaktion |

## 5b. Bedrohungsmodell

| Angreifer / Versuch | Abwehr (Zeile im Design) |
|---|---|
| Spieler antwortet spät mit Mehrwissen | Commit-Schluss 12 h vor T; Clock-Sysvar (§3 commit) |
| Spieler deckt nur Treffer auf | Missing kostet 10 000 = den schlechtesten aufdeckbaren Wert (§3 score_entry); damit ist Schweigen **nie billiger** als Aufdecken (Test `hiding_is_never_better_than_revealing`, `<=` gilt, bei 0 %/100 % auf der falschen Seite mit Gleichstand) |
| Spieler rät Commitment anderer (21 Werte) | 32-Byte-Salt, Domäne, Runde, Mint, Begünstigter im Hash (Spec §4) |
| Replay eines Commitments in anderer Runde/Gerät | round_pubkey + sgt_mint im Hash; Entry-PDA pro Runde und Mint |
| Mehrfachstimme durch SGT-Migration | Entry- und Player-PDA über die **Mint**, nicht die Wallet; Mint bleibt bei Migration gleich (Solana-Mobile-Doku, Spike 2); Altkonto mit 0 scheitert an `amount == 1` |
| Solana Mobile friert/verschiebt/schließt SGTs (Freeze-Authority, Permanent Delegate, Close-Authority = `GT2z…`) | außerhalb unserer Kontrolle, benannte Vertrauensannahme; offene Einträge hängen an der Mint, Reveal am Begünstigten und braucht keinen Tokenbesitz |
| Gefälschte SGT (kopierte Pointer/Authority) | echte `TokenGroupMember`-Extension, Gruppe + Mint-Authority als Konstanten (§3 commit) |
| Mehrere Geräte pro Person | akzeptiert, offen kommuniziert („ein Gerät, eine Antwort“) |
| Resolver wählt günstiges Update | **Nicht verhindert, sondern sichtbar gemacht (Regel O1):** Der erste gültige Einreicher bestimmt den Messzeitpunkt innerhalb von W = 60 s; zulässig ist jeder Wert im benannten Konto mit Alter ≤ A = 60 s. Gespeichert werden Wert, `posted_slot`, Einreichungs-Slot, Clock-Zeit und Einreicher; die zulässige Menge ist aus dem Ledger rekonstruierbar. Gemessen: Das Ergebnis hätte an 11–30 von 90 Tagen kippen können (HANDOFF 18.09.). Danach unveränderlich (§3 resolve) |
| Resolver liefert fremdes/gefälschtes Oracle-Konto | `address = round.price_account` aus den Bedingungen, `Account<PriceUpdateV2>`: Owner = Receiver des neuen Stacks, Diskriminator, `Full` |
| Zwei Resolver im selben Slot | erster gewinnt, zweiter scheitert am Status; kein doppelter Effekt |
| Resolve und Cancel gleichzeitig | disjunkte Zeitprädikate |
| Jemand schiebt Frage nach / ändert Regel | Merkle-Wurzel on-chain, index-gebundener Beweis, kanonischer `terms_hash`; `create_round` permissionless, es gibt keine Fragen-Autorität (§3) |
| Spätes Versiegeln mit Wissen über die Kursbewegung | Referenz wird frühestens bei Abgabeschluss gelesen. Mit A = 60 s kann der gelesene Wert bis zu 60 s **vor** Abgabeschluss veröffentlicht sein; wer in der letzten Minute versiegelt, kennt ihn im ungünstigsten Fall. Der Vorteil ist der Kurs der letzten Minute gegenüber 12 h bis zum Ergebnis — benannt, nicht verhindert (§3 set_reference) |
| Referenzposter wählt günstiges Update | wie „Resolver wählt günstiges Update“: Auswahl innerhalb von W sichtbar gemacht, nicht verhindert (§3 set_reference) |
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
Fixtures liegen als Account-Snapshots im Repo (`tests/fixtures/*.json`, Dumps ohne Schlüssel), damit jeder die Tests ohne Seeker ausführen kann. Fixtures: echte SGT (Mint und Gruppe als Mainnet-Snapshot; Token-Konto `frozen` mit Test-Owner — muss **angenommen** werden; altes Nullkonto nach Migration, falsche Wallet, falsches Programm, Fake-Mint mit kopierten Pointern ohne Gruppenmitgliedschaft, Fake-`TokenGroupMember` mit falscher Gruppe, falsche Mint-Authority, supply ≠ 1, decimals ≠ 0, `member.mint ≠ mint`, zweiter Entry mit derselben Mint); Pyth (für Referenz und Ergebnis getrennt): falscher Feed, `Partial`-Verifikation, fremder Owner, Update mit `prev_publish_time ≥ T`, Update außerhalb 60 s, Konfidenz zu groß, Preis ≤ 0, abweichender Exponent, `resolve` ohne Referenz (muss scheitern), Schwellenberechnung mit negativem Offset und Überlauf; `set_reference`: vor `commit_close` (muss scheitern), nicht erstes Update nach 12:00, Konfidenz > `max_conf_bps`, zweiter Aufruf, kein gültiges Update bis `resolve_deadline` → nur `cancel_round` möglich; Reveal: falscher Salt, falsches p, doppelt, außerhalb des Fensters, falscher Signer, Entry anderer Runde; Score: Entry/Player-Mismatch, Missing vor `reveal_close` (muss scheitern), Missing nach `reveal_close` (= 10 000), `score_entry` auf `Cancelled` (muss scheitern, `missing_scored` unverändert), `initialize` durch fremden Payer (muss scheitern); Kalender: Runde ohne Beweis, falscher Index, vertauschte Geschwister, `round_id > max_round_id`, zweites `publish_calendar` vor Saisonende, `leaf_count = 0` und `leaf_count = 65` (müssen scheitern), `publish_calendar` als erste Saison mit `calendar_root == 0`; Close: vor `reveal_close`; bei `Resolved` ohne `scored` (muss scheitern); Zeit: alle Fenstergrenzen ±1 s; Overflow-Fälle.

## 7. Spikes (Tag 1, in dieser Reihenfolge)
1. **Pyth:** mehrere Stunden altes Update via `@pythnetwork/pyth-solana-receiver` (`addPostPriceUpdates`, Full) posten, Minimalinstruktion konsumiert es; Tx-Zahl, Bytes, `unitsConsumed`, Fees, Rent notieren — für zwei Postings pro Tag (Referenz 12:00, Ergebnis 00:00), also die Tageskosten des Cron; zusätzlich: wie viele Wallet-Freigaben kostet ein Spieler, der selbst postet? Alle Ablehnfälle aus §6 prüfen.
2. **SGT:** eigenen Token dekodieren; Verifier gegen Fixtures; Migration simulieren, zweiter Eintrag muss scheitern. Erledigt 17.09. (docs/spikes/sgt.md): Mint bleibt bei Migration gleich (Solana-Mobile-Doku), Test `migrated_sgt_cannot_vote_twice_in_same_round` grün; SGT-Konten sind `frozen`.
3. **Seeker:** Tx mit `reveal + commit` über MWA; Freigaben zählen; App nach Broadcast killen, Preimage gegen `Entry` abgleichen; fehlender Salt, offenes Ergebnis, annullierte Vorrunde, Pause.
