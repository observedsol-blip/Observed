# Vorschläge für 00-SPEC.md — Spec-Runde 17.09.2026 (abends)

Nur Vorschläge. Die Übernahme macht der Owner. Stand der Spec: Commit `55787f6`.
Format je Punkt: **Status** · Stelle · alter Satz → neuer Satz.

## In zehn Minuten abhaken — eine Zeile pro Vorschlag
| # | Stelle | Was sich inhaltlich ändert | Nötig? |
|---|---|---|---|
| 1 | §5 | Nur ein Beleg-Satz: Spike 1 hat die 12:00/00:00-Regel an 180 von 180 Zeitpunkten bestätigt. Keine Mechanikänderung. | optional |
| 2 | §7 | Nichts — „above/below" steht bereits so in der Spec. | nein |
| 3 | §5 | Ehrlichkeit: Evidenz posten kann nur, wer Pyth-Zugang hat; das Programm prüft sie unabhängig vom Poster. | **ja** |
| 4 | §5 | Konfidenzgrenze wird festgeschrieben: `max_conf_bps` = 50 (gemessenes Maximum 8). | **ja** |
| 5 | §7 | SKR/USD fliegt aus der Feedliste und der Rotation (Pyth-Plan sperrt den Feed). | **ja** |
| 6 | §6 | Definition: „scored" = aufgedeckte **und** Missing-Runden, „revealed" nur aufgedeckte. Beispiel 9/8/1/9. | **ja** |
| 7 | §9 | Ausschluss präzisiert: kein Hintergrund-Worker für Chain-Arbeit; WorkManager fürs Widget bleibt erlaubt. | **ja** |
| 8 | §12 | Termin: Tester ab 25.09. auf Mainnet statt Tag 4–5 auf Devnet; Saison 1 startet an dem Tag. | **ja** |
| 9 | §4 | Optional: festhalten, dass die SGT-Prüfung eine Funktion ist und vor jeder Zustandsänderung läuft. | optional |
| 10 | §6 | **Neu:** Record zeigt ab 10 aufgedeckten Runden einen vorläufigen Befund mit Unsicherheitsspanne, statt nur bis 21 gesperrt zu sein. | **ja** |

Dazu je eine datierte Zeile für „## Änderungen (chronologisch)" am Ende dieser Datei.

## 1. Frage-Mechanik (Referenz 12:00, Ergebnis 00:00)
**Status: bereits in der Spec** (§3 Zeile „Referenz“, §5 „Zwei Updates pro Runde“, §7 Kalenderblatt/Formulierungsregel). Keine Textänderung nötig.
Formulierung bleibt **„more than x% above“** (nicht „at least“ — „at least“ hieße ≥ und widerspräche Gleichheit = Nein).
Nur eine Ergänzung in §5, am Ende des Punkts „Zwei Updates pro Runde …“:
- alt: „… fehlt ein gültiges Referenz- oder Ergebnis-Update im Fenster, endet die Runde in NO_RESOLVE.“
- neu: „… fehlt ein gültiges Referenz- oder Ergebnis-Update im Fenster, endet die Runde in NO_RESOLVE. Spike 1 (docs/spikes/pyth.md): In 30 Tagen lag für SOL, BTC und ETH das erste Update nach 12:00 und 00:00 in 180 von 180 Fällen exakt auf der Sekunde.“

## 2. Gleichheit = Nein, Copy „above“
**Status: bereits in der Spec** (§7 „Gleichheit = Nein (im Programm erzwungen)“ und Formulierungsregel). Keine Änderung.

## 3. §5 Evidenz — wer posten kann
- Stelle: §5, erster Punkt.
- alt: „- Quelle v1: Pyth Pull-Oracle, historische Updates über Pyth Benchmarks (eigener Proxy mit API-Key; Proxy ist keine exklusive Voraussetzung — jeder kann Evidenz posten).“
- neu: „- Quelle v1: Pyth Pull-Oracle, historische Updates über Hermes/Benchmarks. Jeder mit Pyth-Zugang (API-Key) kann Evidenz posten; die App holt die Daten über unseren Proxy. Das Programm prüft die Evidenz unabhängig vom Poster.“

## 4. Konfidenzgrenze
- Stelle: §5, Punkt „Zwei Updates pro Runde …“, nach „Beide `VerificationLevel::Full`, Feed-ID und Konfidenzregel pro Runde eingefroren.“
- einfügen: „Konfidenzregel v1: `max_conf_bps = 50` für alle Feeds (beobachtetes Maximum in Spike 1: 8 bps).“

## 5. Feeds: SKR raus
- Stelle: §7, erster Punkt.
  - alt: „- Nur binär, nur per Feed auflösbar (SOL/USD, SKR/USD, BTC/USD, ETH/USD via Pyth). Keine Fragen ohne Feed in v1.“
  - neu: „- Nur binär, nur per Feed auflösbar (SOL/USD, BTC/USD, ETH/USD via Pyth). Keine Fragen ohne Feed in v1.“
- Stelle: §7, Punkt „Feeds nur, wenn …“.
  - alt: „(SKR/USD in Spike 1 prüfen; sonst aus der Rotation)“
  - neu: „(SKR/USD ist in v1 nicht in der Rotation: Der Feed existiert, ist im aktuellen Pyth-Plan aber nicht freigeschaltet — Spike 1)“

## 6. „scored“ eindeutig
Das Programm erhöht `scored_rounds` auch für Missing (01 §3 `score_entry`).
- Stelle: §6, Punkt „Verlauf: …“.
  - alt: „- Verlauf: `score_sum`, `scored_rounds` (kumulativ; kein „gleitend“ in v1). Baselines: immer-50 %, Menge.“
  - neu: „- Verlauf: `score_sum`, `scored_rounds` (kumulativ; kein „gleitend“ in v1). **„scored“ zählt alle Runden im Record — aufgedeckte und Missing (als 0,250); „revealed“ zählt nur aufgedeckte.** Baselines: immer-50 %, Menge.“
- Beispielzahlen: Die Spec selbst enthält keine Record-Beispielzahlen (nur §8 „Crowd 64 · You 40“, unverändert gültig). Einheitliches Beispiel für alle Docs, in 03 bereits so eingetragen: **9 commits · 8 reveals · 1 missing · 9 scored · Kalibrierung „you're at 8“**. Falls die Spec ein Beispiel bekommen soll, in §6 nach „Kalibrierungskurve …“: „Beispiel: 9 Commits, 8 Reveals, 1 Missing → 9 scored, Kalibrierungskurve zählt 8.“

## 7. §9 Hintergrund-Worker abgrenzen
- Stelle: §9 „Draußen“.
  - alt: „… · Token · Hintergrund-Worker · verbrannter Upgrade-Key.“
  - neu: „… · Token · Hintergrund-Worker für Chain-Arbeit (kein RPC, kein Signieren im Hintergrund) · verbrannter Upgrade-Key. Erlaubt: WorkManager ausschließlich für den Widget-Refresh aus dem lokalen Cache.“

## 8. §12 Termin Tester (datierte Abweichung)
- Stelle: §12, erster Punkt.
  - alt: „Woche 1: Schleife + Spikes, erste Tester ab Tag 4–5 (Devnet).“
  - neu: „Woche 1: Schleife + Spikes. Erste Tester ab 25.09.2026 **auf Mainnet** mit echten SGTs (Devnet hat keine SGTs); die Tester sind die Kohorte, Saison 1 beginnt an diesem Tag (siehe docs/spikes/testnet-plan.md).“
- Stelle: §12, zweiter Punkt, ergänzen: „Saison 1 startet am 25.09.; 64 Blätter reichen bis 27.11. Kein Saisonwechsel vor dem 11.11.“

## Datierte Zeile für „## Änderungen (chronologisch)“ (ans Ende)
- 17.09.2026 (abends, 3) — Nach Spike 1 und Spike-2-Vorbereitung: SKR/USD aus der Rotation (Pyth-Plan); `max_conf_bps` = 50; Evidenz-Satz §5 präzisiert (Pyth-Zugang nötig, Programm prüft unabhängig); „scored“ = aufgedeckt + Missing definiert; Hintergrund-Worker nur für Chain-Arbeit ausgeschlossen, WorkManager fürs Widget erlaubt; Tester ab 25.09. auf Mainnet statt Tag 4–5 auf Devnet, Saison 1 ab 25.09.

## 9. SGT-Prüfung als Handler-Guard (Owner-Entscheidung 17.09.)
01-PROGRAM §3 `commit` ist direkt angepasst. Die Spec selbst nennt die Constraint-Form nicht; falls §4 das festhalten soll, Vorschlag:
- Stelle: §4, Punkt „Ein Eintrag pro physischem Seeker …“, nach „Eligibility beim Commit (Token-2022-Gruppenmitgliedschaft, Owner = Signer, Betrag 1).“
- einfügen: „Die Prüfung läuft als eine einzige Funktion und als erster Schritt vor jeder Zustandsänderung; alle Konten sind typisiert und über Constraints gebunden (01 §3 commit).“
- Datierte Zeile: „17.09.2026 (abends, 4) — SGT-Extension-Prüfung als Handler-Guard erlaubt (typisierte Konten, eine Funktion, erster Aufruf); Reviewer prüft das.“

## 10. Record: vorläufiger Befund ab 10 aufgedeckten Runden (Owner, 17.09.)
Heute sperrt die Spec die Kalibrierungskurve bis 21 aufgedeckte Runden (§6) — dazwischen sieht der Spieler nichts über sich.
- Stelle: §6, Punkt „Kalibrierungskurve erst ab 21 …", ergänzen:
- neu: „Ab 10 aufgedeckten Runden zeigt Record einen vorläufigen Befund mit Unsicherheitsspanne („Leaning hot / Leaning cold / Leaning true"), die Kurve selbst bleibt bis 21 gesperrt. Der Befund nennt immer die Stichprobengröße und die Spanne; er ist eine Tendenz, kein Urteil."
- Folge für 03-SCREEN-MAP §4 (Record): dritter Zustand zwischen „gesperrt" und „Kurve" — Text und Spanne dort festlegen. Copy-Vorschlag, noch nicht gesetzt: „Leaning hot · 12 revealed · ±14 pts" (hot = überkonfident, cold = unterkonfident, true = innerhalb der Spanne).
- Datierte Zeile: „17.09.2026 (abends, 5) — Record zeigt ab 10 aufgedeckten Runden einen vorläufigen Befund mit Unsicherheitsspanne; Kurve weiterhin ab 21."

## 11. Betriebsgrenze ehrlich benennen (Owner, 17.09.)
- Stelle: §5, nach dem Punkt „Wer postet: …".
- einfügen: „Betriebsgrenze, offen gesagt: `set_reference` und `resolve` sind im Programm permissionless — jeder Schlüssel darf sie aufrufen, das Programm prüft die Evidenz, nicht den Absender. Praktisch hängt das Posten an unserem Pyth-Zugang: Wer ohne uns auflösen will, braucht eigene signierte Pyth-Daten (API-Key seit 26.08.2026). Bleibt eine Runde bis `resolve_deadline` unaufgelöst — rund 36 Stunden nach Abgabeschluss — endet sie als NO_RESOLVE; niemand wird gescored, die Commits bleiben sichtbar."
- Datierte Zeile: „18.09.2026 — Betriebsgrenze in §5: permissionless im Programm, praktisch an unseren Pyth-Zugang gebunden; 36-Stunden-Fenster, NO_RESOLVE als Endzustand."

## 12. Offene Frage: „This phone posted the oracle reading" (Owner entscheidet, nicht Claude)
Wenn der Resolver jede Runde referenziert und auflöst, ist der Poster **immer unser Dienst** — die Zeile in 03 §3.9/§6 erzählt dann etwas, das nie passiert.
Zwei Wege, beide noch nicht entschieden (zusammen mit dem Seal-Moment):
1. **Zeile ehrlich umformulieren** — Poster benennen, statt ein Gerät zu behaupten (z. B. „Reading posted by the Observed resolver" bzw. den Namen des postenden Schlüssels), die „this phone"-Fassung nur, wenn der Poster tatsächlich dieses Gerät war.
2. **App darf selbst posten**, der Dienst springt nur ein — schöner, kostet aber Pyth-Zugang auf dem Gerät (Proxy-Route, mehrere Freigaben, Kosten beim Spieler). Nicht ohne Prüfung.
Vermerkt als Frage in `docs/03-SCREEN-MAP.md` §6.

## 13. Missing kostet einen vollen Fehlschlag statt 0,250 (Review 18.09., dringend)
**Warum:** Das Reveal-Fenster öffnet **nach** dem Ausgang. Wer aufdeckt, weiß bereits, ob er richtig lag — Schweigen ist damit immer eine informierte Entscheidung. Bei 0,250 lohnt sich Schweigen für **jede** Antwort, deren Brier über 0,250 liegt, also jede selbstsichere Fehlprognose. Simulation (400 000 Durchläufe je Zeile): ehrlich kalibriert bei q=0,60 → 0,238; „immer 100 % und nur Treffer aufdecken" → 0,098. In 20 von 21 Buckets gibt es einen Ausgang, bei dem Schweigen zahlt. Der angezeigte Brier misst dann Schweigebereitschaft, nicht Kalibrierung.
- Stelle: §6, Punkt „**Missing kostet.**"
  - alt: „Jeder Missing Reveal in einer aufgelösten Runde geht mit 0,250 (der Immer-50-%-Wert) in den Verlauf ein, gekennzeichnet als „missing, scored as 50 %"."
  - neu: „Jeder Missing Reveal in einer aufgelösten Runde geht mit **1,000** in den Verlauf ein — dem schlechtesten Wert, den eine aufgedeckte Antwort bekommen kann —, gekennzeichnet als „missing, counts as a full miss". Damit ist Schweigen nie billiger als Aufdecken; bei 0 % oder 100 % auf der falschen Seite ist es gleich teuer, nie günstiger."
- Stelle: §6, Punkt „Missing = Commits − Reveals − offene", Satz zu annullierten Runden.
  - alt: „In annullierten Runden: kein Score, Missing zählt nur als Zahl."
  - neu: „In annullierten Runden (NO_RESOLVE): **kein Score und kein Missing** — niemand trägt einen vollen Fehlschlag für eine Runde ohne Ausgang. Ausnutzbar ist das nicht: Im Reveal-Fenster (bis 12:00) weiß niemand, ob die Runde nach 36 h storniert wird."
- **Verworfene Alternative** (zur Dokumentation): Reveal-Fenster vor den Ausgang legen oder auf 36 h verlängern. Im Code ist es eine Konstante, im Design nicht: §3 („Aufdecken 00:00–12:00"), CALENDAR.md, 01 §3 (`reveal_close = outcome_time + 12 h`), das Client-Muster „reveal R−1 im Commit von R" und die Zusage „höchstens zwei offene Einträge" hängen daran. 36 h ließen zwei Reveal-Fenster überlappen und verschöben Scoring und `close_entry` um einen Tag.
- Datierte Zeile: „18.09.2026 — Missing kostet 1,000 statt 0,250 (selektives Aufdecken war sonst die dominante Strategie); NO_RESOLVE wertet niemanden, auch nicht als Missing."

## 14. §8 Regel 6: Einzelschlüssel statt Multisig, ehrlich benannt (Owner-Entscheidung)
- Stelle: §8, Regel 6.
  - alt: „… Autoritäten als Multisig auf Hardware, SECURITY.md mit Bedrohungsmodell und Kontakt, keine Schlüssel im Repo."
  - neu: „… Autoritäten als **einzelner, offline gehaltener Schlüssel** (Squads-Multisig erst nach dem 9. Okt 2026; die Vertrauensannahme steht so in SECURITY.md), SECURITY.md mit Bedrohungsmodell und Kontakt, keine Schlüssel im Repo."
- Ergänzend in §8 Regel 3 oder SECURITY.md festhalten: Es gibt **keine** Instruktion zum Rotieren von `calendar_authority`/`pause_authority`; ein verlorener Schlüssel ist nur über ein Programm-Upgrade heilbar. Bewusst so, weil eine Rotations-Instruktion selbst Angriffsfläche wäre.
- Datierte Zeile: „18.09.2026 — Regel 6: Einzelschlüssel offline statt Multisig bis zur Deadline; keine Rotations-Instruktion, Schlüsselverlust nur per Upgrade heilbar."

## 15. Orakelregel O1, Fenster 16:00–04:00, Referenz 04:02, Fragetyp „Bewegung" (Owner-Entscheidungen 18./19.09., im Programm)
Der Code folgt hier bereits den Entscheidungen; die Spec widerspricht ihm an diesen Sätzen. Braucht `.spec-unlock`.
- §3 Tabelle, alle Zeilen mit Uhrzeiten:
  - alt: „Offen | 00:00–12:00“, „Referenz | 12:00 (= Abgabeschluss) | Der Referenzpreis ist das erste gültige Feed-Update nach 12:00 UTC. Er ist beim Versiegeln **niemandem** bekannt …“, „Ereignis | T = 24:00 | Ergebnis = erstes gültiges Feed-Update nach T …“, „Aufdecken | 00:00–12:00 (Folgetag)“, „NO_RESOLVE | T + 24 h ohne gültige Evidenz“.
  - neu: „Offen | 16:00–04:00 | `commit` erlaubt. Regel, Feed, Schwelle in Prozent und Fenster sind eingefroren; der Referenzpreis entsteht erst um 04:02.“, „Referenz | 04:02 (zwei Minuten nach Fensterschluss) | Die erste gültige Einreichung in [04:02, 04:03] fixiert den Wert, der dann im benannten Pyth-Konto steht, höchstens 60 s alt — also frühestens um 04:01 veröffentlicht, eine volle Minute nach Fensterschluss. Er ist beim Versiegeln **niemandem** bekannt; das Programm lehnt jeden Kalender ab, der das nicht garantiert.“, „Ereignis | T = 16:00 | dieselbe Regel in [16:00, 16:01]“, „Aufdecken | 16:00–04:00 (Folgetag)“, „NO_RESOLVE | keine gültige Einreichung im jeweiligen 60-s-Fenster; sofort danach annullierbar“.
  - Copy-Zusage dazu (nach 03-SCREEN-MAP): „The reference is taken after sealing closes. Nobody who sealed could have seen it.“
- §2 „Mittags siehst du, was passiert ist …“ → „Um 16:00 UTC siehst du, was passiert ist …“ (Zeiten im UI immer mit lokaler Zeit daneben).
- §5, Punkte 1–4 („Quelle v1: Pyth Pull-Oracle, historische Updates über Pyth Benchmarks …“, „Zwei Updates pro Runde … `prev_publish_time < R ≤ publish_time ≤ R + 60 s` …“, „Ein wegen Konfidenz verworfenes erstes Update darf nicht durch ein späteres ersetzt werden“, „Oracle-Posting ist eine eigene (gesponserte) Transaktion“, „Wer postet: … Benchmarks …“).
  - neu: „Quelle v1: das von Pyth gesponserte Preiskonto des Feeds im neuen Pyth-Stack (Push-Oracle `pyt2F4…`, Receiver `rec2HH…`), in den Rundenbedingungen fest benannt; kein Schlüssel, kein Posten. Regel: Die erste gültige Einreichung im Fenster [t, t + 60 s] (t = 04:02 für die Referenz, 16:00 für das Ergebnis) fixiert den Wert, der in diesem Moment im Konto steht, sofern er höchstens 60 s alt, voll verifiziert, vom richtigen Feed und in der Konfidenzgrenze ist. Eine ungültige Einreichung blockiert nichts; eine spätere gültige im Fenster zählt. Die Auswahl des Messzeitpunkts wird nicht verhindert, sondern dauerhaft sichtbar gemacht: Wert, Update-Slot, Einreichungs-Slot, Zeit und Einreicher stehen in der Runde; eine Belegtabelle im Repo zeigt je Runde alle zulässigen Werte und ob sie das Ergebnis gedreht hätten.“
- §7 „Nur binär, nur per Feed auflösbar (SOL/USD, SKR/USD, BTC/USD, ETH/USD via Pyth)“ und die Formulierungsregel „Will SOL be more than 1% above its 12:00 UTC price at 00:00 UTC?“.
  - neu: „Saison 1: nur der Fragetyp **Bewegung** — mehr als x % über oder unter der Referenz, Endpunkt gegen Endpunkt, beides strikt (genau x % ist Nein). Feeds SOL, BTC, ETH; BTC nicht am Wochenende. Schwellen vorab im Kalender, aus den letzten 30 Tagen geeicht (Ziel ~45 % Ja, Band 30–70 %), nie unter 1,0 %.“ Wortlaut nur „more than x% above or below“, nie „at least“.
- §7 „Muskelgedächtnis-Test … Offsets so wählen, dass 40–60 % erwartbar sind“ → „30–70 %, Mitte 45 %“.
- §5 neu, knappe Runden: „Jede Runde nennt vorab eine **Messbandbreite** (Saison 1: 25 Basispunkte, aufgerundet aus dem p90 der gemessenen Spanne je Zeitpunkt). Beim Auflösen schreibt das Programm, wie weit der Ausgang die Schwelle verfehlt oder überschritten hat. Liegt dieser Abstand innerhalb der Bandbreite, war die Runde innerhalb der Messgenauigkeit entschieden; das zeigt die App und jeder kann es aus den gespeicherten Werten nachrechnen. Die Schwelle ist immer mindestens das Vierfache der Bandbreite.“
- Datierte Zeile: „19.09.2026 — Orakel: gesponsertes Pyth-Konto, erste gültige Einreichung in 60 s, Höchstalter 60 s; Auswahl sichtbar statt verhindert. Fenster 16:00–04:00 UTC, Referenz 04:02 (zwei Minuten nach Fensterschluss, niemand, der versiegelt hat, kann sie gesehen haben), Ergebnis 16:00. Saison 1 nur Fragetyp Bewegung, Schwellen ≥ 1,0 %, BTC nicht am Wochenende.“

## 16. Fragetyp „Richtung" als Standard und Aufdeckfenster 72 h (Owner-Entscheidungen 21.09.2026, im Programm)
Umgesetzt und getestet; die Spec widerspricht dem Code an diesen Sätzen. Braucht `.spec-unlock`.
Ersetzt Teile von Vorschlag 15 (Fragetyp) und die dort verworfene Alternative (Fenster 36 h).

- §3 Tabelle, Zeile „Aufdecken".
  - alt: „Aufdecken | 16:00–04:00 (Folgetag) | `reveal` für R, parallel zu `commit` für R+1 …"
  - neu: „**Aufdecken | 16:00 bis 16:00 drei Tage später (72 h)** | `reveal` für jede noch offene
    Runde, zusammen mit `commit` für die heutige — alles in EINER Transaktion, eine Freigabe.
    Wer einen Tag auslässt, verliert die schon gesiegelten Runden nicht. Nach Fensterschluss
    kostet Schweigen weiterhin den vollen Fehlschlag (1,000)."
  - Begründung für die Spec: Ein ausgelassener Abend kostete bisher eine volle Strafe. Das ist die
    Lehre aus Trepa („a live hour a day required them to build their day around us"). 72 h ist die
    längste Frist, die noch in eine Transaktion passt: drei Aufdeckungen plus Siegeln plus zwei
    Memos sind 1 027 von 1 232 Bytes (`programs/observed/tests/capacity.rs`).
- §6, Punkt „Missing = Commits − Reveals − offene Einträge": „höchstens zwei offene" → „**höchstens
  drei offene**" (mit 72 h fällt `reveal_close(R−4)` genau auf das Öffnen des Siegelfensters von R).
- §7, Fragetyp.
  - alt (aus Vorschlag 15): „Saison 1: nur der Fragetyp **Bewegung** …"
  - neu: „Saison 1 stellt als Standard die **Richtungsfrage**: „Will SOL be higher at 16:00 than at
    04:02 UTC?" — Endpunkt gegen Endpunkt, strikt, **Gleichstand ist Nein**. Keine Schwelle, also
    nichts zu eichen: über 364 Tage liegt die Ja-Quote bei 47–49 % für SOL, BTC und ETH
    (`spikes/baserate/direction.mjs`). Werktags rotieren SOL, BTC, ETH; am Wochenende läuft nur
    SOL, weil bei Schwelle 0 eine Wochenendrunde bei SOL in 15 % der Fälle im Messband liegt, bei
    ETH in 25 % und bei BTC in 37 %. An **Ereignistagen** (US-Arbeitsmarktbericht, US-CPI, der Tag
    nach einem FOMC-Beschluss) bleibt die **Bewegungsfrage** mit 1,7 % und einer Kontextzeile; die
    Zeile ist Anzeige und steht nicht im Hash."
  - Ergänzung zur Messbandbreite: „Die Schwelle ist mindestens das Vierfache der Bandbreite" gilt
    nur noch für Bewegungsfragen. Bei der Richtungsfrage gibt es keine Schwelle; dort ist die
    Bandbreite die Marke für „innerhalb der Messgenauigkeit entschieden" und auf 1 % gedeckelt.
    Das trifft je nach Feed jede achte bis zehnte Werktagsrunde — die App muss das sagen können
    (Arbeitstitel „Too close to call"), sonst wäre die Anzeige unehrlich.
- Datierte Zeile: „21.09.2026 — Standardfrage ist die Richtung (Gleichstand = Nein), Bewegung nur
  noch an fünf Ereignistagen; Aufdeckfenster 72 h statt 12 h, eine Freigabe deckt alles Offene auf."

