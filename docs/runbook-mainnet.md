# Drehbuch: Mainnet-Start am 24.09.2026 und Betrieb bis zum 27.11.

Für Dinkelberg. Alles, was hier steht, tippst **du**; Claude Code fasst Mainnet, Schlüssel und
Secrets nicht an. Reihenfolge einhalten — jeder Schritt hat eine Prüfung, und jeder hat einen
Ausweg, falls er scheitert.

## 0. Vorher, am Mittwoch
| Prüfung | Sollwert |
|---|---|
| SOL auf dem Offline-Schlüssel | **5,5 SOL** (Spitzenbedarf 5,06; siehe §4) |
| Hot Wallet des Resolvers | **0,5 SOL** (Verbrauch der ganzen Saison < 0,1 SOL, siehe §5) |
| Cloudflare | Workers Paid aktiv, Zahlungsmittel gültig bis Ende November |
| Helius | Mainnet-Endpunkt bereit (`RPC_URL`) |
| healthchecks.io | zwei Checks (RUN, BACKLOG), Telegram verbunden, einmal mit `/fail` getestet |
| Repo | `docs/generated/CALENDAR-season1.md` gelesen — das sind die 64 Fragen der Saison |

Die Kalender-Wurzel dieser Saison lautet
`c40a35486e1485f08d3f61a87e1eeff55cbab1d526f84675473f2f6adb1345b7`.
Sie steht auch in `tests/fixtures/calendar/season1.json` und wird in Schritt 3 on-chain gesetzt.

## 1. Programm bauen und deployen (≈ 20 min)
```
cd ~/observed
# 1a. Offline-Schlüssel eintragen: DEPLOY_AUTHORITY in programs/observed/src/lib.rs
#     (der compile_error! darüber wird dabei gelöscht — ohne das baut der Mainnet-Build nicht)
anchor build -- --features mainnet
solana program deploy target/deploy/observed.so \
  --program-id target/deploy/observed-keypair.json \
  --url mainnet-beta --keypair <offline-key>
```
**Prüfen:** `solana program show <PROGRAM_ID> --url mainnet-beta` zeigt Program-ID, Authority und
Datenlänge. Program-ID muss `48YybyMgkdzPQN5R3V1xsFHkUMxDvBDBDwW48cRTx2ni` sein, sonst passen IDL
und Resolver nicht.

**Wenn es scheitert:** Ein abgebrochener Deploy hinterlässt einen Buffer mit ~2,4 SOL darin.
```
solana program show --buffers --url mainnet-beta          # zeigt die Adresse
solana program close --buffers --url mainnet-beta         # holt die SOL zurück
```
Danach neu versuchen. Erst wenn `solana program show` das Programm zeigt, weiter.

## 2. Config anlegen
`initialize` akzeptiert **nur** den Offline-Schlüssel als Payer (`DEPLOY_AUTHORITY`), damit der
Deploy-Tag kein Wettrennen ist.
**Prüfen:** Das Config-Konto existiert, `calendar_authority` und `pause_authority` sind deine
Adressen, `paused` ist false.
**Wenn es scheitert mit „already in use":** Jemand war schneller — das kann nur passieren, wenn der
Offline-Schlüssel kompromittiert ist. Dann: nicht weitermachen, neue `game_id` nehmen.

## 3. Kalender veröffentlichen
`publish_calendar(season = 1, root = c40a3548…, leaf_count = 64)`.
**Prüfen:** `Config.calendar_root` ist die Wurzel oben, `first_round_id = 0`, `max_round_id = 63`.
**Wenn die Wurzel falsch ist:** sofort anhalten. Eine falsche Wurzel lässt sich **nicht** ersetzen,
solange die Saison läuft. Dann neue `game_id`, Schritte 2–3 wiederholen.

## 4. Alle 64 Runden anlegen
`create_round` ist permissionless, die Runden werden vorab angelegt, damit ein toter Cron niemanden
am Siegeln hindert. 64 Transaktionen, ~0,004 SOL Miete je Runde.
**Prüfen:** `Config.next_round_id == 64`; Runde 0 hat `commit_open` = 24.09. 16:00 UTC.

**Kosten am Donnerstag, gemessen:**
| Posten | SOL | kommt zurück |
|---|---|---|
| Programmdaten (Miete) | 2,392 | nein, erst bei `program close` |
| Buffer während des Deploys | 2,392 | ja, automatisch |
| Config | 0,002 | nein |
| 64 Runden | 0,274 | nein (Runden sind nicht schließbar) |
| Gebühren | ~0,001 | – |
| **Spitze** | **≈ 5,06** | |
| **gebunden danach** | **≈ 2,67** | |

## 5. Resolver scharf schalten
```
cd ~/observed-resolver
wrangler secret put HOT_WALLET_KEY        # base58, nur Gebührenzahler
wrangler secret put RPC_URL               # Helius mainnet
wrangler secret put HEALTHCHECK_RUN_URL
wrangler secret put HEALTHCHECK_BACKLOG_URL
npm run deploy
curl "https://<worker>/__scheduled"       # Kehrlauf von Hand, muss die 64 Runden sehen
```
**Prüfen:** Die Ausgabe nennt `rounds: 64 total`, und healthchecks.io meldet RUN als „up".
Am 25.09. um 04:03 UTC prüfen: Runde 0 steht auf `Referenced`. Um 16:01 UTC: `Resolved`.

**Gebühren bis 27.11., aus den gemessenen CU:** `set_reference` 10 471 CU, `resolve` 11 016 CU,
`score_entry` ~11 900 CU je Eintrag (10 pro Transaktion). Selbst pessimistisch — jede Lesung
braucht sechs Versuche, vier Scoring-Transaktionen am Tag, Priority Fee am Deckel von
1 000 000 µLamports/CU — kostet die ganze Saison **≈ 0,07 SOL**. Im ruhigen Fall unter 0,01 SOL.
**0,5 SOL im Hot Wallet sind rund das Siebenfache des schlechtesten Falls.** Alarmschwelle 0,05 SOL
(anhebbar, siehe unten).

## 6. Was du ab dem 08.10. tun darfst — ohne Code anzufassen
Nach der Einreichung ist der Stand im Hauptrepo eingefroren. Erlaubt und ohne Codeänderung möglich:

| Fall | Was du tust |
|---|---|
| Hot Wallet wird leer (BACKLOG-Alarm) | SOL überweisen. Sonst nichts. |
| RPC zickt (429, Timeouts) | `wrangler secret put RPC_URL` mit anderem Anbieter, dann `npm run deploy` **des unveränderten Stands** — das ist keine Codeänderung |
| Pyth-Schlüssel | entfällt, der Resolver hat keinen |
| Worker hängt | `npm run deploy` erneut (gleicher Code) oder im Dashboard „Redeploy" |
| Ein Lauf ist ausgefallen | nichts tun. Der nächste Kehrlauf holt Scoring und `cancel_round` nach. Eine **Lesung** ist nicht nachholbar: Die Runde wird NO_RESOLVE, das ist ein vorgesehener Zustand |
| Alarm quittieren | auf healthchecks.io pausieren/fortsetzen; der Alarm ist eine Information, keine Aktion |
| Runde hängt trotzdem | `curl "https://<worker>/__scheduled"` von Hand anstoßen |
| Alles hängt, Cloudflare ist das Problem | Resolver vom Notfall-Laptop: `npm run dev`, dann `curl "localhost:8787/__scheduled?cron=1+4+*+*+*"` zur Referenzzeit und `…cron=59+15+*+*+*` zur Ergebniszeit |

**Nicht erlaubt:** App-Update, Programm-Upgrade, Änderungen im Hauptrepo nach dem Tag
`submission-2026-10-08`, Kalender ändern.
**Nicht tun, obwohl möglich:** `pause` — es blockiert das Siegeln für alle, auch für die Jury.

## 7. Wenn etwas kaputtgeht, das nur mit Code zu reparieren wäre
Beispiel: ein Fehler im Resolver, der jede Lesung verpasst.
1. **Erst prüfen, ob es wirklich Code ist.** Die sechs häufigen Störungen sind getestet und heilen
   von selbst (`test/disturbance.test.ts` im Resolver-Repo): verlorene Transaktion, später Cron,
   429, jemand anders war schneller, zwei Läufe, Absturz beim Scoring.
2. **Der Resolver liegt in einem eigenen Repo** (`observedsol-blip/observed-resolver`) und ist
   **nicht Teil des eingereichten Stands**. Ein Fix dort berührt die Einreichung nicht. Das war der
   Grund für die Trennung. Also: reparieren, deployen, im HANDOFF vermerken.
3. **Wäre der Fehler im Programm**, geht gar nichts: Ein Upgrade änderte das Verhalten der
   eingereichten Version. Dann bleibt nur, die betroffenen Runden als NO_RESOLVE laufen zu lassen
   und es im Deck zu benennen. Deshalb ist die ganze Saison vorher im Zeitraffer durchgespielt
   (`programs/observed/tests/season.rs`).
4. **Wäre der Fehler in der App**, ebenfalls nichts: kein Update bis zum 10.11. Die Tester behalten
   den Build vom 26.09.

## 8. Tägliche Sichtprüfung (30 Sekunden)
- 04:05 UTC: Runde des Tages steht auf `Referenced`.
- 16:05 UTC: Runde steht auf `Resolved`, `outcome_margin_bps` gesetzt.
- Telegram still = alles in Ordnung. RUN-Alarm = Dienst tot. BACKLOG-Alarm = Guthaben oder Rückstand.
