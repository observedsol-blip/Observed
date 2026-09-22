# Welche Pyth-Feeds die Regel O1 tatsächlich bestehen

Gemessen am 22.09.2026 von Claude Code, auf dem Mitschnitt des Loggers vom Mainnet. Nur lesend,
nichts an eine Kette geschickt. Die Tabelle unten ist die unveränderte Ausgabe von
`spikes/pyth-sponsored/o1.mjs`.

## Warum es diese Datei gibt

`docs/sponsored-feeds.md` beantwortet, welche Preise zu unseren Ablesezeiten **existieren**.
Diese Datei beantwortet die andere Frage: **welche davon unser Programm auch annimmt.** Das ist
nicht dasselbe, und der Unterschied ist groß genug, um eine Frage zu verderben — DSOL/USD sieht
in der alten Tabelle mit einem Takt von ~50 s brauchbar aus und besteht hier zu **5 %**, weil
seine Konfidenz fast immer über unserer Grenze liegt.

## Was genau gemessen wird

Die Regel steht in `programs/observed/src/lib.rs:538-575` (`accept_reading`):

- der Einreichungszeitpunkt `now` muss in `[T, T + window_secs]` liegen (**W = 60 s**),
- die Lesung muss `publish_time >= now - max_age_secs` erfüllen (**A = 60 s**),
- `verification_level` muss `Full` sein,
- `conf / price <= max_conf_bps / 10 000` (**50 bps**).

**W begrenzt die Einreichung, nicht `publish_time`.** Eine Lesung ist bei T also genau dann zu
haben, wenn irgendein brauchbares Update `publish_time` in `[T − 60, T + 60]` hat: eines ab T
reicht (Alter 0), und eines bis zu 60 s vor T reicht auch (dann wird bei T eingereicht). Ein
Zeitpunkt T fällt damit nur innerhalb einer Lücke von **mehr als 120 s** durch, und auch dann nur
für `Lücke − 120` Sekunden. Die Trefferquote ist

```
1 − Σ max(0, Lücke − 120) / beobachtete Zeit
```

wobei nur Updates zählen, die `Full` sind und die Konfidenzgrenze halten.

## Was die Zahl nicht sagt

Sie sagt, dass ein annehmbarer Preis da ist — nicht, dass der Resolver ihn holt. Ausfälle des
Resolvers, des RPC-Anbieters oder des Workers stecken nicht darin; dagegen stehen die drei
Anbieter und die Alarme.

## Die Datengrundlage

Der Mitschnitt stammt von `spikes/pyth-sponsored/logger.mjs`, das alle 513 gesponserten Konten
alle 5 s abfragt und zusätzlich per Websocket mithört, und eine Zeile je beobachteter Änderung
schreibt. Der verwendete Lauf deckt **26,2 h in zwei Stücken** ab:

| von | bis | Dauer |
|---|---|---|
| 2026-09-18 11:09 UTC | 2026-09-18 23:27 UTC | 12,3 h |
| 2026-09-21 10:06 UTC | 2026-09-22 00:01 UTC | 13,9 h |

Dazwischen liegt kein Feed-Ausfall, sondern ein abgestürzter Logger (Samstag 01:27 UTC, neu
gestartet am Montag). Das Skript schneidet jede Lücke im Herzschlag über 300 s heraus und lässt
keine Feed-Lücke über einen Schnitt reichen. Ohne das erscheint ein zweitägiger Logger-Absturz
als zweitägiger Ausfall in **jedem** Feed — der erste Durchlauf hat genau das getan und für alle
100 Konten 27 % ausgewiesen.

**Zwei Werktage, kein Wochenende.** Für SOL, BTC und ETH ist das Wochenende getrennt belegt
(Rekonstruktion aus dem Ledger, 21.09.2026): größte Lücke Sa+So SOL 10 s, BTC 66 s, ETH 87 s —
alle unter 120 s, also auch am Wochenende 100 %. Für **jeden anderen Feed in dieser Tabelle ist
das Wochenende nicht gemessen.** Wer einen davon in den Kalender nimmt, misst ihn vorher.

## Nur der aufgerüstete Stack

`programs/observed/Cargo.toml:29` setzt `pyth-solana-receiver-sdk` fest auf `pro-compatible`.
Das Binary prüft damit den Besitzer `rec2HH…` und kann die Konten des alten Stacks gar nicht
lesen — sie würden mit `AccountOwnedByWrongProgram` abgelehnt. Feeds, die es nur auf `alt/1`
gibt (ADA, AVAX, BNB, DOGE, LINK, LTC, SUI, TON, XRP, Gold, Devisen, US-Aktien), stehen deshalb
nicht zur Wahl, egal wie gut ihr Takt ist.

## Ergebnis in einem Satz

Rund **30 Feeds** erreichen ≥ 99,99 %, alle rund um die Uhr, alle in Pyths eigener Liste mit
Pyth als Pfleger: neben SOL, BTC und ETH unter anderem JUP, BONK, WIF, JTO, PYTH, TRUMP,
FARTCOIN, HYPE, ZEC, RENDER, W, AAVE, WBTC, MET, TNSR, MNDE, JLP, PUMP, BNSOL, JITOSOL.
**HNT (40,9 %) und RAY (44,4 %) fallen durch**, und nicht knapp — ein Update alle 270–300 s
bedeutet, dass rund die Hälfte aller Runden in NO_RESOLVE endete. Dieselbe Klasse: PENGU, ORCA,
POPCAT, GOAT, KMNO, CBBTC, MON, USDG.

## Reproduzieren

```sh
# 1. mitschreiben (läuft, bis man es beendet; ~35 MB pro Stunde)
node spikes/pyth-sponsored/logger.mjs            # schreibt log.jsonl

# 2. auswerten
node spikes/pyth-sponsored/o1.mjs log.jsonl              # Textausgabe
node spikes/pyth-sponsored/o1.mjs log.jsonl --md         # die Tabelle unten
node spikes/pyth-sponsored/o1.mjs log.jsonl --stack both # auch der alte Stack
```

Der Mitschnitt selbst liegt **nicht** im Repo: der ausgewertete Lauf ist 150 MB groß. Er ist
Rohdatenmaterial, kein Ergebnis — das Ergebnis steht hier.

## Die Messung

    watched 26.2 h in 2 stretch(es):
      2026-09-18 11:09 -> 2026-09-18 23:27  (12.3 h)
      2026-09-21 10:06 -> 2026-09-22 00:01  (13.9 h)
    stack=new, 100 accounts, W=60 A=60 maxConf=50 bps


| Feed | Takt p50/p90/max (s) | Lücken > 120 s | verworfen | O1-Trefferquote |
|---|---|---|---|---|
| Crypto.2Z/USD | 52 / 54 / 87 | 0 | 0 | 100.0000 % |
| Crypto.AAVE/USD | 52 / 54 / 116 | 0 | 0 | 100.0000 % |
| Crypto.BNSOL/USD | 52 / 54 / 95 | 0 | 0 | 100.0000 % |
| Crypto.BONK/USD | 52 / 54 / 95 | 0 | 0 | 100.0000 % |
| Crypto.BTC/USD | 5 / 8 / 67 | 0 | 0 | 100.0000 % |
| Crypto.CASH/RD.RR | 31 / 33 / 89 | 0 | 0 | 100.0000 % |
| Crypto.CASH/USD | 31 / 33 / 89 | 0 | 0 | 100.0000 % |
| Crypto.ETH/USD | 52 / 54 / 95 | 0 | 0 | 100.0000 % |
| Crypto.HYPE/USD | 5 / 8 / 67 | 0 | 0 | 100.0000 % |
| Crypto.INF/SOL.RR | 52 / 54 / 84 | 0 | 0 | 100.0000 % |
| Crypto.JITOSOL/SOL.RR | 52 / 54 / 116 | 0 | 0 | 100.0000 % |
| Crypto.JITOSOL/USD | 52 / 54 / 116 | 0 | 0 | 100.0000 % |
| Crypto.JLP/USD | 52 / 54 / 105 | 0 | 1 | 100.0000 % |
| Crypto.JTO/USD | 52 / 54 / 88 | 0 | 0 | 100.0000 % |
| Crypto.JUPSOL/SOL.RR | 52 / 54 / 95 | 0 | 0 | 100.0000 % |
| Crypto.MET/USD | 52 / 54 / 87 | 0 | 0 | 100.0000 % |
| Crypto.MEW/USD | 52 / 54 / 95 | 0 | 0 | 100.0000 % |
| Crypto.MNDE/USD | 52 / 54 / 104 | 0 | 1 | 100.0000 % |
| Crypto.MSOL/SOL.RR | 52 / 54 / 116 | 0 | 0 | 100.0000 % |
| Crypto.NAV.ACRED/USD | 52 / 54 / 95 | 0 | 0 | 100.0000 % |
| Crypto.NAV.ONYC/USD | 5 / 7 / 78 | 0 | 0 | 100.0000 % |
| Crypto.NAV.USCC/USD | 52 / 54 / 84 | 0 | 0 | 100.0000 % |
| Crypto.NBASIS/USD.RR | 52 / 54 / 84 | 0 | 0 | 100.0000 % |
| Crypto.NFALCON/USD.RR | 58 / 59 / 116 | 0 | 0 | 100.0000 % |
| Crypto.NOPAL/USD.RR | 52 / 54 / 84 | 0 | 0 | 100.0000 % |
| Crypto.PST/USDC.RR | 5 / 7 / 78 | 0 | 0 | 100.0000 % |
| Crypto.PUMP/USD | 52 / 54 / 69 | 0 | 0 | 100.0000 % |
| Crypto.RENDER/USD | 52 / 54 / 88 | 0 | 0 | 100.0000 % |
| Crypto.RKUSOL/SOL.RR | 52 / 54 / 116 | 0 | 0 | 100.0000 % |
| Crypto.SOL/USD | 5 / 7 / 67 | 0 | 0 | 100.0000 % |
| Crypto.SSOL/SOL.RR | 52 / 54 / 95 | 0 | 0 | 100.0000 % |
| Crypto.SYRUPUSDC/USDC.RR | 52 / 54 / 95 | 0 | 0 | 100.0000 % |
| Crypto.TNSR/USD | 52 / 54 / 116 | 0 | 0 | 100.0000 % |
| Crypto.USD1/USD | 52 / 54 / 87 | 0 | 0 | 100.0000 % |
| Crypto.USDC/USD | 5 / 8 / 78 | 0 | 0 | 100.0000 % |
| Crypto.USDE/USD | 52 / 54 / 116 | 0 | 0 | 100.0000 % |
| Crypto.USDT/USD | 52 / 54 / 95 | 0 | 0 | 100.0000 % |
| Crypto.W/USD | 52 / 54 / 105 | 0 | 0 | 100.0000 % |
| Crypto.WBTC/USD | 52 / 54 / 95 | 0 | 0 | 100.0000 % |
| Crypto.ZEC/USD | 5 / 8 / 37 | 0 | 0 | 100.0000 % |
| Crypto.WIF/USD | 52 / 54 / 121 | 1 | 0 | 99.9987 % |
| Crypto.TRUMP/USD | 52 / 54 / 121 | 1 | 0 | 99.9987 % |
| Crypto.PYTH/USD | 52 / 54 / 121 | 1 | 0 | 99.9987 % |
| Crypto.FARTCOIN/USD | 52 / 54 / 121 | 1 | 0 | 99.9987 % |
| Crypto.JUP/USD | 52 / 54 / 121 | 1 | 1 | 99.9987 % |
| Crypto.DSOL/SOL.RR | 52 / 54 / 126 | 1 | 0 | 99.9923 % |
| Crypto.NALPHA/USD.RR | 52 / 54 / 126 | 1 | 0 | 99.9923 % |
| Crypto.JUPUSD/USD | 52 / 54 / 126 | 1 | 0 | 99.9923 % |
| Crypto.EURC/USD | 52 / 54 / 126 | 1 | 0 | 99.9923 % |
| Crypto.SYRUPUSDC/USD | 52 / 54 / 126 | 1 | 0 | 99.9923 % |
| Crypto.CLOUD/USD | 52 / 54 / 296 | 4 | 70 | 99.7202 % |
| Crypto.NAV.USTB/USD | 52 / 54 / 371 | 1 | 7 | 99.6778 % |
| Crypto.LBTC/USD | 58 / 59 / 175 | 7 | 34 | 99.6586 % |
| Crypto.NWISDOM/USD.RR | 52 / 54 / 423 | 2 | 21 | 99.5649 % |
| Crypto.MSOL/USD | 52 / 54 / 429 | 6 | 28 | 99.3096 % |
| Crypto.BSOL/USD | 52 / 54 / 577 | 11 | 58 | 97.7147 % |
| Crypto.INF/USD | 52 / 54 / 756 | 13 | 83 | 97.6704 % |
| Crypto.HYUSD/JITOSOL.RR | 58 / 59 / 793 | 27 | 345 | 92.6758 % |
| Crypto.XSOL/JITOSOL.RR | 58 / 59 / 809 | 27 | 369 | 92.3809 % |
| Equity.US.GLXY/USD | 52 / 54 / 2314 | 9 | 385 | 91.7364 % |
| Crypto.AVAX/USD | 134 / 134 / 134 | 1 | 0 | 89.5522 % |
| Crypto.ORE/USD | 53 / 105 / 905 | 79 | 489 | 89.4658 % |
| Crypto.EHYUSD/JITOSOL.RR | 58 / 59 / 12329 | 3 | 7 | 84.6618 % |
| Crypto.ZBTC/USD | 52 / 54 / 10769 | 7 | 323 | 84.1436 % |
| Crypto.USX/USD | 240 / 270 / 293 | 292 | 0 | 54.2378 % |
| Crypto.USDS/USD | 270 / 295 / 299 | 283 | 0 | 45.7770 % |
| Crypto.KMNO/USD | 270 / 270 / 319 | 287 | 0 | 44.5824 % |
| Crypto.EUSX/USX.RR | 270 / 270 / 320 | 288 | 0 | 44.4085 % |
| Crypto.PENGU/USD | 270 / 270 / 320 | 288 | 0 | 44.4073 % |
| Crypto.RAY/USD | 270 / 270 / 320 | 288 | 0 | 44.4073 % |
| Crypto.SUSDE/USD | 270 / 270 / 320 | 288 | 0 | 44.4073 % |
| Crypto.ORCA/USD | 270 / 270 / 311 | 287 | 0 | 44.4026 % |
| Crypto.CBBTC/USD | 270 / 270 / 324 | 287 | 0 | 44.3975 % |
| Crypto.DBR/USD | 270 / 270 / 320 | 288 | 0 | 44.3925 % |
| Crypto.GOAT/USD | 270 / 270 / 320 | 288 | 0 | 44.3925 % |
| Crypto.MON/USD | 270 / 270 / 320 | 288 | 0 | 44.3925 % |
| Crypto.POPCAT/USD | 270 / 270 / 320 | 288 | 0 | 44.3925 % |
| Crypto.USDG/USD | 270 / 270 / 297 | 288 | 0 | 44.3441 % |
| Crypto.HNT/USD | 295 / 299 / 301 | 259 | 0 | 40.9482 % |
| Crypto.HYUSD/USD.RR | 295 / 295 / 8382 | 236 | 0 | 36.5182 % |
| Crypto.AMZNX/USD | 600 / 602 / 603 | 28 | 0 | 20.0000 % |
| Crypto.PAXG/USD | 600 / 602 / 899 | 27 | 0 | 19.6364 % |
| Crypto.WETH/USD | 600 / 601 / 899 | 27 | 0 | 19.6364 % |
| Crypto.MSTRX/USD | 603 / 870 / 870 | 54 | 0 | 16.4384 % |
| Crypto.XBTC/USD | 540 / 1625 / 3780 | 103 | 186 | 15.9928 % |
| Crypto.PYUSD/USD | 184 / 1195 / 1210 | 80 | 0 | 14.0953 % |
| Crypto.SPYX/USD | 870 / 870 / 7765 | 54 | 0 | 13.8616 % |
| Crypto.AAPLX/USD | 602 / 881 / 8022 | 59 | 0 | 12.9751 % |
| Crypto.NVDAX/USD | 602 / 870 / 8022 | 59 | 0 | 12.8554 % |
| Crypto.USDY/USD | 600 / 603 / 9839 | 28 | 0 | 12.7567 % |
| Crypto.TSLAX/USD | 870 / 870 / 7772 | 56 | 0 | 12.3893 % |
| Crypto.CRCLX/USD | 870 / 870 / 7844 | 44 | 0 | 11.6675 % |
| Crypto.GOOGLX/USD | 600 / 4388 / 17797 | 37 | 0 | 8.2080 % |
| Crypto.COINX/USD | 600 / 603 / 23759 | 30 | 0 | 6.5129 % |
| Crypto.DSOL/USD | 698 / 8714 / 9608 | 14 | 1907 | 5.1232 % |
| Crypto.METAX/USD | 1401 / 8022 / 8022 | 7 | 0 | 4.6239 % |
| Crypto.META/USD | 3375 / 9014 / 23039 | 12 | 0 | 2.3087 % |
| Crypto.QQQX/USD | 6863 / 22081 / 22081 | 3 | 0 | 1.4167 % |
| Crypto.HOODX/USD | 23025 / 23025 / 23025 | 1 | 0 | 0.5212 % |
| Crypto.TAO/USD | 38586 / 38586 / 38586 | 1 | 0 | 0.3110 % |
