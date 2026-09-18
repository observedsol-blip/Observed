# HANDOFF — gemeinsames Gedächtnis von Claude (Chat) und Claude Code

Diese Datei ist die einzige Stelle, an der beide schreiben. Sie ersetzt keine Spec und keine
Entscheidungsdatei. Sie hält fest, was der jeweils andere noch nicht weiß, und wo einer den anderen
korrigiert hat — damit derselbe Fehler nicht zweimal passiert.

Ablage: `docs/HANDOFF.md` im Repo. Das Repo ist die Wahrheit; es gibt bewusst keine zweite Kopie.

## Spielregeln
1. **Claude Code schreibt hier**, wenn er (a) eine Annahme aus Chat/Spec widerlegt hat, (b) eine
   Messung hat, die eine Entscheidung ändert, (c) etwas braucht, das nur Dinkelberg oder der Chat
   liefern kann. Nicht für normalen Fortschritt — der steht in Commits und `docs/spikes/`.
2. **Claude (Chat) schreibt hier**, wenn eine Entscheidung fällt, die den Code betrifft, und wenn er
   eine eigene frühere Aussage zurückzieht.
3. **Jeder Eintrag: Datum · wer · ein Satz Behauptung · ein Satz Beleg · die Folge.** Keine
   Begründungsaufsätze, die gehören in DECISIONS-*.md.
4. **Wer die Datei liest, liest sie ganz.** Deshalb hart begrenzt: Abschnitt „Korrekturen" maximal
   15 Einträge, Abschnitt „Offen" maximal 10. Beim Überlaufen wird der älteste erledigte Eintrag
   gelöscht, nicht archiviert.
5. Widerspruch wird nicht geglättet. Wenn Chat und Claude Code verschiedener Meinung sind, stehen
   **beide Positionen** hier, bis Dinkelberg entscheidet. Kein stilles Überschreiben.
6. Keine Schlüssel, keine Wallet-Adressen von Dinkelberg, keine Secrets — auch nicht als Beispiel.

## Stand
- Letzte Aktualisierung: 19.09.2026, von Claude Code (O1 entschieden: W = A = 60 s, `posted_slot` für beide Lesungen; Basisraten-Linie (c); Schwellen ≥ 1,0 %, BTC nicht am Wochenende; zweiter Cron für 04:00 und 16:00; Schnitt am Do 24.09. aus gemessenen Zahlen).
- **Reihenfolge App (Dinkelberg, 19.09.).** Pflicht im Build vom 26.09.: Chain-Schicht, Wallet, SGT, Siegeln, Wiederaufnahme, Aufdecken, minimales Ergebnis, Release-Build. Als Erstes danach: der Satz vor dem Siegeln (lokal). Updates vom 27.09. bis 01.10., in dieser Reihenfolge: Record · Erststart bei geschlossenem Fenster · Erinnerung · getrenntes Aufdecken bei Wallet-Wechsel · Crowd-Verteilung · Beleg-Ansicht · Teilen-Karte (fällt notfalls). Signaturschlüssel und Paketname sind ab dem ersten Build unveränderlich.
- Einreichung 08.10., Feature-Freeze 02.10., danach **kein Code mehr bis 10.11.**
- Aktuelle Priorität: Kernablauf auf dem Gerät (Wallet → Antwort → Siegeln → Schließen → Aufdecken
  → Ergebnis → Record, inkl. Wiederaufnahme nach Absturz). Alles andere ist nachrangig.
- Fortschrittsmaßstab: **Wie viele echte Tageswechsel hat ein Nutzer durchlaufen?** Steht auf null.

## Korrekturen — wer wen widerlegt hat

| Datum | Wer korrigiert | Behauptung | Beleg | Folge |
|---|---|---|---|---|
| 18.09. | Claude Code → Chat | ChatGPTs Videozeile über eigene Runden mit ≥80 % | Start 26.09. → bis 06.10. nur ~10 Runden, davon wenige ≥80 % | Beispielzahlen im Video vor dem Dreh nachrechnen, nicht annehmen |
| 18.09. | Claude Code → Chat | Chat hatte zwei nötige Programmänderungen übersehen | Fragetyp-Feld für „Bewegung"; Migration auf den neuen Pyth-Stack | Beides steht vor Saisonstart an |
| 18.09. | Chat → Konzept | Cross-Asset-Fragen (Gold, Devisen, Aktien) | Diese Feeds zahlt eine unbekannte Einzelwallet; 285 von 513 Konten stehen still | Saison 1 bleibt Krypto, eine Fragenfamilie („Bewegung") |
| 18.09. | Claude Code → Dinkelberg | Die neuen Dokumente (HANDOFF, DECISIONS, ANSPRUCH, ZIELBILD, COPY) und die CLAUDE.md-Änderung lagen in einer zweiten Kopie | `Documents\Observerd SOL\observed-repo` steht auf `55787f6` (17.09.); das Repo steht auf `fc3dad8` und ist 20 Commits weiter (Missing 1,000, DEPLOY_AUTHORITY, Resolver, sponsored-feeds) | In das Repo übernommen. Die Windows-Kopie nicht mehr benutzen, sondern löschen oder neu klonen, sonst entstehen zwei Wahrheiten |
| 18.09. | Claude Code → Chat/Spec | „Server aus, ein anderes Gerät löst trotzdem auf" (ANSPRUCH §2) und „später ausgeführt = gleiches Ergebnis" (Spec §3) gelten mit der Schnappschuss-Regel nicht mehr | „Letztes Update vor T" ist nur lesbar, bis das nächste Update das Konto überschreibt: auf Shard 0 im alten Stack nach 52–55 s, im neuen Stack bei SOL/BTC nach ≤5 s (docs/sponsored-feeds.md, 20-min-Messung) | Die Verfügbarkeitsaussage lautet dann „jeder kann auflösen, aber nur im Landefenster direkt nach T". Die NO_RESOLVE-Quote (Offen 3) entscheidet, ob der Satz trägt |
| 18.09. | Claude Code → Chat | DECISIONS-18: gesponserte Feeds hätten „~50–55 s Takt" | Das gilt nur für den alten Stack. Im neuen Stack (`pyt2F4…`), der die Pythnet-Abschaltung überlebt, kamen SOL und BTC in 20 min alle ≤5 s (Grenze der Abfrage), ETH alle ~54 s | Das Landefenster für „letztes Update vor T" ist bei SOL/BTC Sekunden, nicht eine Minute. Die Wochenendmessung erfasst den neuen Stack seit 18.09. 15:42 UTC |
| 18.09. | Claude Code → Chat | Offen 1 (Kompatibilität) ist teilweise schon beantwortet | `pyth-solana-receiver-sdk` 2.0.0 prüft ohne Feature `pro-compatible` den Besitzer `rec5E…`: Konten im alten Stack werden angenommen, Konten im neuen Stack (`rec2HH…`) abgelehnt. Der Emitterwechsel spielt beim Lesen eines Kontos keine Rolle, das Programm prüft nur Besitzer, Diskriminator und `Full` | Offen bleibt nur, wie lange der alte Stack noch aktualisiert wird. Der Wechsel ist ein Cargo-Feature plus neue Fixtures, 2–4 h (teuerste Unbekannte: Fixtures aus echten Konten des neuen Stacks) |
| 18.09. | Claude Code → Chat | „SOL bewegt sich an ~45 % der Tage um mehr als 2 %" | Für unser Fenster 04→16 UTC: 33,5 % über 365 Tage, 26,7 % in den letzten 90. Montag bis Freitag 40 %, Samstag/Sonntag 17 % (docs/spikes/baserate.md) | Schwellen müssen nach Werktag und Wochenende getrennt werden, sonst liegt die Basisrate am Wochenende bei 17 %, also außerhalb von 30–70 %. Eine eingefrorene Rate driftet um ~14 Punkte im Jahr |
| 19.09. | Claude Code → Spec/Chat | Spec §3: Der Referenzpreis sei „beim Versiegeln **niemandem** bekannt“ | Mit A = 60 s darf der fixierte Wert bis zu 60 s **vor** Abgabeschluss (04:00) veröffentlicht sein. Wer in der letzten Minute versiegelt, kennt ihn im ungünstigsten Fall; in `reading_age_is_measured_at_submission` ist das getestet | **Behoben 19.09. (Dinkelberg):** Das Siegelfenster bleibt 16:00–04:00, die **Referenz wandert auf 04:02**. `create_round` verlangt `reference_time − A > commit_close`, jeder zulässige Referenzwert ist also nach 04:01 veröffentlicht. Getestet in `no_admissible_reference_was_visible_while_sealing`. Neuer Kalender-Root `fca5712f…`, `Round` 480 B. Copy-Zusage: „The reference is taken after sealing closes. Nobody who sealed could have seen it.“ |
| 18.09. | Claude Code ↔ Chat (offen) | **Chat:** Bei „Bewegung" hat ein Modell den größten Vorsprung, wegen der Basisrate. **Claude Code:** Größter Vorsprung ja, aber aus einem anderen Grund | Die Basisrate halten wir mit Schwellen um 30–70 % ohnehin nahe 50 %. Der eigentliche Vorsprung ist die aktuelle Volatilität (implizite Vola, Ereignistage), und die ist vorhersagbar. Bei Richtung und Vergleich hat niemand einen Vorsprung, auch kein Modell | Wer KI sichtbar machen will, bräuchte eine Linie „aktuelle Volatilität" statt „Basisrate". Das ist in Saison 1 nicht machbar |
| 18.09. | Claude Code → Dinkelberg (**Veto**, Messung) | O1 (b) „erste gültige Einreichung gewinnt, Wert höchstens A s alt“: Der Anspruch trägt nur, wenn die Wahl des Einreichers das Ergebnis praktisch nie dreht | Tage der letzten 90, an denen die zulässige Spanne den Ausgang hätte drehen können (Spanne aus dem Logger, neuer Stack, Takt 5 s; Abstand zur Schwelle aus Coinbase-Minutenkursen): W=10 s/A=10 s → 4 (p50) bis 8 (p90); W=30/A=15 → 6–15; W=60/A=60 → 11–30; W=120/A=60 → 12–32. Pro Saison mit 64 Runden, jeweils p90: SOL 5,7 / 10 / 21, BTC 5,7 / 10,7 / 18, ETH 8,5–19. Nahe null nur, wenn die Spanne unter ~5 bps liegt, also bei W und A ≈ 2–3 s. Dann hat ETH bei A=10 s schon in 61 % der Zeitpunkte keinen zulässigen Wert, und Landen ist praktisch unmöglich | **Bei keinem praktikablen W/A nahe null.** Zeile 1 (Korridor-Veto) war damit richtig. O1 ist entschieden, trägt aber nur mit bezifferter Restunsicherheit im Anspruch (siehe nächste Zeile). Alternative ohne Wahl: „letztes Update vor T“ auf einem Konto mit ~55-s-Takt (ETH neu/0, alle alt/0), ~6 % Verlust pro Zeitpunkt. Für SOL und BTC im neuen Stack (Takt 5 s) geht das nicht. Entscheidung bei Dinkelberg. **Entschieden 19.09. (Dinkelberg):** W = 60 s, A = 60 s. Die Restzahl kommt nicht in den Anspruchssatz; die Orakelfrage bekommt einen eigenen Absatz und eine Belegtabelle im Repo |
| 19.09. | Claude Code → Dinkelberg | „Die Schwankungsbreite fällt seit Monaten“ | Das stimmt über das Jahr, nicht für den letzten Monat. Bei gleicher Schwelle lagen die letzten 30 Tage **höher** als die Tage 31–60: SOL Mo–Fr 1,70 % → 50 % (30 Tage) gegen 32 % (60 Tage), BTC 1,30 % → 50 % gegen 34 %, ETH 1,20 % → 50 % gegen 39 % | Auf 30 Tage geeicht, wie verlangt, mit der Bedingung, dass die 60-Tage-Rate im Band 30–70 % bleibt. Beim Wochenende sind 30 Tage nur n = 8 (±18 Punkte), dort stützt die 60-Tage-Rate. Tabelle unter „Machbarkeit O1“ |
| 19.09. | Claude Code → Dinkelberg | Die Aufdeck-Transaktion des ersten Nutzers nach 16:00 könnte die Ergebnislesung mit einreichen | Technisch billig: `resolve` heute 9 205 CU, +~45 B in einer Transaktion von 640 B, einige Lamports Priority Fee mehr. Die Reihenfolge `resolve → reveal → score_entry` funktioniert in einer Transaktion. **Aber mit W = 60 s zählt nur ein Aufdecken zwischen 16:00:00 und 16:01:00**, und aufgedeckt wird irgendwann zwischen 16:00 und 04:00. Außerdem darf die Transaktion nicht scheitern, wenn die Runde schon aufgelöst ist; dafür bräuchte es ein No-op, gegen Spec „zweiter Aufruf → Fehler“ | **Nicht bauen.** Zweiter Cron für 04:00 **und** 16:00 wie geplant. Unabhängig wird der zweite Einreicher erst mit einem großen W, und das haben wir für die Robustheit ausgeschlossen |
| 18.09. | Claude Code → Chat | Das Höchstalter A wird am Normalabstand von 5 s bemessen | Dokumentierter Herzschlag laut Pyth für SOL, BTC und ETH: 55 s / 0,5 %. Gemessen Fr 15:42–21:49 UTC (6,1 h, noch kein Wochenende), neuer Stack: größter Abstand SOL 16 s, BTC 16 s, ETH 64 s; alter Stack 61 s. Wer den 5-s-Takt von SOL/BTC bezahlt, ist nicht belegt (Stichprobe Fee-Payer `9F6Ap…`, nicht unter den dokumentierten Pyth-Payern) | **A muss am dokumentierten Herzschlag hängen, also A ≥ 60 s**, sonst gibt es keinen zulässigen Wert, sobald der zusätzliche Takt wegfällt. Mit A = 60 s liegt die Spanne pro Zeitpunkt bei p90 22,7 bps (SOL) und 11,6 bps (BTC). Das Höchstalter ist die eigentliche Schwachstelle der Regel. Wochenendmaximum am Mo 21.09. |
| 18.09. | Claude Code → Chat | ANSPRUCH §2: „Die Tests zu den drei Ablehnungen liegen grün im Repo“ | Die Tests für „zeitlich falscher Kurs“ und „günstigerer Kurs“ prüfen die alte Hermes-Regel (`NotFirstAfter`, `BeforeWindow`, `OutsideOracleWindow`). Nur der Test „Zahl nachträglich ändern“ überlebt den Umbau unverändert | Die beiden anderen werden beim Wechsel auf den Schnappschuss neu geschrieben. Grün sind sie heute, nach dem Umbau erst wieder mit neuen Tests |

## Stolpersteine, die zweimal Zeit gekostet haben
- **Pyth ist kein fester Grund.** Hermes braucht seit 26.08. einen Schlüssel, Pythnet wird
  abgeschaltet, der Emitter hat gewechselt (`G9LV2mp9…` → `6R92oFT…`). Jede Annahme über Pyth wird
  gegen die Doku von heute geprüft, nie gegen Erinnerung.
- **Aufwandsschätzungen im Chat sind keine Messungen.** Zahlen zu Bytes, CUs, Gebühren und
  Freigaben kommen aus `docs/spikes/`, sonst stehen sie nicht in Dokumenten.
- **Aufwandsschätzungen in Stunden bitte als Spanne** mit der teuersten bekannten Unbekannten
  benannt — Dinkelberg rechnet sie erfahrungsgemäß nach unten.
- **UI-Texte**: `CLAUDE.md` verlangt sie wörtlich aus `docs/03-SCREEN-MAP.md`. Neue Texte liegen
  zuerst in `docs/COPY-NEUE-TEILE.md` und müssen von dort nach 03 wandern, bevor sie in Code gehen.

## Offen — mit Besitzer
| # | Was | Wer | Bis |
|---|---|---|---|
| 1 | Kompatibilitätstest — **erledigt 19.09. (41ca39b):** Build mit `pro-compatible`, liest die Konten des neuen Stacks (Test mit echtem Mainnet-Konto `7AviUf…` grün), alte werden abgelehnt | Claude Code | erledigt |
| 2 | Wochenendauswertung 48-h-Logger (Lücken, Alter um 04:00/16:00 UTC) | Claude Code | Mo 21.09. |
| 3 | Wie oft wird das Rennen verloren (erwartete NO_RESOLVE pro Saison)? | Claude Code | Mo 21.09. |
| 4 | Alt- oder Neu-Empfänger — **erledigt 19.09.:** neu, umgesetzt zusammen mit O1 (41ca39b) | Claude Code | erledigt |
| 5 | **Schnitt für den 26.09. bestätigen** (siehe „App 22.–25.09.“ unten). Dazu Spike 3 T2 auf dem Seeker an diesem Wochenende: eine oder zwei Freigaben für Aufdecken+Siegeln in einer Transaktion. Davon hängt die teuerste Unbekannte der App-Woche ab | Dinkelberg | So 20.09. |
| 6 | Kernablauf auf dem Seeker, einmal durchgespielt über einen echten Tageswechsel | Dinkelberg | vor 28.09. |
| 7 | `.spec-unlock` anlegen, wenn 00-SPEC geändert werden muss | Dinkelberg | bei Bedarf |
| 8 | Offline-Schlüssel + Hot Wallet erzeugen, Cloudflare/Helius/healthchecks einrichten, **Mainnet-Deploy bis Do 24.09.** (SGT gibt es nur auf Mainnet, fremde Tester ab 27.09. brauchen Mainnet) | Dinkelberg | Do 24.09. |
| 9 | Expo-Token und Pyth-Key erneuern (standen im Chat) | Dinkelberg | sofort |

## Bewertung Claude Code, 18.09. (Vorschläge aus dem Chat)
- **Basisrate, Daten:** nicht tot. Coinbase-Stundenkerzen, ohne Schlüssel, einmalig, 90 Anfragen für 3 Feeds × 365 Tage. Das ist Coinbase-Kurs, nicht Pyth, für eine Rate unerheblich (docs/spikes/baserate.md).
- **Basisrate, Vertrauen:**
  - (a) ist ein **Feld**, kein Umbau: `base_rate_bps u16` in `RoundTerms`, damit im `terms_hash` und im Kalender. Das kommt in dieselbe Layout-Änderung vor Saisonstart, die ohnehin ansteht (Fragetyp, `source_kind`, Version). Datenbasis und Skript im Klartext in CALENDAR.md.
  - (b) widerspricht dem Anspruchssatz, weil es eine unbelegte Zahl ist.
  - (c) kostet nichts.
- **Basisrate, Definition:** Nur eingefroren ist festschreibbar. Rollierend hieße nachträglich berechnet, also nicht versiegelbar. Getrennt nach Werktag und Wochenende, sonst ist sie für die Hälfte der Tage falsch. Ereignistage: ~10 in 180 Tagen, Standardfehler einer Rate bei n = 10 ≈ ±16 Punkte. Eine eigene Ereignisrate ist nur mit 2+ Jahren Daten und belegten Terminlisten ehrlich; sonst die Linie an Ereignistagen als „ignores event days" beschriften.
- **Basisrate, Aufwand:** 7–11 h gesamt, davon 2–3 h im Programm und Generator vor Saisonstart, der Rest im Client. Teuerste Unbekannte: Terminliste der Ereignistage. Verschiebt den Saisonstart nicht, wenn nur das Feld jetzt kommt und die Anzeige nach dem 10.11.; mit Anzeige kostet es 5–8 h aus der App-Woche, also Satz oder Test.

## Machbarkeit O1, Claude Code, 18.09. (Rohdaten: `spikes/pyth-sponsored/`, `docs/spikes/baserate.md`)
- **Baubarkeit:** Passt in das bestehende `Round`, **kein neues Konto**. Vorhanden sind `ref_price/expo/conf/publish_time`, `referencer` und `evidence_price/conf/publish_time`, `resolver`.
  - Neu: `ref_slot`/`evidence_slot` (u64, 16 B), `ref_submitted_at`/`evidence_submitted_at` (Clock-Zeit, i64, 16 B; beweist T ≤ Einreichung ≤ T+W und Alter ≤ A), `price_account` (32 B, festes Konto aus den Bedingungen), W und A in den Bedingungen (2 × u16, 4 B), Fragetyp/`source_kind`/Version (3 B). Die beiden `*_prev_publish_time` entfallen (−16 B).
  - Summe ≈ +55 B pro `Round` = ≈ 0,00038 SOL Miete pro Runde, 0,025 SOL pro Saison.
  - CU heute gemessen (`full_round_yes_reveal_and_score`): `set_reference` 9 404, `resolve` 9 205. Die neue Prüfung sind drei Vergleiche und ein Pubkey-Vergleich. Den Zuwachs messe ich am Samstag, statt ihn zu schätzen.
- **Wer einreicht:** Der stündliche Lauf reicht nicht. Dazu kommt ein zweiter Cron `59 3,15 * * *`, der bis T wartet (die Wartezeit kostet keine CPU) und in W mit bis zu 3 Versuchen sendet.
  - Kosten: 2 Aufrufe und 2–6 Transaktionen pro Tag, in Workers Paid enthalten, dazu wenige Tausend Lamports.
  - **Fällt dieser Lauf aus, ist die Runde NO_RESOLVE.** Der stündliche Lauf kommt nach W. Einen zweiten, unabhängigen Einreicher gibt es nicht; GitHub Actions verspätet sich um Minuten und taugt nicht.
  - Ungemessen: wie pünktlich Cloudflare-Cron auslöst, und die Abweichung der Clock-Zeit von Solana gegen die Wanduhr. Beides wird gemessen, sobald der Worker-Account steht.
- **NO_RESOLVE pro Saison (64 Runden, 128 Zeitpunkte):**
  - kein zulässiger Wert bei A ≥ 60 s: 0 von 357 Zeitpunkten (6,1 h, beide Stacks);
  - Konfidenz: gemessen 1–8 bps gegen die Grenze von 50, also 0;
  - der Rest hängt an der Zuverlässigkeit des einen Laufs: bei 99 % ≈ 1,3 Runden, bei 97 % ≈ 3,8. Die Zahl steht erst nach der Cron-Messung.
  - Mit A = 10 s: SOL/BTC nur, solange der unbelegte 5-s-Takt anhält, ETH hätte in 61 % der Zeitpunkte keinen Wert.
- **Schwellen, 19.09. neu geeicht auf 30 Tage** (Ziel 45 %, Band 30–70 %; die 60-Tage-Rate muss im Band liegen). Bei n = 22 geht die Rate in Schritten von 4,5 Punkten, deshalb landen alle bei 50 statt 45:

  | Feed | Mo–Fr | Rate 30 / 60 / 90 Tage | Sa/So | Rate 30 / 60 / 90 Tage |
  |---|---|---|---|---|
  | SOL | 1,70 % | 50 / 32 / 34 % | 1,10 % | 50 / 38 / 31 % (n = 8 / 16) |
  | BTC | 1,30 % | 50 / 34 / 38 % | **entfällt** | 0,30 % wäre nötig; bei ≥ 1,0 % nur 6–13 % |
  | ETH | 1,20 % | 50 / 39 / 47 % | 1,00 % | 50 / 31 / 35 % |

  Die Tabelle vom 18.09. ist damit ersetzt. **Entschieden 19.09. (Dinkelberg):** Die Schwelle muss mindestens das Vierfache der Messbandbreite betragen, also ≥ 1,0 % (Bandbreite p90 23 bps SOL, 12 bps BTC pro Zeitpunkt). Am Wochenende laufen nur SOL (1,10 %) und ETH (1,00 %), BTC fällt samstags und sonntags raus. Geprüft habe ich den Ausweg „BTC am Wochenende mit ≥ 1,0 %“: Die Basisrate läge bei 6–13 % (60 Tage), also außerhalb des Bands. Eine bessere Lösung sehe ich nicht.
- **Von außen prüfbar, ohne unseren Code (Stichprobe 19.09.):** Jedes Update des festen Kontos ist eine eigene Transaktion der Push-Oracle, erkennbar an „UpdatePriceFeed“. Von 25 Transaktionen, die das Konto berühren, waren 11–12 Updates, der Rest Leser. Die Instruktionsdaten tragen Pyths öffentliches Wire-Format: Nachricht ab Byte 12, big-endian, `publish_time` bei Byte 65, `prev_publish_time` bei 73, davor Preis, Konfidenz und Exponent. Mit Slot und Blockzeit jeder Transaktion lässt sich die Menge der zulässigen Werte für [T, T+W] und Alter ≤ A aus jedem RPC mit Historie rekonstruieren.
  - Dafür fehlt on-chain **nur** der `posted_slot` des gewählten Updates (`ref_posted_slot` und `evidence_posted_slot`, u64, +16 B). Er verknüpft den gespeicherten Wert eindeutig mit genau einer Update-Transaktion.
  - Alles andere steht dann in `Round` (Wert, `publish_time`, Einreichungs-Slot, Clock-Zeit, Einreicher, Konto) oder in den Bedingungen (W, A, Konto, Feed).
  - Wie weit der öffentliche RPC die Historie zurück liefert, ist ungeprüft. Rund 30 000 Transaktionen pro Tag berühren das Konto, eine Rekonstruktion braucht also ~30+ Seiten `getSignaturesForAddress` pro Tag.
- **Belegtabelle:** Ein Skript im Repo rekonstruiert je Runde alle zulässigen Kombinationen aus Referenz- und Ergebnislesung aus dem Ledger. Zeilen: Datum, zulässige Messzeiten, Wertspanne, Schwelle, Ergebniswechsel möglich ja/nein. Datenlücken erscheinen als eigene Zeile „nicht rekonstruierbar“, nie als unkritisch. Aufwand 4–6 h, nach dem 26.09.
- **App 22.–25.09., Stunden je Teil:**
  - Chain-Schicht (IDL-Client, PDAs, Transaktionsbau mit Compute-Budget und Fee): 4–6 h
  - Wallet (MWA aus Spike 3): 3–5 h
  - SGT-Vorabprüfung: 3–4 h
  - Siegeln (Salt, Keystore, Persistenz vor der Freigabe, Doppeltipp-Sperre): 5–7 h
  - Wiederaufnahme (Kaltstart-Abgleich mit `Entry`): 4–6 h
  - Aufdecken (gebündelt mit Siegeln, eigene Transaktion bei anderer Wallet): 5–7 h
  - Ergebnis minimal (Ausgang, eigene Zahl, Brier, NO_RESOLVE): 3–5 h
  - Release-Build mit fester Signatur und Installation auf dem Gerät: 3–5 h
  - **Summe 30–45 h gegen ~32–40 h in vier Tagen. Geht nur mit Schnitt.** Teuerste Unbekannte: das Verhalten von MWA und Seed Vault auf dem echten Gerät (Spike 3 T2, noch nicht gelaufen, Offen 5).
  - **Vorschlag für den Schnitt:** Der Build vom 26.09. hat nur Kernablauf und minimales Ergebnis.
  - Record, Verteilung und Menge, Evidenzansicht, getrenntes Aufdecken bei Wallet-Wechsel (bis dahin nur ein erklärender Text), der Satz, der Erststart bei geschlossenem Fenster, die Erinnerung und die Share-Karte kommen als Updates vom 27.09. bis 01.10.
  - **Voraussetzung dafür:** Signaturschlüssel und Paketname sind ab dem ersten Build fest, sonst löscht ein Update die Salts der Tester.
- **„Bewegung“ exakt:** Ja genau dann, wenn Ergebnis > Referenz × (1 + x) oder Ergebnis < Referenz × (1 − x), beide strikt. Gleichheit ist Nein. Wortlaut: „more than x% above or below“, nie „at least“.
- **26.09. hart, Veto zum Termin: nein.** O1 ersetzt die ohnehin geplante Orakel-Umstellung am Wochenende und kostet nicht mehr: Regel 2–3 h, Tests 3–4 h (rund 11 Orakel-Tests plus die zwei Demo-Tests). Der enge Resolver-Lauf kommt mit 3–5 h am Montag dazu.
  - Das Risiko für den 26.09. ist nicht O1, sondern die App: Wallet, SGT, Siegeln, Wiederaufnahme, Aufdecken und Ergebnis in vier Tagen, vom 22. bis 25.09.
  - Dazu kommt der Mainnet-Deploy durch Dinkelberg bis 24.09. (Offen 8).

## Was der Chat gerade nicht weiß
Claude Code sieht den Code, der Chat nicht. Wenn eine Entscheidung im Chat auf einer Annahme über
den Code beruht, die falsch ist, ist das der wichtigste Eintrag, den es hier geben kann — bitte
lieber einen zu viel als einen zu wenig.
