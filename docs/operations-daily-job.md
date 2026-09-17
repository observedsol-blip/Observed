# Braucht Observed einen Server? — Analyse des täglichen Jobs (17.09.2026)

Analyse, kein Code. Grundlage: das fertige Programm (`programs/observed`, 25 Tests grün) und Spike 1 (`docs/spikes/pyth.md`). Die Frage des Owners: **Was passiert an einem Tag, an dem der Job ausfällt — trägt die permissionless-Eigenschaft das, oder steht die Runde still?** Das entscheidet, ob wir überhaupt einen Server brauchen, besonders für November, wenn die Jury allein spielt.

## Was täglich passieren muss
| Schritt | Wer darf | Zeitfenster | Abhängigkeit |
|---|---|---|---|
| `create_round` | **jeder** (mit Merkle-Beweis) | vor `commit_open` | nur Kalenderdaten, **keine** Oracle-Daten |
| `commit` | Spieler | 00:00–12:00 UTC | Runde muss existieren |
| `set_reference` | **jeder** | ab 12:00 UTC bis `resolve_deadline` (= T+24 h) | ein Pyth-Update mit `publish_time` in [12:00, 12:01] |
| `resolve` | **jeder** | ab 24:00 UTC bis `resolve_deadline` | Referenz gesetzt + Pyth-Update in [24:00, 24:01] |
| `reveal` | Spieler | 00:00–12:00 UTC des Folgetags | — |
| `score_entry` | **jeder**, idempotent | nach `resolve`; Missing erst nach `reveal_close` | — |

## Der entscheidende Punkt: die Fenster sind großzügig, die Daten historisch
`set_reference` und `resolve` prüfen die **`publish_time` des Updates**, nicht wann die Transaktion läuft. Ein Update von 12:00:00 ist um 22:00 genauso gültig wie um 12:05. Hermes liefert die Historie (Spike 1: 30 Tage am Stück abgefragt, 0 Lücken).

**Folge:** Ein ausgefallener Job ist kein sofortiger Verlust. Die Runde ist erst verloren, wenn **bis T+24 h niemand** postet — also bis 24 Stunden nach dem Ereignis, insgesamt rund 36 Stunden Reaktionszeit ab 12:00.

## Was ein Ausfall konkret bedeutet
| Ausfall | Wirkung | Rettbar bis |
|---|---|---|
| `create_round` fehlt | **härtester Fall:** ohne Runde kein Commit. Der Tag fällt für alle aus, auch für Spieler, die die App öffnen. | vor 12:00 (danach lohnt die Runde nicht mehr) |
| `set_reference` fehlt | Commits liegen, niemand ist gescored. Reveal ist trotzdem möglich (Reveal hängt nicht an der Auflösung). | T+24 h |
| `resolve` fehlt | wie oben; ohne Referenz **und** Ergebnis endet die Runde als NO_RESOLVE | T+24 h |
| beides fehlt dauerhaft | `cancel_round` → NO_RESOLVE. **Getestet** (`no_resolve_leaves_commits_unscored`): Score, Missing-Zähler und Summe bleiben 0, der Commit bleibt als Zahl sichtbar, die Miete kommt zurück. Niemand gewinnt oder verliert etwas. | — |
| `score_entry` fehlt | Record hinkt hinterher, bis irgendwer scored; der Wert ändert sich dadurch nicht (idempotent, Missing = 2 500 fix) | jederzeit |

## Trägt der erste App-Nutzer des Tages die Runde?
Teilweise — und genau hier ist der Haken:
- **`create_round`: ja, technisch.** Braucht nur den Kalender (liegt im Repo und auf der Kalenderseite) und ~0,0025 SOL Miete. Kein Oracle, keine API.
- **`set_reference`/`resolve`: nein, praktisch nicht.** Der Poster braucht (a) die signierten Pyth-Daten und damit **seit 26.08.2026 einen eigenen Pyth-API-Key** oder unseren Proxy, (b) zwei Transaktionen mit voller Verifikation (Spike 1) und damit mehrere Wallet-Freigaben, (c) etwas SOL. Das ist nichts, was ein Spieler nebenbei tut, und es ist ausdrücklich **nicht** Teil der täglichen Geste (Spec §5).

Der Proxy ist also so oder so nötig, sobald die App das Posten anbieten soll. Und wenn ohnehin ein Host läuft, kostet der Cron darauf fast nichts.

## Empfehlung
0. **Vor dem Anlegen prüft der Owner die erzeugte Datei** (`docs/generated/CALENDAR-season1.md`, 64 Zeilen mit Datum, Feed und Offset-Regel). Die Datei zeigt **keine Schwelle in Dollar** — es gibt keine: Sie entsteht erst um 12:00 UTC aus dem Referenzpreis (Regel `Referenz × (1 + offset/10 000)`). Geprüft werden also Datum, Feed und Offset. Anlegen tut der Owner, nicht Claude.

1. **Alle 64 Runden der Saison vorab anlegen**, am Starttag, in einem Rutsch. `create_round` prüft nur die Reihenfolge der `round_id`, nicht ob die Vorrunde fertig ist — 64 Runden sind also am Tag 0 anlegbar. Kosten: **64 × 0,00248 SOL ≈ 0,16 SOL** Miete (einmalig, bleibt gebunden). Damit fällt der gefährlichste Ausfall (kein Commit möglich) für die gesamte Saison weg, auch wenn Server, Laptop und Owner im November offline sind.
2. **Resolver betreiben** — stündlich, nicht zu festen Uhrzeiten: `services/resolver` (Cloudflare Worker, Workers Paid). Er ist nur noch für die *Auflösung* zuständig, nicht mehr für die Existenz des Spiels. Durchsatz, Retry-Verhalten und Totmann-Schalter stehen in `services/resolver/README.md`.
3. **Nachhol-Lauf statt Alarmkette:** Der Cron prüft bei jedem Lauf die letzten 48 Stunden und holt fehlende `set_reference`/`resolve` nach. Ein verpasster Slot heilt sich damit beim nächsten Lauf von selbst.
4. **Alert erst, wenn eine Runde jünger als T+24 h noch offen ist** — das ist der einzige Moment, in dem Handeln nötig ist.
5. **App-Knopf „Post the reading" optional**, liest die Daten über den Proxy. Kein Muss, aber er macht die Behauptung „permissionless" überprüfbar und rettet einen Tag, an dem der Cron hängt.
6. **Kein Multisig für den Hackathon** (Owner-Entscheidung): Upgrade-Autorität bleibt ein einzelner, offline liegender Schlüssel. Das gehört so in SECURITY.md, ehrlich benannt, statt Multisig zu behaupten.

## Eine Runde zurückziehen oder neu formulieren
Der **Fragetext steht nicht on-chain und nicht im Hash** — er wird im Client aus Feed und Offset erzeugt; eine reine Wortlaut-Änderung braucht also gar keinen Chain-Eingriff. Muss dagegen die **Regel** einer bereits angelegten Runde weg (falscher Feed, falscher Offset), lässt sie sich nicht ersetzen: Die Runde läuft in NO_RESOLVE (nach `resolve_deadline` `cancel_round` aufrufen, niemand wird gescored), und die korrigierte Regel kann erst in der nächsten Saison mit neuer Merkle-Wurzel erscheinen.

## Kosten des Job-Schlüssels (Hot Wallet, noch nicht anlegen)
- Oracle-Posting: 2 × 21 409 Lamports pro Runde ≈ **0,0000428 SOL/Tag** (Spike 1, inkl. Priority Fee und Schließen der Konten).
- `create_round` einmalig: ≈ 0,16 SOL Miete für 64 Runden (kommt beim Schließen nicht zurück, die Runden bleiben).
- `score_entry` für Missing-Einträge: reine Transaktionsgebühr, ≈ 5 000 Lamports je Aufruf.
- **Empfohlene Ausstattung: 0,3 SOL**, getrennt von allem anderen, rotierbar, keine Autorität im Programm.

## Was die Jury im November sieht, wenn niemand danebensitzt
- Runden existieren (vorab angelegt) → Commit und Reveal funktionieren **ohne jeden Server**.
- Ergebnisse erscheinen, solange der Cron lebt. Stirbt er, wird nach 36 Stunden aus der Runde ein sichtbares NO_RESOLVE — unschön, aber ehrlich und im UI vorgesehen.
- Das Schlimmste, was ein Totalausfall anrichtet: eine Kette von NO_RESOLVE-Tagen ohne Scores. Kein falscher Score, kein Datenverlust, keine hängende Antwort.

## Offen / zu entscheiden
- **Hosting des Cron und des Proxys** (ein kleiner Node-Service, 02-TECH-STACK nennt Fly/Railway/Cloud Run). Muss bis 25.09. stehen.
- **Vorab-Anlegen bestätigen:** 0,16 SOL gebundene Miete gegen Ausfallsicherheit für 64 Tage. Ich empfehle es.
- **Pyth-Plan:** Der Key läuft bis 27.11. durch; Testphase und Kosten prüfen (offen seit Spike 1).
