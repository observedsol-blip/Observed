# Spike: eine ganze Runde von Ende zu Ende (20.09.2026)

Frage: Arbeiten Programm und Resolver zusammen — Referenz, Auflösung, Aufdecken, Scoring — bevor
echtes Geld und fremde Tester daran hängen?

## Aufbau
Lokaler `solana-test-validator` statt Devnet (Faucet limitiert, Wallet ~1 SOL zu knapp für den
Deploy). Geladen wird dabei:
- die **echten Mainnet-Bytes** des gesponserten SOL/USD-Kontos (`7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE`,
  neuer Stack, Owner `rec2HH…`), nur der `publish_time` ins Testfenster verschoben — ein lokaler
  Validator hat keinen Pyth-Sponsor, das Konto würde sonst nie aktualisiert;
- die **echten SGT-Fixtures** (Mint, Gruppe, Token-Konto mit Test-Besitzer) aus `tests/fixtures/sgt/`.

Gefahren wird die Runde von `spikes/e2e/prepare.mjs` (Konten und Zeitplan) und
`spikes/e2e/drive.mjs` (Owner- und Spielerschritte). Die Resolver-Schritte macht der **echte
Worker** über `wrangler dev`, angestoßen mit dem jeweiligen Cron-Muster — also derselbe Code, der
ab Donnerstag läuft.

## Ergebnis
| Schritt | Ergebnis |
|---|---|
| `initialize`, `publish_calendar`, `create_round` (Terms v3, 64 Blätter) | ok |
| `commit` mit echten SGT-Bytes | ok |
| `set_reference` durch den Worker | ok, nach zwei fehlgeschlagenen Versuchen im Fenster |
| `resolve` durch den Worker | ok im ersten Versuch |
| `reveal` (p = 65 %) | ok |
| `score_entry` im Kehrlauf | ok |

Endzustand der Runde: `Resolved`, Ausgang **Nein**, `outcome_margin_bps` −200 bei `band_bps` 25
(also nicht knapp), Eintrag gescored mit 4 225 = Brier 0,4225, Spieler 1 Siegel / 1 Aufdecken /
1 gewertet. Die Lesung trägt Pyths echten `posted_slot` 448 731 708, dazu Einreichungs-Slot,
Clock-Zeit und Einreicher — genau das, was die Belegtabelle später braucht.

## Befund, der den Spike gerechtfertigt hat
Der erste Durchlauf verlor die Referenz: `sendWithRetry` wartet auf die Bestätigung, **bis der
Blockhash abläuft** (hier ~60 s). Damit verbrennt ein einziger Versuch das gesamte 60-Sekunden-
Fenster, und die Runde wäre NO_RESOLVE geworden. In Unit-Tests ist das unsichtbar.
Behoben im Resolver (`sendOnce`, 9c92944): senden, höchstens 8 s auf Bestätigung warten, dann
neuer Versuch mit frischem Blockhash. Eine spät landende Transaktion schadet nicht — das Programm
lehnt die zweite Lesung ab. Im zweiten Durchlauf hat genau dieser Pfad gegriffen: zwei Versuche
scheiterten, die Runde war danach referenziert, der Lauf erkannte „jemand anders war schneller"
und beendete sich sauber.

## Grenzen dieses Spikes
- Der lokale Validator hat keinen Sponsor: Beide Lesungen stammen aus demselben eingefrorenen
  Update, deshalb ist die Bewegung 0 und der Ausgang zwangsläufig Nein.
- Getestet ist ein Fenster von 60 s bei einem Höchstalter von 300 s (auf Mainnet: 60 s).
- Devnet steht aus: Der neue Pyth-Stack ist dort vorhanden (SOL, BTC, ETH auf Shard 0), aktualisiert
  aber nur etwa alle **313 s** — eine Devnet-Probe braucht deshalb größere Werte für Fenster und
  Höchstalter als Mainnet.

## Wiederholen
```
node spikes/e2e/prepare.mjs <dir> <player-pubkey> <sol-feed.json>   # Konten + Zeitplan
solana-test-validator --reset --account … <dir>/*.json              # Validator mit den Konten
solana program deploy target/deploy/observed.so -u l
node spikes/e2e/drive.mjs setup|commit|reveal|show <dir>
curl "localhost:8787/__scheduled?cron=1+4+*+*+*"                    # Leselauf Referenz
curl "localhost:8787/__scheduled?cron=59+15+*+*+*"                  # Leselauf Ergebnis
curl "localhost:8787/__scheduled?cron=0+*+*+*+*"                    # Kehrlauf: Scoring
```
