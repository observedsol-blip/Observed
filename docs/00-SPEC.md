# OBSERVED — Spec v1 (eingefroren 17.09.2026)

Dieses Dokument ist die Quelle. Programm-Design, Design Bible, Screen-Map und Pitch verweisen hierauf. Änderungen nur mit Datum und Grund am Ende.

## 1. Der eine Satz

Eine Frage am Tag, eine Wahrscheinlichkeit, eine Seed-Vault-Freigabe — und über Wochen der Beweis, ob deine Sicherheit stimmt.

## 2. Das Produkt in fünf Sätzen

Jeden Tag stellt Observed eine binäre Frage, die ein Preis-Feed am Ende des Tages beantwortet. Du antwortest nicht mit Ja/Nein, sondern mit deiner Sicherheit (0–100 %). Die Antwort wird versiegelt (Hash on-chain), morgen deckst du sie in derselben Transaktion auf, in der du die neue versiegelst. Mittags siehst du, was passiert ist, wie die Menge geschätzt hat und wie sich dein Brier-Score bewegt. Ein physisches Seeker, ein Eintrag pro Tag; kein Einsatz, keine App-Gebühr, kein Preis.

## 3. Die Schleife (alle Zeiten UTC, im UI immer mit lokaler Zeit daneben)

| Phase | Runde R | Regel |
|---|---|---|
| Offen | 00:00–12:00 | `commit` erlaubt. Regel, Feed, Offset und Fenster sind bereits eingefroren; die Schwelle entsteht um 12:00. |
| Referenz | 12:00 (= Abgabeschluss) | Der Referenzpreis ist das erste gültige Feed-Update nach 12:00 UTC. Er ist beim Versiegeln **niemandem** bekannt — früh und spät Versiegelnde wissen gleich viel. Die konkrete Schwelle (Referenz ± x %) erscheint erst nach Schluss. |
| Geschlossen | 12:00–24:00 | keine Commits. |
| Ereignis | T = 24:00 | Ergebnis = erstes gültiges Feed-Update nach T, verglichen mit der Schwelle aus der Referenz. |
| Auflösbar | ab T | `resolve` permissionless; Programm prüft Evidenz. Später ausgeführt = gleiches Ergebnis. |
| Aufdecken | 00:00–12:00 (Folgetag) | `reveal` für R, parallel zu `commit` für R+1 — beides in EINER Transaktion, eine Seed-Vault-Freigabe (Annahme; Spike 3 ist Blocker — zeigt das Wallet zwei Sheets, wird die Copy zweizeilig, nicht das Produkt zweiteilig). |
| Ausgang sichtbar | ab `resolve` (≈ 00:05) | Result zeigt Ausgang und die bis dahin aufgedeckte Teilmenge („63 of 71 revealed · closes 12:00 UTC“). |
| Menge vollständig | 12:00 (Folgetag) | Verteilung nach Aufdeckfrist final. Push „Yesterday is in“. |
| NO_RESOLVE | T + 24 h ohne gültige Evidenz | Programmstatus `Cancelled`, UI-Name NO_RESOLVE. Niemand gescored, sichtbar im UI. |

R+1 startet unabhängig vom Status von R.

## 4. Eingabe und Identität

- Antwort = P(Yes) in 0–100, Schritte von 5 → 21 Buckets. Gespeichert als `p_bps` (0…10 000, `% 500 == 0`). Kein Yes/No-Umschalter; es gibt nur „chance this is Yes“.
- Ein Eintrag pro physischem Seeker: `Entry`-PDA aus `[round, sgt_mint]`. Eligibility beim Commit (Token-2022-Gruppenmitgliedschaft, Owner = Signer, Betrag 1). Begünstigter wird beim Commit eingefroren; Reveal braucht keinen fortdauernden Tokenbesitz (Migration des SGT zwischen eigenen Wallets ändert nichts). Wird das Gerät verkauft, bleibt die offene Antwort beim Verkäufer („The answer belongs to the wallet that sealed it.“, steht in Settings); der Verlauf (`Player`) hängt am Gerät und wandert mit.
- Öffentlich per Design: Wallet ↔ Genesis-Mint, Commits, Reveals und Werte sind on-chain lesbar. Privat ist nur der Wert bis zum Aufdecken. Das steht im Onboarding in einem Satz.
- Commitment: `sha256("observed/commit/v1" ‖ program_id ‖ round_pubkey ‖ terms_hash ‖ sgt_mint ‖ beneficiary ‖ p_bps_u16_le ‖ salt_32)`. Salt aus SecureRandom, lokal AES-GCM mit Keystore-Schlüssel, **vor** der Wallet-Anfrage persistiert, vom Auto-Backup ausgeschlossen. Onboarding sagt: Neuinstallation kann eine offene Antwort verfallen lassen.

## 5. Evidenz und Auflösung

- Quelle v1: Pyth Pull-Oracle, historische Updates über Pyth Benchmarks (eigener Proxy mit API-Key; Proxy ist keine exklusive Voraussetzung — jeder kann Evidenz posten).
- Zwei Updates pro Runde, beide nach derselben Regel „erstes Update nach dem Zeitpunkt“: die **Referenz** nach 12:00 UTC (`prev_publish_time < R ≤ publish_time ≤ R + 60 s`) und das **Ergebnis** nach T = 24:00 UTC (`prev_publish_time < T ≤ publish_time ≤ T + 60 s`). Beide `VerificationLevel::Full`, Feed-ID und Konfidenzregel pro Runde eingefroren. Die Schwelle rechnet das Programm aus der Referenz: `threshold = ref_price × (1 + offset_bps / 10 000)`, checked. Ein wegen Konfidenz verworfenes erstes Update darf nicht durch ein späteres ersetzt werden; fehlt ein gültiges Referenz- oder Ergebnis-Update im Fenster, endet die Runde in NO_RESOLVE.
- Oracle-Posting ist eine eigene (gesponserte) Transaktion; `resolve` konsumiert das verifizierte Konto. Ergebniswerte werden in `Round` kopiert.
- Wer postet: standardmäßig der Cron (12:05 und 00:05 UTC). Ein vollständig verifiziertes Pyth-Posting sind mehrere Transaktionen und Freigaben — deshalb ist das Auflösen in der App ein **optionaler** Knopf für den, der es will, nicht Teil der täglichen Geste. Der Poster **liefert** Evidenz, er **bestimmt** nichts. UI-Text: „This phone posted the oracle reading.“

## 6. Score

- Brier pro Runde, exakt: `k = p_bps / 500`, `score_bps = 25 · (k − 20·y)²` (0 = perfekt, 2 500 = immer 50 %, 10 000 = maximal falsch).
- Verlauf: `score_sum`, `scored_rounds` (kumulativ; kein „gleitend“ in v1). Baselines: immer-50 %, Menge.
- Missing = Commits − Reveals − offene (Fenster noch nicht zu). On-chain werden nur `commits` und `reveals` gezählt; Missing wird abgeleitet, nie separat gebucht — damit kann es nicht veralten. Record zeigt immer drei Zahlen: Commits / Reveals / Missing. Ein Nicht-Reveal in einer annullierten Runde zählt ebenfalls als Missing (keine Ausnahmen).
- **Missing kostet.** Jeder Missing Reveal in einer aufgelösten Runde geht mit 0,250 (der Immer-50-%-Wert) in den Verlauf ein, gekennzeichnet als „missing, scored as 50 %“. Verschweigen einer Niederlage ist damit nie besser als ehrliche Unsicherheit — selektives Aufdecken lohnt sich nicht. Der angezeigte Brier ist immer der inklusive Missing; ein Wert „nur aufgedeckte“ wird nirgends gezeigt. In annullierten Runden: kein Score, Missing zählt nur als Zahl.
- Catch-up ergibt sich aus den Fenstern: Nur R−1 ist beim Commit von R noch aufdeckbar; alles Ältere ist mit Fensterschluss Missing. Es gibt keinen Reveal außerhalb des Fensters.
- Anzeige: `score_bps` 0…10 000 = 10 000·(p−y)²; UI zeigt `score_bps / 10 000` mit drei Nachkommastellen (0.160). Record zeigt den neuen Stand, keine Pfeile.
- Kalibrierungskurve erst ab 21 **aufgedeckten** Runden (vorher Text, kein leeres Chart). Missing zählt im Record (als 0,250), aber nicht in der Kurve — ein künstlicher 50er sagt nichts über Kalibrierung.

## 7. Fragen

- Nur binär, nur per Feed auflösbar (SOL/USD, SKR/USD, BTC/USD, ETH/USD via Pyth). Keine Fragen ohne Feed in v1.
- Ein Kalenderblatt enthält **nur die Regel**, keine Zahl: Feed, Offset in Basispunkten (z. B. +100 = „mehr als 1 % über der Referenz“, kann negativ sein), Fenster, Konfidenzgrenze. Die Schwelle entsteht erst um 12:00 aus dem Referenzpreis. Der Fragetext wird im Client aus Regel und Zahlen erzeugt und ist nicht Teil des Hashes. Die Rundenregeln einer Saison (bis zu 64) werden kanonisch serialisiert (siehe 01, `terms_hash`), ihre Merkle-Wurzel wird **on-chain** in `Config.calendar_root` gesetzt (einmal pro Saison, vor der ersten Runde); `create_round` ist damit **permissionless** — jeder kann eine Runde anlegen, aber nur mit gültigem Beweis. Es gibt keine Fragen-Autorität mehr; die einzige verbleibende Annahme ist die Kalender-Autorität, die einmal pro Saison die Wurzel setzt. Dieselben Blobs stehen in `CALENDAR.md`.
- Gleichheit = Nein (im Programm erzwungen). Offsets aus einer fest rotierenden Liste, Feed-Rotation; beides steht im Kalender.
- Feeds nur, wenn sie bei Pyth existieren und nachts liquide genug sind (SKR/USD in Spike 1 prüfen; sonst aus der Rotation). Akzeptierte NO_RESOLVE-Rate: ≤ 1 Tag in 30; darüber ist die Konfidenzregel oder der Feed falsch, nicht die Nacht.
- Keine nachträglich eingefügte Frage — technisch unmöglich, nicht nur versprochen. Keine Meta-Frage. Kein Sponsor.
- Formulierungsregel: Vor 12:00 lautet die Frage relativ („Will SOL be more than 1% above its 12:00 UTC price at 00:00 UTC?“), nach 12:00 zeigt der Client zusätzlich die Zahl („above $151.50 · 12:00 reference $150.00“). Immer „above“ / „below“ (strikt), nie „at or above“ — Gleichheit ergibt Nein.
- Muskelgedächtnis-Test: Wenn 90 % der Menge dieselbe Antwort gibt, war die Frage schlecht — Offsets so wählen, dass 40–60 % erwartbar sind.

## 8. Ehrlichkeitsregeln (nicht verhandelbar)

1. Missing Reveals sind sichtbar; ein Record ohne Missing-Zahl wird nirgends gezeigt.
2. NO_RESOLVE ist ein Zustand, kein Fehler: sichtbar im Widget und Result, nie improvisiert.
3. Upgradefähige Beta mit veröffentlichten Autoritäten (calendar und pause in `Config`; upgrade als Programm-Autorität — in Settings so benannt). Die Kalender-Autorität handelt einmal pro Saison und vor der ersten Runde; Rundenanlage und Auflösung sind permissionless. `pause` stoppt nur neue Commits — nie Reveal, Resolve, Claim. Rundenbedingungen sind in der aktuellen Programmversion unveränderlich; die Upgrade-Autorität ist eine benannte Vertrauensannahme.
4. Nirgends „Referenz für natürliche Nutzung“, nirgends „Streak“, nirgends „You were closer“. Vergleich als Fakten: „Crowd 64 · You 40“.
5. Sample-Daten sind immer als Sample gekennzeichnet.
6. Sicherheit ist nachprüfbar, nicht behauptet: Verifiable Build (Programm-Bytes gegen Repo prüfbar), Autoritäten als Multisig auf Hardware, SECURITY.md mit Bedrohungsmodell und Kontakt, keine Schlüssel im Repo.

## 9. Scope v1

**Drin:** tägliche Runde · Commit-Reveal in einer Tx · SGT-Gating über Mint · Pyth-Evidenz + permissionless Resolve · NO_RESOLVE · Brier + kumulativer Record + drei ehrliche Zahlen · gestrige Verteilung (21 Buckets, on-chain `[u32;21]`) · Push (Mitternacht „outcome is in“, eine lokale Stunde vor Schluss, mittags „yesterday is in“) · After-hours-Erststart mit Sample-Runde · Sample-Record-Toggle (Demo, mit Banner) · Settings mit Autoritäten und Kosten in Klartext · Share-Karte (Score + Frage, kein Wallet) · **Home-Screen-Widget 4×2** mit vier Zuständen plus „kein Wallet“ (Pflicht, siehe 03 §Widget; Bau nach der Schleife, vor Mainnet).

**Draußen:** Pot · Sponsor · Community-Tab / Vote · Credential (SAS) · Yes/No-Umschalter · Meta-Frage · Netzwerk-/Ereignisfragen ohne Feed · Freunde/Ligen/Leaderboard · Chat · Token · Hintergrund-Worker · verbrannter Upgrade-Key.

## 10. Positionierung und Ton

Name **Observed**. Gegen die Wette (Foresee, Polymarket, Phantom) und gegen den Grind. Wetterbericht, nicht Casino: eine große Zahl pro Screen, keine Rot/Grün-Urteile, keine Coins, kein Konfetti. Design: Korrekturfahne bei Nacht (siehe Design Bible). Die stille Seeker-Zeile: „Genesis · verified“.

## 11. Kosten (im Onboarding wörtlich)

Eine Zeile, zwei Zahlen, überall identisch: „No app fees. Network ≈ 0.0001 SOL per day · ≈ 0.002 SOL deposit, refunded when the round closes.“ (Beide Zahlen nach Spike 1 exakt einsetzen; dieselbe Zeile in Onboarding, Today und Settings.)

## 12. Plan und Beweis

- Deadline 8. Okt 2026, 23:59 PDT (= 9. Okt 08:59 MESZ). Woche 1: Schleife + Spikes, erste Tester ab Tag 4–5 (Devnet). Woche 2: Mainnet, Reviews, Monitoring, Kalender- und Statusseite. Woche 3: nichts Neues — Kohorte, Video, Deck, Befund.
- Die Saison läuft **über die Deadline hinaus** bis mindestens 11. Nov 2026 (Gewinnerbekanntgabe): Die Jury soll spielen, nicht nur schauen. Kalender = 64 Blätter, Cron und Alerts laufen unbeaufsichtigt durch; siehe `05-LAUNCH-PLAN.md`.
- Belegformat für die Jury: „Von N Geräten mit erstem Commit: M erster Reveal, K an drei getrennten Tagen zurück; D7 wo erreicht; Pushes/Erinnerungen offengelegt; ein Nutzerzitat.“
- Konsumentenmoment im Video: das Aufdecken — „pending“ durchgestrichen, „observed“ darüber.

## Änderungen (chronologisch)
- 17.09.2026 — v1 eingefroren.
- 17.09.2026 — Grok-Review eingearbeitet: Missing abgeleitet statt gebucht; Catch-up als Fensterfolge; Result ab resolve, Menge ab 12:00; Kalender-Wurzel on-chain; Gleichheit erzwungen; Brier-Anzeige /10 000; Verkaufsfall; Kostenzeile vereinheitlicht; NO_RESOLVE-Mapping.
- 17.09.2026 — Security-Review: Öffentlichkeit der Teilnahme, Verlauf am Gerät, Regel 6 (Verifiable Build, Multisig, SECURITY.md); Bedrohungsmodell und Abnahmekriterien in 01.
- 17.09.2026 — Judge-Durchgang: Missing wird mit 0,250 gewertet (selektives Aufdecken abgefangen statt nur sichtbar); MWA-Lebenszyklus und Priority-Fee-Strategie in 02.
- 17.09.2026 — Abheben: Saison bis 11. Nov, Kalender 64 Blätter, fünf Differenzierer in 05-LAUNCH-PLAN.md.
- 17.09.2026 — Widget ist Pflicht (v1), vier Zustände plus „kein Wallet“, kein versiegelter Wert auf dem Home-Screen.
- 17.09.2026 (abends) — Claude-Code-Einlesen: `close_entry` bei Resolved nur nach Scoring (Strafe nicht umgehbar); Kalender einheitlich bis 64 Runden; Kalibrierungskurve ab 21 aufgedeckten (nicht gescorten) Runden; Widget-Zustände vereinheitlicht; Kostenzeile in 03 angeglichen; Beispielzahlen in eigenen Abschnitt.
- 17.09.2026 (abends) — Claude-Code-Einlesen, zweite Runde: Fragetexte strikt „above/below“ (Gleichheitsregel); Erste-Saison-Prädikat und leaf_count-Grenzen in publish_calendar.
- 17.09.2026 (mittags) — Zweitmeinung zur Fragen-Mechanik: Kalenderblatt enthält nur die Regel (Feed, Offset, Fenster), keine Schwelle; Referenzpreis = erstes Update nach 12:00 (Abgabeschluss), damit spätes Versiegeln keinen Vorsprung bringt; Schwelle rechnet das Programm; `create_round` permissionless, Fragen-Autorität entfällt; zwei Oracle-Updates pro Runde; Auflösen in der App nur optional (mehrere Freigaben); Deadline in PDT.
- 17.09.2026 (nachmittags) — Nachzug: §3 „Offen“ friert Regel/Offset statt Schwelle ein; §7 Muskelgedächtnis-Test wählt Offsets statt Schwellen.
