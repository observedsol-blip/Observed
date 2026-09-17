# observed-resolver — Cloudflare Worker, ein Lauf pro Stunde

Der Dienst hält die Auflösung am Laufen. Er hat **keine Befugnis im Programm**: Sein Schlüssel ist
Gebührenzahler und wird als Poster protokolliert, mehr nicht (siehe unten).

## Was ein Lauf tut
Ein Cron-Lauf (`0 * * * *`) liest den Chain-Zustand und arbeitet mit **Zeitbudget (60 s)** in dieser
Reihenfolge ab, bis das Budget aufgebraucht ist:

1. **fehlende Referenz** — Runde `Open`, `now ≥ commit_close`, vor `resolve_deadline`
2. **fehlende Auflösung** — Runde `Referenced`, `now ≥ outcome_time`, vor `resolve_deadline`
3. **fällige `cancel_round`** — unaufgelöst nach `resolve_deadline` (NO_RESOLVE wird ausgesprochen, nicht ausgesessen)
4. **`score_entry`**, gebündelt zu 10 Instruktionen pro Transaktion, so viele wie ins Budget passen

Es gibt keinen separaten „Nachhol-Modus": Was zu tun ist, ergibt sich aus dem Zustand. Ein
ausgefallener Lauf heilt beim nächsten. **Und es gibt keinen Zeitschnitt:** Eine Runde bleibt auf
der Arbeitsliste, bis sie aufgelöst oder storniert **und** jeder Eintrag gescored ist. Ein
vergessener Eintrag wäre eine nicht gezahlte Missing-Strafe und dauerhaft gebundene Miete
(Review 18.09.2026). Ältere Runden zuerst, damit ein Rückstand abfließt.

**Idempotenz** kommt ebenfalls aus dem Zustand: Eine bereits referenzierte Runde lehnt
`set_reference` mit `RoundNotOpen` ab, eine gescorte `Entry` lehnt `score_entry` mit `AlreadyScored`
ab. Solche Ablehnungen zählt der Lauf als „skipped", nicht als Fehler.

## Durchsatz (Rechnung, nicht gemessen — vor dem 25.09. auf Devnet nachmessen)
| Aktion | Transaktionen | ~Dauer inkl. Bestätigung |
|---|---|---|
| `set_reference` / `resolve` (Pyth-Posting + Konsum + Close) | 2 | ~4–6 s |
| `cancel_round` | 1 | ~2 s |
| `score_entry` ×10 (eine Tx, ~130 000 CU) | 1 | ~2 s |

Ein 60-Sekunden-Lauf schafft damit realistisch: zwei Oracle-Aktionen (~10 s) **und** rund
**20–25 Score-Transaktionen**, also **200–250 gescorte Einträge**. Bei 71 Spielern ist eine Runde
in ~8 Transaktionen (~16 s) vollständig gescored.

**Rückstand von 24 Stunden** (1 Runde: Referenz + Auflösung + 71 Scores) ist damit in **einem
einzigen Lauf** abgearbeitet, nicht in Stunden. Selbst ein Ausfall von einer Woche (7 Runden,
~500 Einträge) braucht rechnerisch zwei bis drei Läufe — der Engpass ist dann nicht das Budget,
sondern das 36-Stunden-Fenster: Runden, die älter sind, sind bereits NO_RESOLVE und werden nur
noch abgeschlossen.

## Transaktionen bei Stau
- **Priority Fee dynamisch:** Median der letzten Fees der betroffenen Konten × 1,5, begrenzt auf
  1 000 … 1 000 000 µLamports; fällt die RPC-Abfrage aus, wird das Minimum genommen statt aufzugeben.
- **Compute-Budget explizit** pro Transaktion (Scoring: 13 000 CU je Eintrag).
- **Abgelaufener Blockhash:** Die Transaktion wird pro Versuch **neu gebaut** (neuer Blockhash, neue
  Fee), maximal 4 Versuche mit wachsender Pause; danach `SendFailed` → `/fail`-Ping.
- **Programm-Ablehnungen** (`AnchorError`, „already in use") werden sofort als „skipped" behandelt,
  nicht wiederholt.

## Totmann-Schalter
Zwei Checks bei healthchecks.io (kostenlos):
- **RUN** — Ping bei jedem Lauf (`/start`, Ende, `/fail`). Periode 1 h, Grace 90 min: Drei
  fehlgeschlagene Läufe oder ein toter Worker lösen die Mail von selbst aus.
- **BACKLOG** — Ping nur, wenn nichts hängt. `/fail` bei: Runde länger als 12 h unaufgelöst, oder
  **Guthaben unter 0,05 SOL**. Ein Dienst, der nur wegen leerer Kasse steht, darf nicht still stehen.

## Tests
`npm test` dekodiert ein `Entry`, das **das Programm selbst** serialisiert hat
(`tests/fixtures/generated/entry-layout.json`, erzeugt vom Rust-Test `entry_layout_fixture`), mit den
Offsets aus `src/chain.ts`. Wer die Rust-Struktur umsortiert, bekommt hier einen roten Test statt
eines stillen Fehlverhaltens im Betrieb.

## Secrets (nur als Worker Secrets, nie im Repo, nie im Log)
```
wrangler secret put PYTH_API_KEY
wrangler secret put HOT_WALLET_KEY            # base58 secret key, nur Gebührenzahler
wrangler secret put RPC_URL                   # Helius mainnet bzw. devnet
wrangler secret put HEALTHCHECK_RUN_URL
wrangler secret put HEALTHCHECK_BACKLOG_URL
```
`GAME_ID` steht als normale Variable in `wrangler.toml`. Geloggt werden nur Runden-ID, Aktion und
gekürzte Signatur; Hermes-Fehler werden ohne Body ausgegeben, weil der Body den Key zurückwerfen kann.

## Plattform
- **Workers Paid nötig.** Free-Plan: 10 ms CPU pro Cron-Lauf — zu wenig zum Signieren und für die
  VAA-Verifikation. Paid mit Intervall ≥ 1 h: 15 min CPU, 10 000 Subrequests.
- `nodejs_compat` ist gesetzt (web3.js, Buffer).

## Betrieb
```
npm install
npm run typecheck
npm run dev            # wrangler dev --test-scheduled, dann: curl localhost:8787/__scheduled
npm run deploy
npm run tail           # Live-Logs
```
Reihenfolge vor dem Start: **erst Worker mit Devnet-Testlauf, dann Kalender anlegen** (Owner).

## Befugnisse des Schlüssels (geprüft im Programmcode)
`set_reference` und `resolve` nehmen einen beliebigen Signer und speichern ihn nur als
`referencer`/`resolver`; `score_entry` und `cancel_round` haben gar keinen Signer. Autoritäten gibt
es nur bei `publish_calendar` (calendar_authority), `pause` (pause_authority) und beim Upgrade —
alle drei bleiben beim Offline-Schlüssel. Wer diesen Hot-Wallet-Schlüssel stiehlt, kann Evidenz
posten (das darf ohnehin jeder) und die paar SOL ausgeben. Nichts weiter.
