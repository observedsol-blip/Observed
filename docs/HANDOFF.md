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
- Letzte Aktualisierung: 21.09.2026 (abends), von Claude Code (**E1 + E10 umgesetzt**: Richtungsfrage als Standard, Aufdeckfenster 72 h, neuer Kalender-Root `5ae91bda…`, Saisonlauf auf Tagesmechanik umgebaut; davor: Wochenende ausgewertet, A = 60 s bleibt; `close_entry` rollierend, Saisonlauf damit wiederholt; Ablese-Läufe mit Backoff und zweitem RPC-Anbieter; Codex-Teilscan triagiert, alte Resolver-Kopie gelöscht, Konfidenzgrenze exakt, `/__scheduled` geschlossen).
- **Entschieden am 21.09. (Dinkelberg):** `Player` wird **nicht** erweitert (Option 1, Bänder-Zähler erst nach dem 10.11.); `close_entry` rollierend — schließbar 30 Tage nach dem Aufdeckfenster, aber nie vor dem 09.11.2026, beide Werte in den Rundenbedingungen und im Hash; der Resolver schließt täglich, die Miete geht an die Wallet des Spielers, die Gebühr zahlt die Hot Wallet. Bis die Veranstalter antworten gilt: **der Resolver darf während der Bewertung nicht angefasst werden** — das Drehbuch plant so.
- Davor: 19.09.2026, von Claude Code (O1 entschieden: W = A = 60 s, `posted_slot` für beide Lesungen; Basisraten-Linie (c); Schwellen ≥ 1,0 %, BTC nicht am Wochenende; zweiter Cron für 04:00 und 16:00; Schnitt am Do 24.09. aus gemessenen Zahlen).
- **Arbeitsreihenfolge (Dinkelberg, 20.09.).** Zuerst 1–7: Flag für knappe Runden (erledigt, d1b32ce) · Resolver auf O1 (erledigt, Resolver-Repo `4aa25a8`, jetzt auf GitHub) · Devnet von Ende zu Ende · App-Kernablauf mit Attrappen · Release-Build-Konfiguration · Drehbuch für den Mainnet-Deploy am 24.09. · Tester-Anleitung.
  Danach **A** (Tester-Updates ab 27.09., je ein Build mit demselben Schlüssel): Record mit zwei getrennten Zahlen (Saisonwert mit Strafen nach außen, Diagnose nur intern, Versäumnisse sichtbar, knappe Runden als eigenes Band) · Erststart bei geschlossenem Fenster · Erinnerung nach der ersten gesiegelten Runde · getrenntes Aufdecken bei Wallet-Wechsel · Crowd-Verteilung · Beleg-Ansicht · Teilen-Karte (fällt notfalls).
  **Parallel B** (Einreichung): Belegtabelle über 90 Tage ins Repo · Manipulations-Skript fürs Video (20 s, lesbare Ausgabe) · Jury-README.
  **Nach dem 10.11. vorgemerkt (Dinkelberg, 21.09.):** Zähler pro Sicherheitsband im `Player` — je Fünferschritt gesetzt/eingetreten, knappe Runden getrennt —, per Realloc angehängt, Altdaten aus dem Rekonstruktions-Skript nachgefüllt. Nicht vorher: Vor dem 09.11. schließt ohnehin kein Entry, und drei Tage vor dem Einfrieren wird das Konto, das Saisons überleben soll, nicht umgebaut. `[u16; 64]` wäre außerdem die falsche Form, weil sie an Saison 1 klebt.
  **C laufend:** Montag Wochenendauswertung (bestätigt A = 60 s oder kippt es) · 00-SPEC nachziehen, sobald `.spec-unlock` liegt · Totmann-Schalter und Telegram-Weg · HANDOFF pflegen, Zeiten im Commit messen.
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
| 21.09. | Claude Code → Dinkelberg | Die Wochenendmessung des Loggers gibt es nicht: Der Prozess starb am Sa 01:27 UTC, als die Sitzung endete (mein Fehler, kein Dienst dahinter) | Ersatz aus dem Ledger, einseitig aber belastbar: Eine Lücke im Transaktionsstrom eines Kontos **beweist**, dass es in dieser Zeit nicht aktualisiert wurde. Sa+So: SOL 37 807 Tx, größte Lücke 10 s; BTC 41 430 Tx, größte 66 s (eine, 19.09. 19:12); ETH 4 095 Tx, p50 52 s, größte 87 s, 17 Lücken > 60 s (19.09. 19:12, 20.09. 03:07, 19.09. 01:19 …) | **A = 60 s hält auch am Wochenende.** Eine Runde geht erst verloren, wenn eine Lücke das ganze Fenster überdeckt, also > 117 s (60 s Alter + 55 s Nachversuche); beobachtetes Maximum 87 s. An den Lesezeiten 04:02 und 16:00 lag am Wochenende keine Lücke > 60 s. Knappster Feed ist ETH. Logger läuft neu bis Mi 20:00 UTC für die Werktagsnächte |
| 21.09. | Claude Code → Claude Code (Selbstkorrektur) | Ich hatte geschrieben, mit 72 h könnten „bis zu drei Runden offen“ sein, und das klang nach Alltag | Im Saisonlauf kam heraus: Wer die App täglich öffnet, hat **immer nur eine** offene Aufdeckung. Siegeln und Aufdecken passieren im selben Besuch, und die Runde von gestern ist um 16:00 schon aufgelöst (W = 60 s, später geht gar nicht). Drei offene Runden entstehen nur, wenn das Aufdecken zwei Tage in Folge **scheitert** — kein SOL, Absturz, abgebrochene Freigabe | Die 72 h sind trotzdem richtig, aber aus einem anderen Grund als gedacht: Sie retten **die Runden, die man schon gesiegelt hat**, wenn man Tage auslässt. Im Saisonlauf gibt es jetzt eine vierte Gewohnheit (`Late`), die genau diesen Fall fährt und drei Aufdeckungen plus Siegeln in einer Freigabe nachholt |
| 21.09. | Claude Code → Dinkelberg (beim Einarbeiten der freigegebenen Texte) | Vier Stellen, an denen die neue Copy mit der alten Screen-Map kollidiert oder eine Lücke lässt | (1) §2 und §3 nennen durchgehend **12:00 / 00:00 UTC**; richtig sind 16:00–04:00, Referenz 04:02, Ausgang 16:00 — die Frage ist außerdem seit heute die Richtungsfrage. (2) Die Kalibrierungskurve ist in §4 **ab 21** aufgedeckten Runden freigeschaltet, die Übersicherheits-Aussage laut E11 **ab 20**. (3) Was passiert, wenn `p = 50` **und** die Runde knapp ist — welche Zeile gewinnt? (4) Die freigegebenen Texte sagen, **ob** man die Seite getroffen hat, aber nirgends mehr, **was man selbst abgegeben hatte**; §3.4 („You gave Yes a 40% chance“) passt nicht mehr zur Eingabe „Seite + Sicherheit“ | Vorschläge: (1) Zeiten-Sweep durch §2–§5 (mache ich, sobald du die anderen drei beantwortet hast). (2) Beide auf **20** ziehen. (3) **„Too close to call.“ gewinnt** — die Zeile beschreibt die Runde, nicht den Spieler; darunter dann `You didn't pick a side.` als Unterzeile. (4) Eine Zeile im Aufdeck-Moment, die die eigene versiegelte Antwort wörtlich zurückgibt: `You sealed: Fairly sure: Up.` — das ist Astras Punkt („Your memory can change. Your sealed answer cannot.“) und kostet nichts. **Alle vier warten auf dich** |
| 19.09. | Claude Code → Spec/Chat | Spec §3: Der Referenzpreis sei „beim Versiegeln **niemandem** bekannt“ | Mit A = 60 s darf der fixierte Wert bis zu 60 s **vor** Abgabeschluss (04:00) veröffentlicht sein. Wer in der letzten Minute versiegelt, kennt ihn im ungünstigsten Fall; in `reading_age_is_measured_at_submission` ist das getestet | **Behoben 19.09. (Dinkelberg):** Das Siegelfenster bleibt 16:00–04:00, die **Referenz wandert auf 04:02**. `create_round` verlangt `reference_time − A > commit_close`, jeder zulässige Referenzwert ist also nach 04:01 veröffentlicht. Getestet in `no_admissible_reference_was_visible_while_sealing`. Neuer Kalender-Root `fca5712f…`, `Round` 480 B. Copy-Zusage: „The reference is taken after sealing closes. Nobody who sealed could have seen it.“ |
| 18.09. | Claude Code ↔ Chat (offen) | **Chat:** Bei „Bewegung" hat ein Modell den größten Vorsprung, wegen der Basisrate. **Claude Code:** Größter Vorsprung ja, aber aus einem anderen Grund | Die Basisrate halten wir mit Schwellen um 30–70 % ohnehin nahe 50 %. Der eigentliche Vorsprung ist die aktuelle Volatilität (implizite Vola, Ereignistage), und die ist vorhersagbar. Bei Richtung und Vergleich hat niemand einen Vorsprung, auch kein Modell | Wer KI sichtbar machen will, bräuchte eine Linie „aktuelle Volatilität" statt „Basisrate". Das ist in Saison 1 nicht machbar |
| 18.09. | Claude Code → Dinkelberg (**Veto**, Messung) | O1 (b) „erste gültige Einreichung gewinnt, Wert höchstens A s alt“: Der Anspruch trägt nur, wenn die Wahl des Einreichers das Ergebnis praktisch nie dreht | Tage der letzten 90, an denen die zulässige Spanne den Ausgang hätte drehen können (Spanne aus dem Logger, neuer Stack, Takt 5 s; Abstand zur Schwelle aus Coinbase-Minutenkursen): W=10 s/A=10 s → 4 (p50) bis 8 (p90); W=30/A=15 → 6–15; W=60/A=60 → 11–30; W=120/A=60 → 12–32. Pro Saison mit 64 Runden, jeweils p90: SOL 5,7 / 10 / 21, BTC 5,7 / 10,7 / 18, ETH 8,5–19. Nahe null nur, wenn die Spanne unter ~5 bps liegt, also bei W und A ≈ 2–3 s. Dann hat ETH bei A=10 s schon in 61 % der Zeitpunkte keinen zulässigen Wert, und Landen ist praktisch unmöglich | **Bei keinem praktikablen W/A nahe null.** Zeile 1 (Korridor-Veto) war damit richtig. O1 ist entschieden, trägt aber nur mit bezifferter Restunsicherheit im Anspruch (siehe nächste Zeile). Alternative ohne Wahl: „letztes Update vor T“ auf einem Konto mit ~55-s-Takt (ETH neu/0, alle alt/0), ~6 % Verlust pro Zeitpunkt. Für SOL und BTC im neuen Stack (Takt 5 s) geht das nicht. Entscheidung bei Dinkelberg. **Entschieden 19.09. (Dinkelberg):** W = 60 s, A = 60 s. Die Restzahl kommt nicht in den Anspruchssatz; die Orakelfrage bekommt einen eigenen Absatz und eine Belegtabelle im Repo |
| 19.09. | Claude Code → Dinkelberg | „Die Schwankungsbreite fällt seit Monaten“ | Das stimmt über das Jahr, nicht für den letzten Monat. Bei gleicher Schwelle lagen die letzten 30 Tage **höher** als die Tage 31–60: SOL Mo–Fr 1,70 % → 50 % (30 Tage) gegen 32 % (60 Tage), BTC 1,30 % → 50 % gegen 34 %, ETH 1,20 % → 50 % gegen 39 % | Auf 30 Tage geeicht, wie verlangt, mit der Bedingung, dass die 60-Tage-Rate im Band 30–70 % bleibt. Beim Wochenende sind 30 Tage nur n = 8 (±18 Punkte), dort stützt die 60-Tage-Rate. Tabelle unter „Machbarkeit O1“ |
| 19.09. | Claude Code → Dinkelberg | Die Aufdeck-Transaktion des ersten Nutzers nach 16:00 könnte die Ergebnislesung mit einreichen | Technisch billig: `resolve` heute 9 205 CU, +~45 B in einer Transaktion von 640 B, einige Lamports Priority Fee mehr. Die Reihenfolge `resolve → reveal → score_entry` funktioniert in einer Transaktion. **Aber mit W = 60 s zählt nur ein Aufdecken zwischen 16:00:00 und 16:01:00**, und aufgedeckt wird irgendwann zwischen 16:00 und 04:00. Außerdem darf die Transaktion nicht scheitern, wenn die Runde schon aufgelöst ist; dafür bräuchte es ein No-op, gegen Spec „zweiter Aufruf → Fehler“ | **Nicht bauen.** Zweiter Cron für 04:00 **und** 16:00 wie geplant. Unabhängig wird der zweite Einreicher erst mit einem großen W, und das haben wir für die Robustheit ausgeschlossen |
| 18.09. | Claude Code → Chat | Das Höchstalter A wird am Normalabstand von 5 s bemessen | Dokumentierter Herzschlag laut Pyth für SOL, BTC und ETH: 55 s / 0,5 %. Gemessen Fr 15:42–21:49 UTC (6,1 h, noch kein Wochenende), neuer Stack: größter Abstand SOL 16 s, BTC 16 s, ETH 64 s; alter Stack 61 s. Wer den 5-s-Takt von SOL/BTC bezahlt, ist nicht belegt (Stichprobe Fee-Payer `9F6Ap…`, nicht unter den dokumentierten Pyth-Payern) | **A muss am dokumentierten Herzschlag hängen, also A ≥ 60 s**, sonst gibt es keinen zulässigen Wert, sobald der zusätzliche Takt wegfällt. Mit A = 60 s liegt die Spanne pro Zeitpunkt bei p90 22,7 bps (SOL) und 11,6 bps (BTC). Das Höchstalter ist die eigentliche Schwachstelle der Regel. Wochenendmaximum am Mo 21.09. |
| 18.09. | Claude Code → Chat | ANSPRUCH §2: „Die Tests zu den drei Ablehnungen liegen grün im Repo“ | Die Tests für „zeitlich falscher Kurs“ und „günstigerer Kurs“ prüfen die alte Hermes-Regel (`NotFirstAfter`, `BeforeWindow`, `OutsideOracleWindow`). Nur der Test „Zahl nachträglich ändern“ überlebt den Umbau unverändert | Die beiden anderen werden beim Wechsel auf den Schnappschuss neu geschrieben. Grün sind sie heute, nach dem Umbau erst wieder mit neuen Tests |

## Stolpersteine, die zweimal Zeit gekostet haben
- **`cargo test` testet nicht den Quelltext, sondern `target/deploy/observed.so`.** Die Tests laden
  das gebaute Programm per `include_bytes!`. Ohne vorheriges `anchor build` prüft man den alten
  Stand und sieht grüne Tests für eine Änderung, die gar nicht drin ist — beim Konfidenz-Fix am
  21.09. genau so passiert (der Grenzwerttest fiel erst nach dem Build korrekt aus).
  **Immer `anchor build && cargo test`.**
- **Pyth ist kein fester Grund.** Hermes braucht seit 26.08. einen Schlüssel, Pythnet wird
  abgeschaltet, der Emitter hat gewechselt (`G9LV2mp9…` → `6R92oFT…`). Jede Annahme über Pyth wird
  gegen die Doku von heute geprüft, nie gegen Erinnerung.
- **Aufwandsschätzungen im Chat sind keine Messungen.** Zahlen zu Bytes, CUs, Gebühren und
  Freigaben kommen aus `docs/spikes/`, sonst stehen sie nicht in Dokumenten.
- **Aufwandsschätzungen in Stunden bitte als Spanne** mit der teuersten bekannten Unbekannten
  benannt — Dinkelberg rechnet sie erfahrungsgemäß nach unten.
- **UI-Texte**: `CLAUDE.md` verlangt sie wörtlich aus `docs/03-SCREEN-MAP.md`. Neue Texte liegen
  zuerst in `docs/COPY-NEUE-TEILE.md` und müssen von dort nach 03 wandern, bevor sie in Code gehen.

## Codex-Teilscan (Revision `35f0cfe`, Hauptrepo) — triagiert am 21.09. von Claude Code

**Worauf Codex geschaut hat:** `35f0cfe` ist der Drehbuch-Commit im **Hauptrepo** vom 21.09.,
11:37 — aktuell genug. Der Fund „Resolver unter `services/resolver/`“ war **kein Irrtum**: Dort lag
tatsächlich noch eine **zweite, alte Kopie** des Resolvers (Stand `2983077` vom 18.09., also vor
O1, mit Hermes-`pyth.ts`). Die drei hohen Funde beschreiben diese Kopie korrekt. Sie ist jetzt
**gelöscht** (`git rm -r services/resolver`); der Resolver lebt ausschließlich in
`observedsol-blip/observed-resolver`, docs/02-TECH-STACK.md und docs/resolver-interface.md sagen das.

| # | Fund (Codex) | Urteil | Stand |
|---|---|---|---|
| 1 | Round-Offsets falsch | **gilt — und galt auch im echten Resolver** | Nicht nur die alte Kopie: Der laufende Worker las `Round` noch an den 486-Byte-Offsets, obwohl das Konto mit `close_after_secs`/`earliest_close_unix` auf 498 B gewachsen war. Behoben `10ab6ac` (Resolver-Repo), Fixtures neu, Decode-Test pinnt beide neuen Felder |
| 2 | Enge Ablese-Crons | **schon behoben** | Die alte Kopie hatte nur den stündlichen Lauf. Aktuell: zwei enge Crons (`1 4 * * *`, `59 15 * * *`), Backoff, zweiter RPC-Anbieter, 21 Tests (`d0116af`) |
| 3 | Hermes-Update-Konten | **entfallen** | Mit O1 postet der Resolver nichts mehr und hat keinen Pyth-Schlüssel; `pyth.ts` gab es nur in der alten Kopie |
| a | Rundung an der Oracle-Konfidenzgrenze | **gilt** | `conf * 10 000 / price` schnitt ab und öffnete das letzte Basispunkt-Stück: eine Lesung mit 50,9 bps kam durch eine 50-bps-Schranke. Jetzt Kreuzmultiplikation ohne Division, exakt. Test `confidence_bound_is_exact_at_the_edge` prüft genau an der Kante: `conf` = Schranke (angenommen), +1 (abgelehnt), −1 (angenommen). 46/46 grün |
| b | Zugangsdaten in Spike-Logs oder Historie | **nichts gefunden** | Beide Repos, **ganze Historie** (`git grep` über `git rev-list --all`) auf RPC-Keys, QuickNode/Alchemy-Pfade, Telegram-Bot-Token, `ghp_`/`github_pat_`, PEM-Blöcke und 64-Byte-Schlüsselarrays: **0 Treffer**. Die zwei Beinahe-Treffer sind harmlos: `keystorePassword` steht nur in dem README-Satz, der belegt, dass es nie committet wurde; `api-key=` nur in der Zeile des Loggers, die den Key **maskiert**, bevor er ins Log geht. Auch im Arbeitsbaum (inkl. ignorierter Spike-Logs) keine Datei mit einem echten Key. Signaturen und Konto-Fixtures sind öffentliche Daten. **Es muss nichts rotiert und nichts bereinigt werden** |
| c | `/__scheduled` ohne Schutz | **gilt** | Jeder hätte Läufe auslösen und damit Gebühren der Hot Wallet verbrennen können. Jetzt: ohne `KICK_TOKEN` gibt es den Weg **gar nicht** (404, auch kein Hinweis darauf); mit Secret nur mit `?key=…`, konstantzeitiger Vergleich. Im Drehbuch überall nachgezogen |
| d | Deterministische Programmfehler erneut gesendet | **gilt, mit einer Einschränkung** | Stimmt für strukturelle Fehler (falscher Feed, falsches Konto, falscher Status) — die scheitern identisch und fraßen das Fenster. **Nicht** stimmt es für die fünf datenabhängigen (`TooEarly`, `NotFullyVerified`, `StaleReading`, `NonPositivePrice`, `ConfidenceTooWide`): Die müssen weiter wiederholt werden, weil das nächste Update des Sponsors sie auflöst. Genau so umgesetzt, zwei Tests |
| e | Gescheiterte Ablesung als gesunder Lauf gemeldet | **teils** | Der Fehlerfall war schon richtig (Fenster zu → `runFailed` + Backlog-Alarm). Still war der Fall **„nichts fällig“** — und in der Saison ist zur Lesezeit immer etwas fällig, das heißt also Kalender, Uhr oder Chain-Sicht ist kaputt. Jetzt Alarm statt Schweigen |
| f | Berechtigungen der Agenten zu breit | **gilt, zwei Zeilen** | Siehe unten |

**Zu f), konkret.** Zu breit sind genau zwei Einträge in `.claude/settings.json`:
- `Bash(npm install*)` — führt beliebige `postinstall`-Skripte aus dem Netz aus, ohne Nachfrage, auf
  der Maschine, auf der `~/.config/observed/` liegt. Das ist der breiteste Weg nach innen.
  Vorschlag: raus aus der Erlaubnisliste (oder `npm ci --ignore-scripts`).
- `Bash(gh pr create*)` — veröffentlicht Repo-Inhalt, ohne dass jemand gefragt wird. Kommt selten
  vor und ist eine Nachfrage wert. Vorschlag: raus.

Nicht zu breit, obwohl es so aussieht: `git add`/`git commit` (kein `git push` in der Liste — Pushen
fragt), `solana airdrop` (geht nur auf Devnet), `cargo`/`anchor`-Aufrufe.
**Eine echte Lücke ist die Form der Verbotsliste:** `Read(~/.config/observed/**)` gilt nur für das
Lese-Werkzeug, nicht für `Bash(cat …)`. Heute fängt das die Erlaubnisliste ab (`cat` steht nicht
drin, fragt also), und der Hook `guard-paths.sh` deckt Edit/Write ab — aber ein später ergänztes
`Bash(cat*)` würde die Sperre aushebeln. Vorschlag: `Bash(cat ~/.config/observed/**)`,
`Bash(cat ~/.config/solana/**)` und dieselben mit `Bash(head/tail/strings …)` explizit in `deny`.
**Entscheidung liegt bei Dinkelberg** — ich ändere die Berechtigungen nicht selbst.

## Teil A der Bewertungsrunde — Machbarkeit, gemessen am 21.09. (Claude Code)

Antwort auf `claude/AUSWERTUNG-2026-09-21.md`. **Nichts gebaut**, nur gemessen. Rohdaten:
`spikes/baserate/direction.mjs`, `spikes/baserate/eventdays.mjs`,
`programs/observed/tests/capacity.rs`.

**A1 — Richtungsfrage.** Die vorhandene Frageart reicht: `KIND_ABOVE` mit `offset_bps = 0`
entscheidet `outcome > reference`, strikt, Gleichstand = Nein. Es braucht **keine neue Frageart**.
Blockiert wird es heute von einer einzigen Zeile in `validate()`: `band_bps < |offset_bps|` — mit
Schwelle 0 unerfüllbar. **Korrektur an der Auftragsformulierung:** Das Programm verlangt **nicht**
das Vierfache des Messbands, sondern nur `Band < Schwelle`; die Vierfach-Regel ist eine
Entscheidung vom 19.09. in den Dokumenten, nicht im Code. Mit Band 25 bps wäre die kleinste heute
zulässige Schwelle also 26 bps, nicht 100.
Gemessen (Coinbase-Stundenkerzen, 04:00→16:00 UTC, 364 Tage):

| Feed | Ja-Quote 365 T | Ja-Quote 90 T | „knapp“ (≤ 25 bps) 365 T | knapp Werktag | knapp Wochenende |
|---|---|---|---|---|---|
| SOL | 47,3 % | 54,4 % | 10,4 % | 8,5 % | 15,2 % |
| BTC | 48,9 % | 58,9 % | 19,2 % | 12,0 % | **37,1 %** |
| ETH | 48,6 % | 62,2 % | 15,1 % | 11,2 % | 24,8 % |

Längste Serie derselben Seite: SOL 6, BTC 8, ETH 7 Tage. Das Messband 25 bps bleibt richtig — es
beschreibt die Messunschärfe, nicht die Schwelle —, aber es trifft bei Schwelle 0 **jede achte bis
zehnte Runde am Werktag** und am Wochenende jede vierte bis dritte. BTC am Wochenende ist
unbrauchbar (37 %); es fällt dort ohnehin schon aus dem Kalender.

**A2 — Ereignistage im Zeitraum (Quellen: federalreserve.gov, bls.gov).** Nur fünf Termine liegen
in der Saison (gemessener Tag = Tag des Ausgangs):

| Runde | Tag | Ereignis | Uhrzeit UTC | im Messfenster? |
|---|---|---|---|---|
| 7 | Fr 02.10. | US-Arbeitsmarktbericht | 12:30 | ja |
| 19 | Mi 14.10. | US-CPI | 12:30 | ja |
| 34 | Do 29.10. | **Tag nach** dem FOMC-Beschluss (28.10., 18:00 UTC) | — | Beschluss fällt ins **Siegelfenster** |
| 42 | Fr 06.11. | US-Arbeitsmarktbericht | 13:30 (EST) | ja |
| 46 | Di 10.11. | US-CPI | 13:30 (EST) | ja |

**Wichtig:** Der FOMC-Beschluss um 18:00 UTC liegt **nach** dem Ausgang um 16:00 und damit in
keinem Messfenster. Ein FOMC-„Ereignistag“ ist bei uns immer der **Folgetag**, und gesiegelt wird
mit bereits bekanntem Beschluss. Das muss die Kontextzeile sagen, sonst ist sie falsch.
Ereignistage bewegen sich messbar stärker (Stichprobe: die 12 Arbeitsmarkt-Freitage des letzten
Jahres gegen 247 andere Werktage, Median |Bewegung|): BTC 1,75 % gegen 1,06 %, ETH 2,04 % gegen
1,34 %, SOL 1,78 % gegen 1,50 %. **SOL reagiert kaum** — für Ereignisrunden taugen BTC und ETH.
Bei Schwelle 1,7 % lägen BTC und ETH an solchen Tagen bei 50 % (n = 12, Hinweis, keine Rate).
**Bestätigt:** Die Kontextzeile steht **nicht** im Hash — der Terms-Hash enthält keinen Text,
nur Regelwerte. Sie kann app-seitig hinterlegt und später korrigiert werden.

**A3 — längeres Aufdeckfenster: das ist eine Programmänderung, keine Kalenderänderung.**
`reveal_close = outcome_time + REVEAL_WINDOW_SECS` mit `REVEAL_WINDOW_SECS` als **Konstante**
(lib.rs:60); die Länge steht weder in den Bedingungen noch im Hash. Nach der Regel aus E10
entfällt E10 damit — es sei denn, es fährt in derselben einen Änderung mit.
Gemessen (`capacity.rs`), Größe einer echten Transaktion:

| Aufdeckungen | nur mit Siegeln | + zwei Memos (32 B / 140 B) |
|---|---|---|
| 1 | 588 B | 799 B |
| 2 | 702 B | 913 B |
| 3 | 816 B | **1 027 B** |
| 4 | 930 B | 1 141 B |
| 5 | 1 044 B | **1 255 B — zu groß** |

Grenze 1 232 B. **Drei offene Runden plus Siegeln plus beide Memos passen, vier auch; bei fünf
reißt es.** Rechenkosten unkritisch: Siegeln 28 868 CU, Aufdecken 16 032 CU, drei Aufdeckungen
plus Siegeln rund 77 000 CU gegen 1,4 Mio. je Transaktion. **Empfehlung: 72 h.** Damit sind höchstens
drei Runden offen (passt), zwei ausgelassene Abende kosten keinen vollen Fehlschlag, und die
tägliche Transaktion bleibt eine. 36 h würde nur einen späten Abend verzeihen.
Was sich verschiebt: Missing-Wertung und die vollständige Crowd-Verteilung kommen drei Tage
später (relevant für die Zahlen auf der Deck-Folie), `close_entry` verschiebt sich um 60 h —
irrelevant, weil der Boden 09.11. ohnehin später liegt. Auflösen, Absagen und Scoring bleiben
unberührt.

**A4 — bestätigt.** Ein ausgelassenes **Siegel** taucht nirgends im Saisonwert auf. Ohne `commit`
gibt es kein `Entry`; `score_entry` scheitert dann an `AccountNotInitialized`, und `Player` wird
nicht angefasst — weder `commits`, `reveals`, `missing_scored`, `scored_rounds` noch `score_sum`.
Getestet in `rounds_without_a_seal_leave_no_trace_in_the_record`. Bestraft wird nur, wer siegelt
und dann nicht aufdeckt. „Serie statt Pflicht“ trägt.

## E1 + E10 umgesetzt — 21.09.2026 (eine Änderung, ein Deploy)

**Programm** (zwei Stellen, kein Layoutwechsel, `Round` bleibt 498 B, **Resolver unverändert**):
- `REVEAL_WINDOW_SECS` 12 h → **72 h**. Kein neues Feld: `reveal_close` steht ohnehin in jeder
  Runde und ist damit pro Runde nachprüfbar (Entscheidung Dinkelberg, 21.09.).
- `validate()`: Die Richtungsfrage ist `KIND_ABOVE` mit `offset_bps = 0`. Dafür gilt
  `band_bps ≤ MAX_DIRECTION_BAND_BPS` (100) statt `band_bps < |offset_bps|`. **Für
  Bewegungsfragen ändert sich nichts**, `offset_bps = 0` bleibt dort `BadOffset`.

**Kalender** (neu erzeugt, Root `5ae91bdab786e6a040ba91664223a03ff4f85f57474606ded064dff780d08c89`):
59 Richtungsrunden, fünf Bewegungsrunden an den Ereignistagen (7 ETH, 19 BTC, 34 BTC, 42 BTC,
46 ETH, je 1,7 %), Wochenenden nur SOL, Kontextzeile je Ereignisrunde (Anzeige, **nicht im Hash**).

**Tests** (alle grün: 50 Programmtests + Saisonlauf + 2 Messtests, clippy leer, Resolver 21/21):
- `a_direction_round_is_decided_by_the_side_alone` — eine Einheit höher = Ja, eine tiefer = Nein,
  **Gleichstand = Nein**, Schwelle = Referenzpreis.
- `a_direction_round_decided_by_one_unit_lands_inside_the_band` — 10 bps Bewegung: Ja, aber
  `|margin| ≤ band`, also „Too close to call“.
- `create_round_refuses_unknown_or_unsafe_terms` +1 Fall: Richtungsrunde mit Band 101 → `BadBand`.
- `one_approval_reveals_every_open_round_and_seals_today` — drei Aufdeckungen + Siegeln in **einer**
  Transaktion, 74 596 CU.
- `after_seventy_two_hours_a_missing_reveal_still_costs_everything` — der Schutz steht.
- `calendar_fixture_matches_program` prüft jetzt die Mischung: 59 Richtungsrunden, genau fünf
  Ereignistage an ihren echten Daten, Wochenenden nur SOL.
- **Saisonlauf auf Tagesmechanik umgebaut**: Uhr läuft strikt vorwärts über 68 Tage — 16:00 Ausgang
  von gestern, 16:05 die eine Freigabe je Gerät (Aufdecken + Siegeln in einer Transaktion), 04:02
  Referenz, drei Tage später die Missing-Wertung. Ergebnis: 62 aufgelöst, 2 NO_RESOLVE, **genau
  eine knappe Runde** (vorher waren 29 ein Artefakt des Testskripts), 1 070 Einträge, größter
  Tagesstapel 3 Aufdeckungen + 1 Siegel, 1 070 Einträge rollierend geschlossen, 2,324 SOL zurück.

**Offen daraus:** `docs/00-SPEC.md` beschreibt noch das alte Aufdeckfenster und die alte Frageart.
Die Datei ist gesperrt — Vorschlag 16 liegt in `docs/spec-changes-2026-09-17.md`, geändert wird sie
erst mit `.spec-unlock`.

## Offen — mit Besitzer
| # | Was | Wer | Bis |
|---|---|---|---|
| 1 | Kompatibilitätstest — **erledigt 19.09. (41ca39b):** Build mit `pro-compatible`, liest die Konten des neuen Stacks (Test mit echtem Mainnet-Konto `7AviUf…` grün), alte werden abgelehnt | Claude Code | erledigt |
| 2 | Wochenendauswertung — **erledigt 21.09.:** aus dem Ledger rekonstruiert (der Logger war am Sa 01:27 UTC gestorben). Größte Lücke Sa+So: SOL 10 s, BTC 66 s, ETH 87 s; an den Lesezeiten 04:02/16:00 keine Lücke > 60 s. **A = 60 s bleibt** | Claude Code | erledigt |
| 3 | NO_RESOLVE pro Saison — **erledigt 21.09.:** Aus der Feed-Seite **null**: Eine Runde geht erst verloren, wenn eine Lücke das ganze Ablesefenster überdeckt (> 117 s = 60 s Alter + 55 s Nachversuche); beobachtetes Maximum in 4 Tagen inkl. Wochenende 87 s (ETH). Das verbleibende Risiko ist der Resolver selbst, nicht der Feed — dagegen Backoff + zweiter RPC-Anbieter (Test `d0116af`) | Claude Code | erledigt |
| 4 | Alt- oder Neu-Empfänger — **erledigt 19.09.:** neu, umgesetzt zusammen mit O1 (41ca39b) | Claude Code | erledigt |
| 5 | **Schnitt für den 26.09. bestätigen** (siehe „App 22.–25.09.“ unten). Dazu Spike 3 T2 auf dem Seeker an diesem Wochenende: eine oder zwei Freigaben für Aufdecken+Siegeln in einer Transaktion. Davon hängt die teuerste Unbekannte der App-Woche ab | Dinkelberg | So 20.09. |
| 6 | Kernablauf auf dem Seeker, einmal durchgespielt über einen echten Tageswechsel | Dinkelberg | vor 28.09. |
| 7 | `.spec-unlock` anlegen, wenn 00-SPEC geändert werden muss | Dinkelberg | bei Bedarf |
| 8 | Offline-Schlüssel + Hot Wallet erzeugen, Cloudflare/Helius/healthchecks einrichten, **Mainnet-Deploy bis Do 24.09.** (SGT gibt es nur auf Mainnet, fremde Tester ab 27.09. brauchen Mainnet) | Dinkelberg | Do 24.09. |
| 9 | Expo-Token erneuern (stand im Chat). **Pyth-Key wird nicht mehr gebraucht**: Der Resolver liest nur noch das gesponserte Konto, kein Hermes, kein Schlüssel | Dinkelberg | sofort |
| 10 | Zweiter RPC-Anbieter für die Ablese-Läufe: Konto anlegen, dann `wrangler secret put RPC_URL_FALLBACK`. Vorschlag **QuickNode** (eigenes Netz, eigene Firma, kostenloser Solana-Endpunkt) als Zweiten; **Helius** bleibt der Erste. Dritter Rückfall ohne Konto ist `api.mainnet-beta.solana.com` — gedrosselt, aber besser als nichts | Dinkelberg | vor Do 24.09. |
| 14 | Vier Copy-Fragen aus dem Einarbeiten der freigegebenen Texte (Zeiten-Sweep, 20 statt 21 Runden, Vorrang bei knapp + keine Seite, Rückgabe der eigenen versiegelten Antwort im Aufdeck-Moment) — siehe Korrekturtabelle 21.09. | Dinkelberg | vor dem Build 26.09. |
| 13 | `.spec-unlock` für 00-SPEC: Frageart (Richtung statt Bewegung) und Aufdeckfenster (72 h statt 12 h) stehen dort noch alt. Vorschlag 16 ist geschrieben | Dinkelberg | vor der Einreichung |
| 12 | Berechtigungen der Agenten: `Bash(npm install*)` und `Bash(gh pr create*)` aus der Erlaubnisliste nehmen, Bash-Verbote für `~/.config/observed/**` und `~/.config/solana/**` ergänzen (Begründung im Codex-Abschnitt) | Dinkelberg | vor Do 24.09. |
| 11 | Frage an die Veranstalter: Darf der Resolver (eigenes Repo, nicht Teil der Einreichung) während der Bewertung geändert werden? Bis zur Antwort plant das Drehbuch mit **nein** | Dinkelberg | offen |

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
