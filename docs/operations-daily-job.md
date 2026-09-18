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
2. **Resolver betreiben** — stündlich, nicht zu festen Uhrzeiten: `observedsol-blip/observed-resolver` (Cloudflare Worker, Workers Paid; Schnittstelle: `docs/resolver-interface.md`). Er ist nur noch für die *Auflösung* zuständig, nicht mehr für die Existenz des Spiels. Durchsatz, Retry-Verhalten und Totmann-Schalter stehen im README des Resolver-Repos.
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

---

# Betrieb während der Code-Sperre (09.10.–10.11.2026)

Randbedingung: Nach der Einreichung am 08.10. wird am eingereichten Stand nichts mehr geändert.
Der Resolver liegt deshalb in einem eigenen Repository und darf in dieser Zeit betrieben und
repariert werden. Alles, was ihn stoppen könnte, muss **vor dem 08.10.** abgesichert sein.

## Was du vor dem 08.10. selbst tun musst
| # | Aufgabe | Warum |
|---|---|---|
| 1 | **Pyth: Ablaufdatum des Keys im Pyth Terminal nachsehen und notieren.** Liegt es vor dem 11.11., vor dem 08.10. entscheiden: Starter-Plan (500 $/Monat, laut app.pyth.com/plans) für Oktober/November buchen, oder eine andere Lösung (siehe unten). | Ohne gültigen Key gibt es keine Referenz und kein Ergebnis — jede Runde endet nach 36 h in NO_RESOLVE. Wie lange die Testphase läuft und was danach passiert, steht nirgends öffentlich (Recherche 18.09., UNVERIFIED). Der Free-Plan enthält laut Planseite **keinen** API-Zugang. |
| 2 | **Hot Wallet mit 1,4 SOL befüllen** (Rechnung unten). | deckt 45 Tage schlechtesten Fall mal zwei, inklusive verwaister Pyth-Konten |
| 3 | **Cloudflare: Workers Paid aktiv, Zahlungsmittel gültig bis Ende November.** | Bei Zahlungsausfall stuft Cloudflare nach 5 Tagen auf Free herab — dort hat ein Cron-Lauf 10 ms CPU und 50 Subrequests, der Worker scheitert dann still. |
| 4 | **Helius:** Free-Plan reicht (siehe Rate-Limits); Mainnet-Endpunkt als `RPC_URL`-Secret. | |
| 5 | **Telefon-Alarm:** healthchecks.io → Integration **Telegram** (kostenlos, 5 Minuten: Bot hinzufügen, `/start`, Link bestätigen) an **beide** Checks hängen. Einmal mit `/fail` testen. | Cloudflare hat keine eingebauten Cron-Alarme. SMS/WhatsApp gibt es bei healthchecks.io erst im Business-Plan. |
| 6 | **Notfall-Laptop vorbereiten:** Resolver-Repo geklont, `npm install`, `.dev.vars` mit denselben Secrets (lokal, nie im Repo), einmal `npm run dev` + `curl localhost:8787/__scheduled` gegen Devnet durchgespielt. | Damit läuft derselbe Code von Hand, falls Cloudflare ausfällt. |

## Guthaben des Cron-Schlüssels — schlechtester Fall
Annahmen: 71 Spieler, Priority Fee am Deckel des Resolvers (1 000 000 µLamports/CU), jede Transaktion
landet erst im vierten Versuch (Obergrenze von `sendWithRetry`), Compute-Limit voll ausgeschöpft.

| Posten pro Tag | Rechnung | Lamports |
|---|---|---|
| Referenz + Ergebnis posten | 2 Postings × 2 Tx × (200 000 CU × 1 µL + 10 000 Basis) × 4 Versuche | 3 360 000 |
| `score_entry` | 8 Tx à 10 Einträge × (130 000 CU × 1 µL + 5 000) × 4 | 4 320 000 |
| `cancel_round` (selten) | 1 Tx × (20 000 + 5 000) × 4 | 100 000 |
| **Summe ohne Sonderfall** | | **7 780 000 ≈ 0,0078 SOL** |
| Verwaiste Pyth-Konten | landet die Schließ-Transaktion nicht, bleiben Encoded VAA + Price Update gebunden: 3 698 240 je Fall, angenommen 2 pro Tag | 7 396 480 |
| **Summe schlechtester Fall** | | **≈ 0,0152 SOL** |

- × 45 Tage × 2 Reserve: **0,70 SOL** ohne, **1,37 SOL** mit verwaisten Konten. → **1,4 SOL einzahlen.**
- Normalbetrieb (Spike 1, Fee 1 000 µL/CU): ≈ 0,0001 SOL pro Tag. Die 1,4 SOL reichen real also für Jahre.
- Je 100 zusätzliche Spieler: + ≈ 0,006 SOL pro Tag im schlechtesten Fall.
- **Vorschlag, nicht umgesetzt:** Alarmschwelle von 0,05 auf 0,3 SOL anheben — das sind rund 20 Tage Vorlauf selbst im schlechtesten Fall. Die Zahl steht im Resolver-Repo und ist dort jederzeit änderbar; ich ändere sie erst nach deinem Okay, weil du 0,05 festgelegt hast.

## Rate-Limits unter Dauerlast
- **Helius Free:** 1 Mio. Credits/Monat, 10 Anfragen/s, `sendTransaction` 1/s, `getProgramAccounts` 5/s (10 Credits je Aufruf). Der Resolver braucht pro Lauf seit der Umstellung zwei `getProgramAccounts` (Runden, alle ungescorten Einträge in **einem** Aufruf) statt bis zu 65, plus einzelne Lese- und Sendeaufrufe: rund 80 Credits pro Lauf, **≈ 60 000 im Monat — 6 % des Kontingents.** Sendungen sind auf eine pro 1,1 s gedrosselt. Was bei erschöpftem Kontingent passiert: UNVERIFIED.
- **Pyth Hermes:** höchstens zwei Anfragen pro Lauf. Beobachtet (Spike 1): 429 erst bei etwa 15 Anfragen in 4 s. Harte Limits für Keys sind laut Doku vertraglich, nicht technisch.

## Wenn Cloudflare einen Lauf verschluckt
Cloudflare dokumentiert für Cron Triggers **keine** Zustellgarantie (UNVERIFIED, ob Läufe ausfallen, sich verspäten oder doppelt kommen). Das Design hängt nicht daran:
- **Aufholen:** Jeder Lauf leitet aus dem Chain-Zustand ab, was zu tun ist. Ein verschluckter Lauf wird vom nächsten erledigt, solange die Runde noch in ihrem Fenster ist (bis T+24 h — rund 36 Stunden ab 12:00).
- **Doppelt:** Die Instruktionen sind idempotent; ein zweiter Lauf erntet nur „skipped".
- **Erkennen:** Der Check RUN (Periode 1 h, Grace 90 min) schlägt an, wenn zwei Läufe hintereinander fehlen oder drei scheitern. Einzelne Aussetzer lösen bewusst keinen Alarm aus.

## Notfallplan: Der Dienst steht am 23. Oktober
**Erlaubt** (berührt den eingereichten Stand nicht):
- alles im Resolver-Repo: Fehler beheben, neu deployen, Secrets wechseln (Pyth-Key, RPC-URL, Hot Wallet);
- Hot Wallet aufladen;
- den Resolver vom Notfall-Laptop laufen lassen (`npm run dev`, `curl …/__scheduled`) — derselbe Code, dieselben permissionless Instruktionen;
- einzelne `set_reference`/`resolve`/`score_entry` von Hand auslösen.

**Nicht erlaubt:** App-Update, Programm-Upgrade, Änderungen im Hauptrepo nach dem Tag `submission-2026-10-08`, Kalender ändern.
**Nicht tun, obwohl möglich:** `pause` — es blockiert das Versiegeln für alle, auch für die Jury.

**Ablauf:**
1. Telegram-Alarm lesen: RUN (Dienst läuft nicht) oder BACKLOG (läuft, aber etwas hängt oder das Guthaben ist knapp).
2. Ursache im Cloudflare-Dashboard (Past Cron Events, letzte 100) oder mit `npm run tail` finden:
   - Pyth `401`/`403` → Key erneuern oder Plan prüfen, Secret neu setzen.
   - RPC `429` oder Credit-Fehler → anderen Endpunkt als `RPC_URL` setzen.
   - Guthaben unter der Schwelle → aufladen.
   - Code-Fehler → im Resolver-Repo beheben, `npm run deploy`.
   - Cloudflare selbst gestört → Resolver vom Laptop laufen lassen, bis es wieder geht.
3. Frist beachten: Eine Runde ist bis **T+24 h** rettbar. Danach wird sie NO_RESOLVE — niemand wird gewertet, das ist ehrlich und im UI vorgesehen, aber vermeidbar.
4. Nach der Reparatur einen Lauf manuell anstoßen und im Log prüfen, dass Referenz, Ergebnis und Scores nachgezogen wurden.

## Offene Entscheidung: Pyth nach der Testphase
Falls der Key vor dem 11.11. ausläuft, gibt es drei Wege, keiner davon ist heute entschieden:
1. **Starter-Plan für einen Monat buchen** (500 $). Einfach, sicher, teuer.
2. **Pyth um einen Hackathon-/Ökosystem-Zugang bitten** (Solana-Mobile-Hackathon, Pyth ist dort vertreten). Ausgang offen.
3. **Die von Pyth selbst aktualisierten Push-Feeds auf Solana nutzen** (Programm `pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT`). Das Programm akzeptiert jedes voll verifizierte `PriceUpdateV2`-Konto des Receivers; ob ein Push-Feed-Konto zur richtigen Sekunde ein Update mit `prev_publish_time < T ≤ publish_time ≤ T+60` trägt und wie der Resolver es rechtzeitig konsumiert, ist **ungeprüft** und müsste vor dem 02.10. als Spike laufen. Kein Programm-Umbau nötig, aber Timing-Risiko.
