# Gesponserte Pyth-Preiskonten auf Solana Mainnet

Stand: Freitag, 18.09.2026, 16:03 UTC. Die Spalten zu Wochenende, 04:00/16:00 UTC und Lücken
folgen am Montag, 21.09., aus dem laufenden Logger (siehe unten). Alle Werte sind direkt von der
Kette gelesen, nur lesend, über den öffentlichen Mainnet-RPC.

## Kurzfassung
- **Pyths eigene Liste hat 64 Feeds (61 + 2 + 1 Ausnahmen), und sie ist fast nur Krypto.** Dazu
  kommen Umtauschkurse (`.RR`), NAVs und eine einzige Aktie (Galaxy Digital, `GLXY`). **Gold,
  Devisen, Indizes und US-Aktien stehen nicht darin.**
- Jeder Listen-Feed hat **zwei Konten**: eines im alten Stack (Price-Feed-Programm
  `pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT`, Receiver `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`)
  und eines im neuen Stack seit dem 26.08.2026 (`pyt2F414BA6dPttK6RddPZUdHfapoBN24GL5wbrPCou`,
  Receiver `rec2HHDDnjLfj4kE7VyEtFA1HPGQLK33259532cRyHp`). Beide werden heute aktualisiert. 63 der 64
  Listen-Adressen existieren; `NTBILL/USD.RR` hat kein Konto.
- **Gold, Silber, Platin, Palladium, 8 Devisenpaare und 15 US-Aktien/ETFs** (SPY, QQQ, NVDA, AAPL …)
  werden live aktualisiert, aber **nur auf Shard 1 des alten Stacks**. Bezahlt wird das von einem einzigen
  Wallet (`FcEAifArzj9GaGorDyT4JjTfYbBWUHYjfqN6zrH6UVGR`), das in Pyths Liste nicht vorkommt. Wem es gehört,
  ist nicht belegt; eine Websuche nach der Adresse ergab nichts. Solche Sponsoren hören auch auf: 285
  der 513 Konten ruhen. Das Gold-Konto auf Shard 0 zum Beispiel wurde zuletzt am 27.08. aktualisiert,
  einen Tag nach dem Upgrade.
- **Für uns entscheidend:** Unser Programm liest nur den **alten** Stack. `pyth-solana-receiver-sdk`
  2.0.0 prüft ohne das Feature `pro-compatible` den Besitzer `rec5E…`, mit dem Feature `rec2HH…`
  (`src/lib.rs`, `cfg_if`). Ein Build kann also nur einen der beiden Stacks lesen. Gold auf
  alt/1 wäre heute lesbar. Die neuen Konten würden mit `AccountOwnedByWrongProgram` abgelehnt.

## Wie gezählt wurde
Alle 1 870 Feed-IDs aus Pyths Feed-Liste (`hermes.pyth.network/v2/price_feeds`, ohne Schlüssel
abrufbar) × Shard 0–3 × beide Price-Feed-Programme: Das ergibt 14 960 Kandidaten. Für jeden wurde
die PDA `[shard_le_u16, feed_id]` abgeleitet und per `getMultipleAccounts` gelesen. **513 Konten
existieren:** alter Stack 330 (Shard 0: 216, Shard 1: 109, Shard 2: 5), neuer Stack 183 (Shard 0:
179, Shard 1: 4). Alle haben die Stufe `Full`, und bei allen stimmt die Feed-ID mit der Adresse überein.
Ein Konto gilt als „live“, wenn sein letzter `publish_time` weniger als 24 h zurückliegt: 228 sind
live, 285 ruhen.

## Wer bezahlt die Updates (Fee-Payer, Stichprobe der letzten Transaktionen)
| Konten | Fee-Payer | in Pyths Liste |
|---|---|---|
| alt/0 SOL/USD | `AgmLJBMDCqWynYnQiPCuj9ewsNNsBJXyzoUhD9LJzN51`, `78Bo7xxGWBEvqbh3VMKvkFG4Z63cXKSJ2LCEXAanhN7a` | ja |
| alt/0 GLXY | `4p16wya1Vw2u9w22oah4yXQgySb6eWKRRLMsEXCreish` | ja |
| alt/1 SOL, EUR/USD, XAU/USD, SPY | `FcEAifArzj9GaGorDyT4JjTfYbBWUHYjfqN6zrH6UVGR` | nein |
| alt/0 SPY (unregelmäßig, zuletzt 14:00 UTC) | `AqB478KVcoBwV39QjftJQ6qvV9xTh8CYB9jEnc2XSNLu` | nein |

## Punkt 5: „Pro-compatible“ und Bezahlplan
- **Die Spalte gibt es.** Alle 64 Mainnet-Feeds stehen auf **„Available“**. Pyth dazu: *„The
  Pro-compatible column shows whether each feed is already served by the upgraded Hermes endpoint
  for the Pyth Core upgrade. Feeds marked Available are already served by the upgraded Hermes. Not
  all Coming soon feeds are guaranteed to be migrated.“* Gemeint ist also die Frage, ob der Feed im
  neuen Stack (neues Hermes, `rec2HH…`, `pyt2F4…`) bedient wird. Das SDK-Feature gleichen Namens
  schaltet genau darauf um.
- **Lesen kostet keinen Plan (belegt).** Pyth-FAQ, Seite „Preparing for the upgrade“:
  *„I read prices on-chain only (push feeds, no Hermes) — do I need an API key? — No. The API key
  is only required for Hermes (REST/SSE) requests. If your integration reads prices directly from
  the Pyth contract on-chain and never calls Hermes, you don't need to register.“* Technisch
  bestätigt: Alle Werte dieser Tabelle wurden über den öffentlichen Solana-RPC gelesen, ohne
  Pyth-Schlüssel, und die Feed-Liste samt Handelszeiten ist ohne Schlüssel abrufbar. Grenzen
  setzt nur der RPC-Anbieter, nicht Pyth.
- **Nicht damit verwechseln:** Das Lesen eines gesponserten Kontos ist frei. Das **Posten** eines
  bestimmten historischen Updates, also unser Hermes-Weg mit der Eindeutigkeitsregel, braucht
  weiterhin einen Hermes-Schlüssel. Offen ist außerdem, ob Updates aus dem neuen Hermes noch über
  den alten Receiver `rec5E…` gepostet werden können, den unser Programm prüft. Das ist nicht
  geprüft und gehört zu Spike 4.

## Punkt 2: Takt (20 Minuten, Fr 18.09. 15:43–16:03 UTC)
Gemessen wurde der Abstand zwischen zwei aufeinanderfolgenden neuen `publish_time`, und zwar
beim ersten Sehen auf Solana. Die Abfrage läuft alle 5 s, Werte unter 5 s sind deshalb
Auflösungsgrenze. Die sechs Konten von SOL/BTC/ETH auf alt/0 und alt/1 hört zusätzlich ein
Websocket mit.
- **alt/0, Pyths Liste:** p50 52–55 s, max ~64 s. Das entspricht dem dokumentierten Herzschlag von 55 s.
- **neu/0, Pyths Liste:** SOL/USD und BTC/USD ≤ 5 s (mindestens so schnell wie die Abfrage),
  die übrigen p50 ~54 s.
- **alt/1, Dritter:** Krypto, XAU, XAG, EUR/USD, GBP/USD, USD/JPY und alle US-Aktien p50 10 s,
  p90 15 s. AUD, NZD, CAD, CHF, MXN, XPT und XPD p50 30 s.
- **Langsam:** PAXG/USD (tokenisiertes Gold, 24/7) auf neu/0 nur alle ~590 s, nicht in Pyths Liste.

## Punkt 3: Wochenende und Nacht — läuft
Der Logger schreibt seit 17:43 MESZ alle 513 Konten mit. Die Endzeit wurde von Sonntag 12:09 UTC
auf **Montag 21.09., 06:00 UTC** verschoben, damit auch Sonntag 16:00 UTC und die Wiedereröffnung der
Devisen- und Metallmärkte am Montag um 04:00 UTC in der Messung liegen. Am Montag ergänzt
`FINAL=1 node render.mjs` die Spalten „Wochenende“, „Alter um 04:00“, „Alter um 16:00“ und
„Lücken > 5 min“. Dann wird aus „A“ gegebenenfalls „B?“, falls ein 24/7-Feed am Wochenende Lücken hatte.

## Punkt 4: Einordnung für Referenz 04:00 UTC und Auflösung 16:00 UTC (vorläufig)
Maßstab ist die Handelszeit, die Pyth je Feed angibt, geprüft für eine Sommer- und eine
Winterzeit-Woche (12.10. und 2.11.; die USA stellen am 1.11. um). Dazu kommt der gemessene Takt.
- **A — durchgehend nutzbar:** 62 verschiedene Krypto-Feeds. **33 davon über Pyths Liste**, also
  mit belegtem Pfleger: 2Z, AAVE, BNSOL, BONK, BSOL, **BTC**, CLOUD, DSOL, **ETH**, FARTCOIN, HYPE,
  INF, JITOSOL, JLP, JTO, JUP, LBTC, MET, MEW, MNDE, MSOL, ORE, PUMP, PYTH, RENDER, **SOL**, TNSR,
  TRUMP, W, WBTC, WIF, ZBTC, ZEC (jeweils /USD). Die übrigen 29 (ADA, AVAX, BNB, DOGE, LINK, LTC,
  SUI, TON, XRP …) laufen nur beim Dritten auf alt/1.
- **B — nur werktags nutzbar:** XAU (Gold), XAG, XPT, XPD, EUR/USD, GBP/USD, USD/JPY, AUD/USD,
  NZD/USD, USD/CAD, USD/CHF, USD/MXN. Um 04:00 und um 16:00 UTC ist Montag bis Freitag geöffnet, in beiden
  Zeitzonen-Wochen. Samstag und Sonntag sind geschlossen. Tägliche Pause bei Metallen 17–18 Uhr New York,
  das ist 21–22 bzw. 22–23 UTC und stört nicht. **Alle zwölf nur über den Dritten**, keiner in Pyths Liste.
- **C — unbrauchbar für unser Fenster:**
  - **US-Aktien und ETFs** (SPY, QQQ, NVDA, AAPL, TSLA, GLXY …): Handelszeit 09:30–16:00 New York,
    also um 04:00 UTC geschlossen. Eine Referenz um 04:00 UTC wäre der Schlusskurs vom Vortag, der
    Feed steht dann still.
  - **Umtauschkurse (`.RR`) und NAVs:** kein Marktpreis. Sie bewegen sich stufenweise, eine Frage wäre
    trivial.
  - **Stablecoins** (USDC, USDT, USDe, EURC …): Der Ausgang steht praktisch fest.
  - **PAXG:** Der Takt von ~10 min ist zu langsam für einen Stichzeitpunkt.
  - **Alle 285 ruhenden Konten** (Liste unten).

Unabhängig davon gilt der Befund aus Spike 4: Mit der Regel `prev_publish_time < T ≤ publish_time`
besteht **keines** dieser Konten zuverlässig, weil jedes nur jedes n-te Pythnet-Update postet.
Die Tabelle beantwortet, welche Preise zu unseren Zeiten on-chain frei **existieren**. Ob wir sie
eindeutig verwenden können, entscheidet sich bei Spike 4.

## Was dadurch möglich würde
Mit Feeds aus Gruppe B wären Fragen über Anlageklassen hinweg möglich, etwa „Schlägt Bitcoin
heute Gold?“, „Steigt der Euro gegen den Dollar stärker als SOL?“ oder „Hält Silber besser als ETH?“.
Heute gibt es nur Krypto gegen einen festen Schwellenwert. Solche Fragen gingen aber **nur an
Werktagen**, sie hingen **vollständig an einem nicht benannten Dritten**, der jederzeit aufhören kann,
und sie bräuchten dieselbe Lösung für die Eindeutigkeit wie Spike 4. Innerhalb von Pyths eigener
Liste bleibt es bei Krypto gegen Krypto, etwa „Schlägt SOL heute BTC?“ oder „Schlägt ZEC heute
ETH?“. Das ginge an allen sieben Tagen, und für jeden dieser 33 Feeds nennt Pyth sich selbst als Pfleger.

## Dateien
- `docs/generated/sponsored-feeds.json` — alle 513 Konten mit voller Feed-ID, Handelszeit, Takt und Gruppe.
- `spikes/pyth-sponsored/` — Skripte: `enumerate.mjs` (Konten finden), `logger.mjs` (mitschreiben),
  `feeds.mjs` (Takt, Lücken, 04:00/16:00), `render.mjs` (diese Tabellen).

## Live-Konten (228)
Spalten: Stack alt = `pythWS…`/`rec5E…`, neu = `pyt2F4…`/`rec2HH…`. Takt aus der 20-Minuten-Messung.
„Handelszeit“ ist Pyths Plan in New Yorker Zeit, Montag bis Sonntag (O = offen, C = geschlossen).

| Gruppe | Feed | Klasse | Stack/Shard | gepflegt von | Konto | Feed-ID | Pyth-Liste | Pro-compatible | Stufe | Konfidenz (bps, Median) | letzter publish_time (UTC) | Takt p50/p90/max (s) | Handelszeit laut Pyth (Mo…So) | Begründung |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | Crypto.2Z/USD | Crypto | neu/0 | Pyth (Liste) | `DxFuBunE8payESVj9NU8nxYHBugrojTvmXBpXgjgPBVL` | `f2b3ab1c…` | ja | available | Full | 4.103 | 2026-09-18 16:02 | 54 / 55 / 60 | 24/7 | Handelszeit 24/7 |
| A | Crypto.2Z/USD | Crypto | alt/0 | Pyth (Liste) | `FrbKHNNy7yrRmEjyy8C9PsVubrCbWkFku3DqRfFPZjyS` | `f2b3ab1c…` | ja | available | Full | 4.493 | 2026-09-18 16:03 | 54 / 55 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.AAVE/USD | Crypto | neu/0 | Pyth (Liste) | `6BBKuNJCHcxE1gGbmev7QynEjCmkruW8ZD6FxVJYLXpb` | `2b9ab1e9…` | ja | available | Full | 4.497 | 2026-09-18 16:02 | 54 / 55 / 60 | 24/7 | Handelszeit 24/7 |
| A | Crypto.AAVE/USD | Crypto | alt/0 | Pyth (Liste) | `38aAZxne9JkspNZPzz5oqtLHWKVDAZuP4ZTcnkGfJSJg` | `2b9ab1e9…` | ja | available | Full | 4.626 | 2026-09-18 16:03 | 54 / 59 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.AAVE/USD | Crypto | alt/1 | Dritter | `CTA3cWCwkvPDmvvNA5r4jLqe6ErC7PJQZBupxrrQ6NjF` | `2b9ab1e9…` | nein | — | Full | 4.568 | 2026-09-18 16:02 | 29 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.ADA/USD | Crypto | alt/1 | Dritter | `F1aXvNr2sNgBcwQTDJvhSn87MHMkLnRR4pgD2F9xPZD5` | `2a01deae…` | nein | — | Full | 4.182 | 2026-09-18 16:03 | 10 / 15 / 15 | 24/7 | Handelszeit 24/7 |
| A | Crypto.ASTER/USD | Crypto | alt/1 | Dritter | `6gBincZuM783YiWUzoobxrkPm8Mk4vab8AVva1gJVZLP` | `a903b5a8…` | nein | — | Full | 4.287 | 2026-09-18 16:02 | 30 / 34 / 34 | 24/7 | Handelszeit 24/7 |
| A | Crypto.AVAX/USD | Crypto | alt/1 | Dritter | `D6FynYiJ2tipQfVQDQvY5jmLetYqMss3Co2xeq4vbuvd` | `93da3352…` | nein | — | Full | 3.92 | 2026-09-18 16:03 | 10 / 15 / 19 | 24/7 | Handelszeit 24/7 |
| A | Crypto.BCH/USD | Crypto | alt/1 | Dritter | `CdFWCLA6fGZN8jNZheD2AfVCtFT8sEVJRagVyB1VJ6ft` | `3dd2b636…` | nein | — | Full | 3.422 | 2026-09-18 16:02 | 29 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.BNB/USD | Crypto | alt/1 | Dritter | `4BfpDD8WdPqjSiosGNtiFdDVYdmjWnf6n7DmvAVz8yka` | `2f95862b…` | nein | — | Full | 3.903 | 2026-09-18 16:03 | 10 / 15 / 15 | 24/7 | Handelszeit 24/7 |
| A | Crypto.BNSOL/USD | Crypto | neu/0 | Pyth (Liste) | `GGYQ1Wp9MHNnmMZhCtL3RPnDTcfto7VENZqALqHi6tPF` | `55f8289b…` | ja | available | Full | 4.707 | 2026-09-18 16:03 | 50 / 59 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.BNSOL/USD | Crypto | alt/0 | Pyth (Liste) | `7osijozndKD4Km7LrrRjAfHSojVmyPbct9LmdmXLqEEP` | `55f8289b…` | ja | available | Full | 5.739 | 2026-09-18 16:03 | 54 / 55 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.BOME/USD | Crypto | alt/1 | Dritter | `47vQbjh89rHtad447uN1fLwUW3PzwGvSEEBvBcnCvPPh` | `30e47805…` | nein | — | Full | 6.144 | 2026-09-18 16:02 | 29 / 35 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.BONK/USD | Crypto | neu/0 | Pyth (Liste) | `3nMpgBXnjBSDYupQQEVR7DZM65zkJCdKy1Up7nkqp99w` | `72b02121…` | ja | available | Full | 5.16 | 2026-09-18 16:02 | 49 / 59 / 59 | 24/7 | Handelszeit 24/7 |
| A | Crypto.BONK/USD | Crypto | alt/0 | Pyth (Liste) | `DBE3N8uNjhKPRHfANdwGvCZghWXyLPdqdSbEW2XFwBiX` | `72b02121…` | ja | available | Full | 5.829 | 2026-09-18 16:02 | 54 / 55 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.BSOL/USD | Crypto | neu/0 | Pyth (Liste) | `89WnYggXmjW7w1xgo91ctCcDadWuBx5DjcVU6pnhNX9b` | `89875379…` | ja | available | Full | 18.798 | 2026-09-18 16:03 | 50 / 55 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.BSOL/USD | Crypto | alt/0 | Pyth (Liste) | `5cN76Xm2Dtx9MnrQqBDeZZRsWruTTcw37UruznAdSvvE` | `89875379…` | ja | available | Full | 17.28 | 2026-09-18 16:02 | 54 / 59 / 59 | 24/7 | Handelszeit 24/7 |
| A | Crypto.BTC/USD | Crypto | neu/0 | Pyth (Liste) | `APgzQGGdv2qCgBkX6aHVkrGePtBVDDg68GiqaM7rmtf5` | `e62df6c8…` | ja | available | Full | 2.358 | 2026-09-18 16:03 | 5 / 5 / 14 | 24/7 | Handelszeit 24/7 |
| A | Crypto.BTC/USD | Crypto | alt/0 | Pyth (Liste) | `4cSM2e6rvbGQUFiJbqytoVMi5GgghSMr8LwVrT9VPSPo` | `e62df6c8…` | ja | available | Full | 2.507 | 2026-09-18 16:02 | 52 / 56 / 62 | 24/7 | Handelszeit 24/7 |
| A | Crypto.BTC/USD | Crypto | alt/1 | Dritter | `CQanas4srymHLigVyu56ynJhKZzKYJvBa45VAsTgXSvM` | `e62df6c8…` | nein | — | Full | 2.34 | 2026-09-18 16:03 | 11 / 13 / 16 | 24/7 | Handelszeit 24/7 |
| A | Crypto.CLOUD/USD | Crypto | neu/0 | Pyth (Liste) | `4fKNHTSnc4Bs54ZrsBRu95Grbewgg23cugA2fQfgjeuS` | `73583136…` | ja | available | Full | 16.986 | 2026-09-18 16:02 | 50 / 55 / 60 | 24/7 | Handelszeit 24/7 |
| A | Crypto.CLOUD/USD | Crypto | alt/0 | Pyth (Liste) | `9Ukgyw8sishBXmRngEJBW6MV5Y7BBL6gLykxJNBXMczn` | `73583136…` | ja | available | Full | 16.986 | 2026-09-18 16:03 | 54 / 55 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.DOGE/USD | Crypto | alt/1 | Dritter | `Jvg1x164Kx8UGfWt82HPxeydieZRoYCwXRQb6r5rWLQ` | `dcef50dd…` | nein | — | Full | 1.954 | 2026-09-18 16:03 | 10 / 15 / 15 | 24/7 | Handelszeit 24/7 |
| A | Crypto.DOT/USD | Crypto | alt/1 | Dritter | `ABg5EwARbwFmpkeS19WhwjUZu99VRHbER6YmjodsWAeJ` | `ca3eed9b…` | nein | — | Full | 3.97 | 2026-09-18 16:02 | 29 / 35 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.DSOL/USD | Crypto | neu/0 | Pyth (Liste) | `CjbJNFJkGB1qu2Muc28E99R4RDy4PNSDtRV2udoAY4Ho` | `41f858ba…` | ja | available | Full | 141.51 | 2026-09-18 16:02 | 50 / 59 / 60 | 24/7 | Handelszeit 24/7 |
| A | Crypto.DSOL/USD | Crypto | alt/0 | Pyth (Liste) | `4myJurk13yJmf7ZER25XZfQvVA4jWYpbbFSFhXpXeLKv` | `41f858ba…` | ja | available | Full | 142.46 | 2026-09-18 16:02 | 54 / 59 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.ENA/USD | Crypto | alt/1 | Dritter | `A7btcHjFzypeSo9mGYTNqeFjxZZqaAoBXB1gPiipFNa7` | `b7910ba7…` | nein | — | Full | 4.578 | 2026-09-18 16:02 | 29 / 35 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.ETH/USD | Crypto | neu/0 | Pyth (Liste) | `7odryi4WfoMFHtv2eubdMgP1pqQMmdiXSK1N2tqZ2nRH` | `ff61491a…` | ja | available | Full | 3.187 | 2026-09-18 16:02 | 54 / 54 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.ETH/USD | Crypto | alt/0 | Pyth (Liste) | `42amVS4KgzR9rA28tkVYqVXjq9Qa8dcZQMbH5EYFX6XC` | `ff61491a…` | ja | available | Full | 3.398 | 2026-09-18 16:03 | 53 / 56 / 61 | 24/7 | Handelszeit 24/7 |
| A | Crypto.ETH/USD | Crypto | alt/1 | Dritter | `4Ruku1Seg5iaUQT9pQmbfR9RB1r4iYWmiZhrh9A2idwo` | `ff61491a…` | nein | — | Full | 3.364 | 2026-09-18 16:03 | 11 / 13 / 14 | 24/7 | Handelszeit 24/7 |
| A | Crypto.FARTCOIN/USD | Crypto | neu/0 | Pyth (Liste) | `65g8gPGkHH5Ss5YPJNCxRAa9dnvp37khzeY7tbbe3ntw` | `58cd29ef…` | ja | available | Full | 4.287 | 2026-09-18 16:03 | 49 / 59 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.FARTCOIN/USD | Crypto | alt/0 | Pyth (Liste) | `2t8eUbYKjidMs3uSeYM9jXM9uudYZwGkSeTB4TKjmvnC` | `58cd29ef…` | ja | available | Full | 3.875 | 2026-09-18 16:02 | 54 / 59 / 59 | 24/7 | Handelszeit 24/7 |
| A | Crypto.FARTCOIN/USD | Crypto | alt/1 | Dritter | `AU8BycGLtge6w9af3Ua8qQajzvzjaEgXdueZntxQhKco` | `58cd29ef…` | nein | — | Full | 4.564 | 2026-09-18 16:02 | 29 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.FET/USD | Crypto | alt/1 | Dritter | `J1CtKJjc14jovXhpAsLzG9eTPcm1U7rGRRNnLf1tryT1` | `7da003ad…` | nein | — | Full | 4.426 | 2026-09-18 16:02 | 29 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.HNT/USD | Crypto | neu/0 | nicht belegt | `He5mhwVQQNvjFxqjEjFDb7enJWFwFJ7Rq7zknqBz89A5` | `649fdd7e…` | nein | — | Full | 13.137 | 2026-09-18 15:59 | 10 / 295 / 295 | 24/7 | Handelszeit 24/7 |
| A | Crypto.HYPE/USD | Crypto | neu/0 | Pyth (Liste) | `9dAoWJ5ua81c43ntstN4xyg3Uo9Zt93x7BjCxSc27V6V` | `4279e31c…` | ja | available | Full | 5.797 | 2026-09-18 16:03 | 5 / 5 / 19 | 24/7 | Handelszeit 24/7 |
| A | Crypto.HYPE/USD | Crypto | alt/0 | Pyth (Liste) | `6usXZCEM4kf1KHGDTzgQLAWtDMNdzLjfAUYSwGKJm19Y` | `4279e31c…` | ja | available | Full | 5.834 | 2026-09-18 16:03 | 54 / 59 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.HYPE/USD | Crypto | alt/1 | Dritter | `3dndBghRKt4ZmuCSMDRNM2urEZKagoM4o15YHtN2LbeJ` | `4279e31c…` | nein | — | Full | 5.798 | 2026-09-18 16:03 | 10 / 15 / 15 | 24/7 | Handelszeit 24/7 |
| A | Crypto.INF/USD | Crypto | neu/0 | Pyth (Liste) | `9Br93wF7vgdtw5JZcXyH1TvM9W4vb3dBPBEBg6EKuGC7` | `f5157098…` | ja | available | Full | 31.013 | 2026-09-18 16:03 | 54 / 55 / 60 | 24/7 | Handelszeit 24/7 |
| A | Crypto.INF/USD | Crypto | alt/0 | Pyth (Liste) | `Ceg5oePJv1a6RR541qKeQaTepvERA3i8SvyueX9tT8Sq` | `f5157098…` | ja | available | Full | 31.577 | 2026-09-18 16:03 | 54 / 55 / 59 | 24/7 | Handelszeit 24/7 |
| A | Crypto.JITOSOL/USD | Crypto | neu/0 | Pyth (Liste) | `FvKB6oTnYvhdKxPeygwhVHE3H4EMr6kLwJnMjvGrdVUU` | `67be9f51…` | ja | available | Full | 5.793 | 2026-09-18 16:02 | 49 / 55 / 59 | 24/7 | Handelszeit 24/7 |
| A | Crypto.JITOSOL/USD | Crypto | alt/0 | Pyth (Liste) | `AxaxyeDT8JnWERSaTKvFXvPKkEdxnamKSqpWbsSjYg1g` | `67be9f51…` | ja | available | Full | 5.54 | 2026-09-18 16:03 | 54 / 55 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.JLP/USD | Crypto | neu/0 | Pyth (Liste) | `GqzHqMLWNYyYVQWg5V9uxwqc8qCkQzkk85sn6uDVP6Et` | `c811abc8…` | ja | available | Full | 10.474 | 2026-09-18 16:03 | 54 / 55 / 60 | 24/7 | Handelszeit 24/7 |
| A | Crypto.JLP/USD | Crypto | alt/0 | Pyth (Liste) | `2TTGSRSezqFzeLUH8JwRUbtN66XLLaymfYsWRTMjfiMw` | `c811abc8…` | ja | available | Full | 10.901 | 2026-09-18 16:03 | 54 / 59 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.JTO/USD | Crypto | neu/0 | Pyth (Liste) | `FsQi5M35VcwPs4g4pa4suzWmzz6dd4FWEi3GbNMFz65d` | `b43660a5…` | ja | available | Full | 4.799 | 2026-09-18 16:02 | 49 / 55 / 59 | 24/7 | Handelszeit 24/7 |
| A | Crypto.JTO/USD | Crypto | alt/0 | Pyth (Liste) | `7ajR2zA4MGMMTqRAVjghTKqPPn4kbrj3pYkAVRVwTGzP` | `b43660a5…` | ja | available | Full | 4.769 | 2026-09-18 16:03 | 54 / 55 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.JTO/USD | Crypto | alt/1 | Dritter | `4WcJ2tHmPrTGqSPLBhHAj6kSWLgw3ds9FrHrYUjKmy49` | `b43660a5…` | nein | — | Full | 4.986 | 2026-09-18 16:02 | 29 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.JUP/USD | Crypto | neu/0 | Pyth (Liste) | `EitcZS5LtbR4EyNhCSy56vvUHPhsifSfWFG5gwSkjNpV` | `0a0408d6…` | ja | available | Full | 6.815 | 2026-09-18 16:02 | 54 / 54 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.JUP/USD | Crypto | alt/0 | Pyth (Liste) | `7dbob1psH1iZBS7qPsm3Kwbf5DzSXK8Jyg31CTgTnxH5` | `0a0408d6…` | ja | available | Full | 6.82 | 2026-09-18 16:03 | 54 / 55 / 59 | 24/7 | Handelszeit 24/7 |
| A | Crypto.JUP/USD | Crypto | alt/1 | Dritter | `At4HodzgjxkvE4dAJ7ZL8UzJMFK1cwoBkpTnhUxMDnwM` | `0a0408d6…` | nein | — | Full | 6.61 | 2026-09-18 16:02 | 29 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.LBTC/USD | Crypto | neu/0 | Pyth (Liste) | `hSwLXA5MTFMrCLdH7A1p4KZ1AXfFEmeWnwjBXpPsxbw` | `8f257aab…` | ja | available | Full | 16.811 | 2026-09-18 16:02 | 59 / 59 / 74 | 24/7 | Handelszeit 24/7 |
| A | Crypto.LBTC/USD | Crypto | alt/0 | Pyth (Liste) | `HENev4WeM2VhJ2b9tFCQsWdHGU6fTvgW68MsvBeYpxYn` | `8f257aab…` | ja | available | Full | 15.914 | 2026-09-18 16:02 | 59 / 59 / 69 | 24/7 | Handelszeit 24/7 |
| A | Crypto.LINK/USD | Crypto | alt/1 | Dritter | `VMoe7Hd739kya2Hta6T6MkPz5SHajiak9Wc27XsY11i` | `8ac0c70f…` | nein | — | Full | 3.344 | 2026-09-18 16:03 | 10 / 15 / 15 | 24/7 | Handelszeit 24/7 |
| A | Crypto.LTC/USD | Crypto | alt/1 | Dritter | `FwDSe2rfqy7wXQpzTPXYsRQTsixVwBhr94GLkp6BQscF` | `6e3f3fa8…` | nein | — | Full | 2.032 | 2026-09-18 16:02 | 30 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.MELANIA/USD | Crypto | alt/1 | Dritter | `6e3ieK39KaPrb5mUtyDuZ7VTxZZLDz1zWu9YJVtese7D` | `8fef7d52…` | nein | — | Full | 6.939 | 2026-09-18 16:02 | 30 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.MET/USD | Crypto | neu/0 | Pyth (Liste) | `CWau4gErTGxHbcuCGRk5PcJBe9UmHCHCUgsUu2MZF63w` | `0292e0f4…` | ja | available | Full | 5.302 | 2026-09-18 16:03 | 50 / 55 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.MET/USD | Crypto | alt/0 | Pyth (Liste) | `ApN7pa6MH2WmuZFXwi5PxMb4bSwRLDthbVSuWaiSMWyR` | `0292e0f4…` | ja | available | Full | 5.492 | 2026-09-18 16:03 | 54 / 55 / 69 | 24/7 | Handelszeit 24/7 |
| A | Crypto.MEW/USD | Crypto | neu/0 | Pyth (Liste) | `6XMrjmSgWrjguXzZUj8mQPqsqvMqx5Cui48LFDRWBGBd` | `514aed52…` | ja | available | Full | 5.784 | 2026-09-18 16:03 | 54 / 55 / 60 | 24/7 | Handelszeit 24/7 |
| A | Crypto.MEW/USD | Crypto | alt/0 | Pyth (Liste) | `EF6U755BdHMXim8RBw6XSC6Yk6XaouTKpwcBZ7QkcanB` | `514aed52…` | ja | available | Full | 5.568 | 2026-09-18 16:03 | 54 / 55 / 59 | 24/7 | Handelszeit 24/7 |
| A | Crypto.MNDE/USD | Crypto | neu/0 | Pyth (Liste) | `FLaK5mVZrARAmMUs5H7yQRcT9aMWADLyUfbSuAMk8eDw` | `3607bf4d…` | ja | available | Full | 13.033 | 2026-09-18 16:02 | 54 / 54 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.MNDE/USD | Crypto | alt/0 | Pyth (Liste) | `GHKcxocPyzSjy7tWApQjKRkDNuVXd4Kk624zhuaR7xhC` | `3607bf4d…` | ja | available | Full | 13.851 | 2026-09-18 16:03 | 54 / 55 / 59 | 24/7 | Handelszeit 24/7 |
| A | Crypto.MON/USD | Crypto | alt/1 | Dritter | `3Ko5iYUopYcFGqMLwR2AazE73jFhReGC25PfPx3DRdmL` | `31491744…` | nein | — | Full | 4.986 | 2026-09-18 16:03 | 29 / 35 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.MORPHO/USD | Crypto | alt/1 | Dritter | `GnVuRATW17nyTAVya3qqoGEcN3Np3o6CJZXWCmhibiw7` | `5b2a4c54…` | nein | — | Full | 4.743 | 2026-09-18 16:03 | 30 / 35 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.MSOL/USD | Crypto | neu/0 | Pyth (Liste) | `Gtjm5bpCMxyNhjWe8GNDRq5KoBqhLJw63dWdcdpoq7nc` | `c2289a6a…` | ja | available | Full | 28.553 | 2026-09-18 16:03 | 50 / 55 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.MSOL/USD | Crypto | alt/0 | Pyth (Liste) | `5CKzb9j4ChgLUt8Gfm5CNGLN6khXKiqMbnGAW4cgXgxK` | `c2289a6a…` | ja | available | Full | 28.964 | 2026-09-18 16:02 | 54 / 59 / 59 | 24/7 | Handelszeit 24/7 |
| A | Crypto.ONDO/USD | Crypto | alt/1 | Dritter | `JEBnJUdzBv2SxLfrMC3eL8c1aq2mZxjoyviavXzV4K7D` | `d4047261…` | nein | — | Full | 3.585 | 2026-09-18 16:02 | 30 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.ORE/USD | Crypto | neu/0 | Pyth (Liste) | `5MXszWwfchGKXVA4euFaXH9TMMZ6HMPwfrf7wp9p2GcX` | `142b804c…` | ja | available | Full | 18.027 | 2026-09-18 16:03 | 50 / 54 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.ORE/USD | Crypto | alt/0 | Pyth (Liste) | `GYYQ8gbX4Tndc4WMJ9jSjZTePTvbmgRRxByt54ZQYqvZ` | `142b804c…` | ja | available | Full | 22.286 | 2026-09-18 16:02 | 54 / 55 / 59 | 24/7 | Handelszeit 24/7 |
| A | Crypto.PUMP/USD | Crypto | neu/0 | Pyth (Liste) | `4KL8nVtrXmLjbbHtrDz5YCHNqmii62oHfr9bsUtx1bgi` | `7a01fca2…` | ja | available | Full | 4.932 | 2026-09-18 16:03 | 50 / 54 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.PUMP/USD | Crypto | alt/0 | Pyth (Liste) | `HMm3GPbdnqGwbkTnUUqCFsH8AMHDdEC3Lg8gcPD3HJSH` | `7a01fca2…` | ja | available | Full | 4.951 | 2026-09-18 16:02 | 50 / 54 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.PUMP/USD | Crypto | alt/1 | Dritter | `4EExzKGyN4iuryQh2o9GR1yCwgqgPC9z1nMv81HbC6R1` | `7a01fca2…` | nein | — | Full | 4.972 | 2026-09-18 16:03 | 10 / 15 / 15 | 24/7 | Handelszeit 24/7 |
| A | Crypto.PYTH/USD | Crypto | neu/0 | Pyth (Liste) | `BTeWTCeCVxRXsHA6biwGvw6ynAovr3i7UDLsP9SzZTrA` | `0bbf28e9…` | ja | available | Full | 4.227 | 2026-09-18 16:03 | 54 / 55 / 60 | 24/7 | Handelszeit 24/7 |
| A | Crypto.PYTH/USD | Crypto | alt/0 | Pyth (Liste) | `8vjchtMuJNY4oFQdTi8yCe6mhCaNBFaUbktT482TpLPS` | `0bbf28e9…` | ja | available | Full | 4.785 | 2026-09-18 16:03 | 54 / 55 / 59 | 24/7 | Handelszeit 24/7 |
| A | Crypto.RENDER/USD | Crypto | neu/0 | Pyth (Liste) | `CQunoG15nDNGdM4C4JnDmYMEmZFnTkD5eSJGf118MfWR` | `3d4a2bd9…` | ja | available | Full | 4.008 | 2026-09-18 16:02 | 50 / 55 / 59 | 24/7 | Handelszeit 24/7 |
| A | Crypto.RENDER/USD | Crypto | alt/0 | Pyth (Liste) | `HAm5DZhrgrWa12heKSxocQRyJWGCtXegC77hFQ8F5QTH` | `3d4a2bd9…` | ja | available | Full | 3.942 | 2026-09-18 16:03 | 54 / 59 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.RENDER/USD | Crypto | alt/1 | Dritter | `DLxyTmqNYaFxG69k5DFk6CNmyN6irxuozssGjKpZs1Er` | `3d4a2bd9…` | nein | — | Full | 3.843 | 2026-09-18 16:03 | 29 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.SOL/USD | Crypto | neu/0 | Pyth (Liste) | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `ef0d8b6f…` | ja | available | Full | 1.575 | 2026-09-18 16:03 | 5 / 5 / 14 | 24/7 | Handelszeit 24/7 |
| A | Crypto.SOL/USD | Crypto | alt/0 | Pyth (Liste) | `7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE` | `ef0d8b6f…` | ja | available | Full | 1.538 | 2026-09-18 16:03 | 52 / 55 / 61 | 24/7 | Handelszeit 24/7 |
| A | Crypto.SOL/USD | Crypto | alt/1 | Dritter | `6bWEn5B8eJCRAek5acd3R7d4Sx3e7JWvt84srqqfYgt` | `ef0d8b6f…` | nein | — | Full | 1.626 | 2026-09-18 16:03 | 12 / 13 / 16 | 24/7 | Handelszeit 24/7 |
| A | Crypto.SUI/USD | Crypto | alt/1 | Dritter | `6GujNybsWYw5uWfP9LvWTkjEkT8rMr35XGzYQv1BCvb4` | `23d73151…` | nein | — | Full | 2.968 | 2026-09-18 16:03 | 10 / 15 / 15 | 24/7 | Handelszeit 24/7 |
| A | Crypto.TAO/USD | Crypto | alt/1 | Dritter | `4aWe13tFjiJ1nUc9a2RqBecc2FSafQZBx27juJtm4N2b` | `410f41de…` | nein | — | Full | 3.496 | 2026-09-18 16:03 | 10 / 15 / 19 | 24/7 | Handelszeit 24/7 |
| A | Crypto.TNSR/USD | Crypto | neu/0 | Pyth (Liste) | `BwnNSgohoKER34t5yLgmrZcFNSxgjbYSwtNsoYHUDqPh` | `05ecd459…` | ja | available | Full | 10.723 | 2026-09-18 16:02 | 54 / 55 / 60 | 24/7 | Handelszeit 24/7 |
| A | Crypto.TNSR/USD | Crypto | alt/0 | Pyth (Liste) | `9TSGDwcPQX4JpAvZbu2Wp5b68wSYkQvHCvfeBjYcCyC` | `05ecd459…` | ja | available | Full | 10.984 | 2026-09-18 16:03 | 54 / 59 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.TON/USD | Crypto | alt/1 | Dritter | `AzsdGjoispAaqViQTUsV718FykPmBdcp1vMqRdaksBHR` | `89632178…` | nein | — | Full | 6.412 | 2026-09-18 16:02 | 29 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.TRUMP/USD | Crypto | neu/0 | Pyth (Liste) | `7m3TTzNMFwpMPVz7b8PDtQAKwvT62T1Jxnue2htLGXp` | `87955102…` | ja | available | Full | 2.361 | 2026-09-18 16:03 | 49 / 59 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.TRUMP/USD | Crypto | alt/0 | Pyth (Liste) | `9vNb2tQoZ8bB4vzMbQLWViGwNaDJVtct13AGgno1wazp` | `87955102…` | ja | available | Full | 2.656 | 2026-09-18 16:03 | 54 / 59 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.TRUMP/USD | Crypto | alt/1 | Dritter | `AvT7CHpbjnf74W3tzvSgm16yeRA3JRoqjbkozuK9VeLG` | `87955102…` | nein | — | Full | 2.203 | 2026-09-18 16:03 | 10 / 15 / 15 | 24/7 | Handelszeit 24/7 |
| A | Crypto.TRX/USD | Crypto | alt/1 | Dritter | `BqJWGWShQe9UAzYKh1DfYVjJhXLP215fgJny9mALLM7s` | `67aed5a2…` | nein | — | Full | 2.663 | 2026-09-18 16:03 | 30 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.UNI/USD | Crypto | alt/1 | Dritter | `AB3NMrKkhw8yLpYkGBVXKixvkQBA3u3PFPvknedrBcxV` | `78d185a7…` | nein | — | Full | 2.489 | 2026-09-18 16:02 | 29 / 35 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.VIRTUAL/USD | Crypto | alt/1 | Dritter | `4K1L2aaYexxeMNkeF1g9nt635b6wpzHbYxxs7ptKMww8` | `8132e3eb…` | nein | — | Full | 5.681 | 2026-09-18 16:02 | 29 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.VVV/USD | Crypto | alt/1 | Dritter | `TjuiiWUkRcMus989ePj7MXJLE5n5LCm1Z2Cn4fPL8XM` | `5ece7483…` | nein | — | Full | 4.988 | 2026-09-18 16:02 | 29 / 35 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.W/USD | Crypto | neu/0 | Pyth (Liste) | `2GhB6ADsPxhvSUZC1KJsTnwrMZ2ayrBrhy8m4WsGoTSC` | `eff74464…` | ja | available | Full | 6.822 | 2026-09-18 16:02 | 49 / 54 / 59 | 24/7 | Handelszeit 24/7 |
| A | Crypto.W/USD | Crypto | alt/0 | Pyth (Liste) | `BEMsCSQEGi2kwPA4mKnGjxnreijhMki7L4eeb96ypzF9` | `eff74464…` | ja | available | Full | 6.513 | 2026-09-18 16:02 | 50 / 55 / 59 | 24/7 | Handelszeit 24/7 |
| A | Crypto.WBTC/USD | Crypto | neu/0 | Pyth (Liste) | `A2TZtMiVa5pwf1xfQvZeX3hK71RPPMuqG7C82ZMLDNdr` | `c9d8b075…` | ja | available | Full | 3.936 | 2026-09-18 16:03 | 54 / 55 / 60 | 24/7 | Handelszeit 24/7 |
| A | Crypto.WBTC/USD | Crypto | alt/0 | Pyth (Liste) | `9gNX5vguzarZZPjTnE1hWze3s6UsZ7dsU3UnAmKPnMHG` | `c9d8b075…` | ja | available | Full | 3.772 | 2026-09-18 16:03 | 49 / 59 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.WIF/USD | Crypto | neu/0 | Pyth (Liste) | `9Sn9FVu6WpufA8yZFSRuxYyFgpBrhc5PpTgB3mq2DcsG` | `4ca4beec…` | ja | available | Full | 3.44 | 2026-09-18 16:03 | 50 / 55 / 60 | 24/7 | Handelszeit 24/7 |
| A | Crypto.WIF/USD | Crypto | alt/0 | Pyth (Liste) | `6B23K3tkb51vLZA14jcEQVCA1pfHptzEHFA93V5dYwbT` | `4ca4beec…` | ja | available | Full | 3.575 | 2026-09-18 16:02 | 54 / 55 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.WIF/USD | Crypto | alt/1 | Dritter | `3TCJtgk1AJinZyhqaAHHo9jEf2wRbzzJBzDX2VLizhYQ` | `4ca4beec…` | nein | — | Full | 3.815 | 2026-09-18 16:03 | 30 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.WLD/USD | Crypto | alt/1 | Dritter | `GM3BXrsSVM8G9eSNWQJbz8mvufcnkJTdtGWvQPu2Ls8Q` | `d6835ad1…` | nein | — | Full | 3.967 | 2026-09-18 16:03 | 10 / 15 / 19 | 24/7 | Handelszeit 24/7 |
| A | Crypto.WLFI/USD | Crypto | alt/1 | Dritter | `Af1GxPUc2CVrtaMVKnWv41ogTPWzVqZSPBXnsezy1fwU` | `d4136917…` | nein | — | Full | 5.375 | 2026-09-18 16:02 | 30 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.XLM/USD | Crypto | alt/1 | Dritter | `6YbZvEXEEEgQMrXEsaJsS3WxPgJwsq7negukRV1PFssa` | `b7a8eba6…` | nein | — | Full | 3.786 | 2026-09-18 16:02 | 30 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.XPL/USD | Crypto | alt/1 | Dritter | `FvEiJ2p6GwqsgcJMHUQEyg15BWLgoNUZ1WHwowyhuSsb` | `9873512f…` | nein | — | Full | 3.961 | 2026-09-18 16:02 | 29 / 34 / 35 | 24/7 | Handelszeit 24/7 |
| A | Crypto.XRP/USD | Crypto | alt/1 | Dritter | `53kcCADy3MrxXh5yGgV8W9aV7cHh6of99N6pe6F5ETkm` | `ec5d3998…` | nein | — | Full | 3.525 | 2026-09-18 16:03 | 10 / 15 / 15 | 24/7 | Handelszeit 24/7 |
| A | Crypto.ZBTC/USD | Crypto | neu/0 | Pyth (Liste) | `Gtnbt4HjHZ5UMeZ1t4tKLWNZw9REBKn2v9ZWqZ3bHLSj` | `3d824c7f…` | ja | available | Full | 8.83 | 2026-09-18 16:02 | 54 / 55 / 59 | 24/7 | Handelszeit 24/7 |
| A | Crypto.ZBTC/USD | Crypto | alt/0 | Pyth (Liste) | `7qFJxM2GefbY2td7cXb6bmXmwVqkeF7kYjaypgZWLBng` | `3d824c7f…` | ja | available | Full | 9.841 | 2026-09-18 16:03 | 54 / 54 / 74 | 24/7 | Handelszeit 24/7 |
| A | Crypto.ZEC/USD | Crypto | neu/0 | Pyth (Liste) | `J6PtzWsBtLcuMM7cFS86XVRH4vQfDMcGmBUzSRCMrWMa` | `be9b59d1…` | ja | available | Full | 4.48 | 2026-09-18 16:03 | 5 / 5 / 19 | 24/7 | Handelszeit 24/7 |
| A | Crypto.ZEC/USD | Crypto | alt/0 | Pyth (Liste) | `HzdKMXqocYWqy7mh8AKDoZFJinjeGMfBKmGAxGbasc28` | `be9b59d1…` | ja | available | Full | 4.323 | 2026-09-18 16:03 | 54 / 59 / 64 | 24/7 | Handelszeit 24/7 |
| A | Crypto.ZEC/USD | Crypto | alt/1 | Dritter | `8VpTZHZ65teifS31S4LrjEsLLpk8RbZf3YMYwRZXvTc3` | `be9b59d1…` | nein | — | Full | 4.273 | 2026-09-18 16:03 | 10 / 15 / 19 | 24/7 | Handelszeit 24/7 |
| B | FX.AUD/USD | FX | alt/1 | Dritter | `FCJc4MuW86A4fBRWMLhZuy9Pkp3KMQCP66qmuZAfWQ6C` | `67a6f930…` | nein | — | Full | 0.281 | 2026-09-18 16:03 | 30 / 34 / 34 | O O O O 0000-1700 C 1700-2400 | Mo–Fr um 04:00 und 16:00 UTC offen, Wochenende geschlossen |
| B | FX.EUR/USD | FX | alt/1 | Dritter | `F7H5gC7KNERfcrh2fpK6nx88Ej6kWBKLHNyFFTYuBuQt` | `a995d00b…` | nein | — | Full | 0.174 | 2026-09-18 16:03 | 10 / 15 / 15 | O O O O 0000-1700 C 1700-2400 | Mo–Fr um 04:00 und 16:00 UTC offen, Wochenende geschlossen |
| B | FX.GBP/USD | FX | alt/1 | Dritter | `5vk1mLbNM2qMPiYaj5hEFYJrSN8cdTSNzTTK2nLnsvAy` | `84c2dde9…` | nein | — | Full | 0.224 | 2026-09-18 16:03 | 10 / 15 / 15 | O O O O 0000-1700 C 1700-2400 | Mo–Fr um 04:00 und 16:00 UTC offen, Wochenende geschlossen |
| B | FX.NZD/USD | FX | alt/1 | Dritter | `wJZqyDpNYNGjhX4weEUe4a3RtNKqr24jDXuZPtrvU8B` | `92eea8ba…` | nein | — | Full | 0.35 | 2026-09-18 16:02 | 30 / 35 / 35 | O O O O 0000-1700 C 1700-2400 | Mo–Fr um 04:00 und 16:00 UTC offen, Wochenende geschlossen |
| B | FX.USD/CAD | FX | alt/1 | Dritter | `8h8mkLRHoYuJTpR83oXjo7SCpv9SfLXaaE3jet8xXaSf` | `3112b03a…` | nein | — | Full | 0.214 | 2026-09-18 16:03 | 30 / 34 / 35 | O O O O 0000-1700 C 1700-2400 | Mo–Fr um 04:00 und 16:00 UTC offen, Wochenende geschlossen |
| B | FX.USD/CHF | FX | alt/1 | Dritter | `5DQUzCa6WWWC2SEvBeZWnMMD56P7xAPLyG8YUDJiUR1f` | `0b1e3297…` | nein | — | Full | 0.242 | 2026-09-18 16:02 | 30 / 34 / 35 | O O O O 0000-1700 C 1700-2400 | Mo–Fr um 04:00 und 16:00 UTC offen, Wochenende geschlossen |
| B | FX.USD/JPY | FX | alt/1 | Dritter | `CwBQ9DSavQnxRsGu1bu1tQsaQHQxaAB9KbFqdShpvhfd` | `ef2c98c8…` | nein | — | Full | 0.318 | 2026-09-18 16:03 | 10 / 15 / 15 | O O O O 0000-1700 C 1700-2400 | Mo–Fr um 04:00 und 16:00 UTC offen, Wochenende geschlossen |
| B | FX.USD/MXN | FX | alt/1 | Dritter | `CVxXPMUEKMG5Sq8VcK2M8dcC3cr2NyphUcqrA9YM6cDP` | `e13b1c1f…` | nein | — | Full | 0.469 | 2026-09-18 16:03 | 29 / 35 / 39 | 0000-1700&1800-2400 0000-1700&1800-2400 0000-1700&1800-2400 0000-1700&1800-2400 0000-1700 C 1800-2400 | Mo–Fr um 04:00 und 16:00 UTC offen, Wochenende geschlossen |
| B | Metal.XAG/USD | Metal | alt/1 | Dritter | `BBPKw61y5Vj13EsVngdCJei4BDaXRJwyF1FULipxBvov` | `f2fb02c3…` | nein | — | Full | 1.229 | 2026-09-18 16:03 | 10 / 15 / 15 | 0000-1700&1800-2400 0000-1700&1800-2400 0000-1700&1800-2400 0000-1700&1800-2400 0000-1700 C 1800-2400 | Mo–Fr um 04:00 und 16:00 UTC offen, Wochenende geschlossen |
| B | Metal.XAU/USD | Metal | alt/1 | Dritter | `2UK6JWZKvqFwU7mAt76TePbtNn99MPzKMqZNq4DEPbCa` | `765d2ba9…` | nein | — | Full | 0.286 | 2026-09-18 16:03 | 10 / 15 / 15 | 0000-1700&1800-2400 0000-1700&1800-2400 0000-1700&1800-2400 0000-1700&1800-2400 0000-1700 C 1800-2400 | Mo–Fr um 04:00 und 16:00 UTC offen, Wochenende geschlossen |
| B | Metal.XPD/USD | Metal | alt/1 | Dritter | `BeebZKwDzgdpYbwr43WBMJQ49yBkWfmBAa5uv1YH2DPQ` | `80367e96…` | nein | — | Full | 12.358 | 2026-09-18 16:02 | 29 / 34 / 35 | 0000-1700&1800-2400 0000-1700&1800-2400 0000-1700&1800-2400 0000-1700&1800-2400 0000-1700 C 1800-2400 | Mo–Fr um 04:00 und 16:00 UTC offen, Wochenende geschlossen |
| B | Metal.XPT/USD | Metal | alt/1 | Dritter | `7AUJuSSSeqAUyXtxBsa1rpwE8kwLJHtPXtnUmweBmKrr` | `398e4bbc…` | nein | — | Full | 4.497 | 2026-09-18 16:02 | 30 / 34 / 35 | 0000-1700&1800-2400 0000-1700&1800-2400 0000-1700&1800-2400 0000-1700&1800-2400 0000-1700 C 1800-2400 | Mo–Fr um 04:00 und 16:00 UTC offen, Wochenende geschlossen |
| C | Crypto.AAPLX/USD | Crypto | neu/0 | nicht belegt | `B6c2xp8MVqPMstapch9UUZWryXJXJwFBhuxivfBvA6P2` | `978e6cc6…` | nein | — | Full | 5.371 | 2026-09-18 16:00 | 595 / 595 / 595 | 24/7 | Takt p50 595 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.AMZNX/USD | Crypto | neu/0 | nicht belegt | `37ZQf35L4b81hTQKfasJXCrQqpihUBwognJnaX5DikEm` | `7148fbe6…` | nein | — | Full | 5.927 | 2026-09-18 16:00 | 595 / 595 / 595 | 24/7 | Takt p50 595 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.CASH/USD | Crypto | neu/0 | Pyth (Liste) | `GqsXNN8rwNhshF62ViNhgL7hZRtNSWSxy6UXWhNxtumF` | `df3320ef…` | ja | available | Full | 6.387 | 2026-09-18 16:03 | 29 / 40 / 40 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.CASH/USD | Crypto | alt/0 | Pyth (Liste) | `F23Xi7VQw1pdre26VmuKnjRcDcrhpqGtHkGdKdSdbM8w` | `df3320ef…` | ja | available | Full | 6.437 | 2026-09-18 16:02 | 30 / 35 / 45 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.CBBTC/USD | Crypto | neu/0 | nicht belegt | `FABsR4ySfXEhnjaozjs5rYHt9vVHm2enwDmk6gAF82tJ` | `2817d7bf…` | nein | — | Full | 8.063 | 2026-09-18 15:58 | 270 / 271 / 271 | 24/7 | Takt p50 270 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.CBBTC/USD | Crypto | alt/0 | nicht belegt | `7oqYpv5YbjJ2PEsNeVVB5ZEZ8ZE6ufkj8hAvAiaiftbe` | `2817d7bf…` | nein | — | Full | 5.947 | 2026-09-18 15:59 | 270 / 275 / 275 | 24/7 | Takt p50 270 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.COINX/USD | Crypto | neu/0 | nicht belegt | `GRm3Xf3jft71aGp1GdRM7jjRA6SV47FZ4c1uwCJf4nrE` | `641435d5…` | nein | — | Full | 4.692 | 2026-09-18 16:00 | 595 / 595 / 595 | 24/7 | Takt p50 595 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.CRCLX/USD | Crypto | neu/0 | nicht belegt | `FFxq8yAdD4QzpnZqEFByJK18wncmvQB5pRwk9kqiAzTa` | `c1318446…` | nein | — | Full | 6.595 | 2026-09-18 15:55 | – | 24/7 | in 20 min kein zweites Update |
| C | Crypto.DBR/USD | Crypto | neu/0 | nicht belegt | `6gHq3yesNSiDuUHQf2JhKGLAf7mc5GyVRN1UypHs2UL8` | `f788488f…` | nein | — | Full | 7.179 | 2026-09-18 16:01 | 271 / 271 / 271 | 24/7 | Takt p50 271 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.EURC/USD | Crypto | neu/0 | Pyth (Liste) | `ADqJt6hnH1b2eLdZM9XzASUwBgDXfyqxMeeQJK3oqezu` | `76fa8515…` | ja | available | Full | 2.006 | 2026-09-18 16:02 | 54 / 55 / 60 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.EURC/USD | Crypto | alt/0 | Pyth (Liste) | `HyBsZY1UiGttbQ3ppBmnFVss9rmDAEvEbtYxdfjNAqBZ` | `76fa8515…` | ja | available | Full | 2.129 | 2026-09-18 16:03 | 54 / 55 / 64 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.GOAT/USD | Crypto | neu/0 | nicht belegt | `7PDgyLeib2iuxdddnhuHXYz5iLAdyMiwTHbzNJDGNHZS` | `f7731dc8…` | nein | — | Full | 11.265 | 2026-09-18 16:01 | 271 / 271 / 271 | 24/7 | Takt p50 271 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.GOOGLX/USD | Crypto | neu/0 | nicht belegt | `h4iDswBaZ6dXUaHG5XUX1NDoVBReakBP4ByZWeURGpg` | `b911b032…` | nein | — | Full | 5.44 | 2026-09-18 16:00 | 595 / 595 / 595 | 24/7 | Takt p50 595 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.JUPUSD/USD | Crypto | neu/0 | Pyth (Liste) | `HKQmnfKCnXeJg5DhUnZXjFHDxrex6mPdrT9E29bcbfK2` | `8ed858a2…` | ja | available | Full | 1.889 | 2026-09-18 16:03 | 49 / 54 / 64 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.JUPUSD/USD | Crypto | alt/0 | Pyth (Liste) | `AqSwMCZYnEdnGoFCSLtWVnWf4xyCJuePcztmYWq8SBwp` | `8ed858a2…` | ja | available | Full | 1.891 | 2026-09-18 16:02 | 54 / 59 / 69 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.KMNO/USD | Crypto | neu/0 | nicht belegt | `G1q7dPgfae7JQXgAYS6m54rzzKntPV2bmBGaWW4vy3Sz` | `b17e5bc5…` | nein | — | Full | 3.576 | 2026-09-18 16:01 | 271 / 271 / 271 | 24/7 | Takt p50 271 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.META/USD | Crypto | neu/0 | nicht belegt | `H6GK5SY4aCdeH4Ss7ws89NaD5SqUFkgxA6UGp11pebjY` | `e379d8d3…` | nein | — | Full | 1.734 | 2026-09-18 13:36 | – | 24/7 | in 20 min kein zweites Update |
| C | Crypto.MON/USD | Crypto | neu/0 | nicht belegt | `DbyACw5UYonAJfx9pz4rLJqNGxVNK2fUhkVgZHM1oS5w` | `31491744…` | nein | — | Full | 5.177 | 2026-09-18 16:01 | 271 / 271 / 271 | 24/7 | Takt p50 271 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.MSTRX/USD | Crypto | neu/0 | nicht belegt | `4Jf6DZsTq23i3TBKjLWvn9iFAa18vZ1LAnMsAwe4yoyr` | `53f95ba4…` | nein | — | Full | 8.28 | 2026-09-18 16:00 | 590 / 590 / 590 | 24/7 | Takt p50 590 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.NVDAX/USD | Crypto | neu/0 | nicht belegt | `VSgf6jkwrcs9jbLuR57iN1Gk2c68vT9stZe8G6GGix2` | `4244d078…` | nein | — | Full | 3.861 | 2026-09-18 16:00 | 590 / 590 / 590 | 24/7 | Takt p50 590 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.ORCA/USD | Crypto | neu/0 | nicht belegt | `AdyHFQj2pNmujE8GsToxaeQjYRkkMxpjfZnxp34YUAzi` | `37505261…` | nein | — | Full | 8.682 | 2026-09-18 15:58 | 270 / 271 / 271 | 24/7 | Takt p50 270 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.PAXG/USD | Crypto | neu/0 | nicht belegt | `AwBRZ5QYW8RhcF4EJaU1WSn42cPQFZU3yvSDg1uSh748` | `273717b4…` | nein | — | Full | 4.578 | 2026-09-18 16:00 | 590 / 590 / 590 | 24/7 | Takt p50 590 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.PENGU/USD | Crypto | neu/0 | nicht belegt | `4gce7zkGgvpbNdkiGvq2VyvDzjRF6kmMDBTTh9DRhDkC` | `bed30970…` | nein | — | Full | 4.298 | 2026-09-18 16:01 | 271 / 271 / 271 | 24/7 | Takt p50 271 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.POPCAT/USD | Crypto | neu/0 | nicht belegt | `AyAMTHfsQVnXvNnHMqpaQo5sEpWSszoeqjEmdoEv1U9a` | `b9312a7e…` | nein | — | Full | 6.984 | 2026-09-18 16:01 | 271 / 271 / 271 | 24/7 | Takt p50 271 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.PYUSD/USD | Crypto | neu/0 | nicht belegt | `F1huL4wkpzHLezvKMXQMgrL6SN7CkG9fYWm4VWSmVbjw` | `c1da1b73…` | nein | — | Full | 2.781 | 2026-09-18 15:58 | 5 / 693 / 693 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.RAY/USD | Crypto | neu/0 | nicht belegt | `89rK7LjPkBFPVGVNpUJS4rheKhXZFjf8dBmpcN3yaqds` | `91568baa…` | nein | — | Full | 2.973 | 2026-09-18 16:01 | 271 / 271 / 271 | 24/7 | Takt p50 271 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.SPYX/USD | Crypto | neu/0 | nicht belegt | `27Tv3HxU34AKxZ8MgfFAA1gCbWa96msMG5BvSWAHkBfj` | `2817b784…` | nein | — | Full | 3.907 | 2026-09-18 16:00 | 590 / 590 / 590 | 24/7 | Takt p50 590 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.SUSDE/USD | Crypto | neu/0 | nicht belegt | `GkCdemGNMcU32PhThpkV9P45q2MnRDHh7HzAD65ocmBS` | `ca3ba9a6…` | nein | — | Full | 3.734 | 2026-09-18 16:01 | 271 / 271 / 271 | 24/7 | Takt p50 271 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.SYRUPUSDC/USD | Crypto | neu/0 | Pyth (Liste) | `J5mAPU6cDvcd1n93MV9UQorebarSAYS6w2cVYYskc1oB` | `e616297d…` | ja | available | Full | 32.368 | 2026-09-18 16:02 | 54 / 55 / 60 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.SYRUPUSDC/USD | Crypto | alt/0 | Pyth (Liste) | `DXXf1c9pGf17sJp3DNgAC7p5J57KUatyJzG2uFXEP8KV` | `e616297d…` | ja | available | Full | 32.42 | 2026-09-18 16:03 | 54 / 55 / 64 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.TSLAX/USD | Crypto | neu/0 | nicht belegt | `G8EJV1bqPydBCFZJ2neo1hsrwp2Hwt2ZqJTLG2gotcP2` | `47a15647…` | nein | — | Full | 9.617 | 2026-09-18 16:00 | 590 / 590 / 590 | 24/7 | Takt p50 590 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.USD1/USD | Crypto | neu/0 | Pyth (Liste) | `8QepbjtuRqRrh3R2vZoJGeoBGXQkwjib1W9LeRMzU7jC` | `0a2425d4…` | ja | available | Full | 4.549 | 2026-09-18 16:02 | 54 / 55 / 60 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.USD1/USD | Crypto | alt/0 | Pyth (Liste) | `GD6upLUF69QYJMBXPNPv6yPyfSahhEB2FpXbsSRuH8zH` | `0a2425d4…` | ja | available | Full | 4.402 | 2026-09-18 16:03 | 54 / 55 / 64 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.USDC/USD | Crypto | neu/0 | Pyth (Liste) | `6HAuqASbHEh4w4REJEUUUCginTLfj1kwCh215ZLtMkrT` | `eaa020c6…` | ja | available | Full | 4.504 | 2026-09-18 16:03 | 5 / 5 / 14 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.USDC/USD | Crypto | alt/0 | Pyth (Liste) | `Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX` | `eaa020c6…` | ja | available | Full | 4.557 | 2026-09-18 16:02 | 54 / 59 / 59 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.USDE/USD | Crypto | neu/0 | Pyth (Liste) | `H1rdeheBg7vQ6X8WnY3JxDcCDSu3GVNEv1hpkkjGuMto` | `6ec879b1…` | ja | available | Full | 1.465 | 2026-09-18 16:02 | 54 / 55 / 59 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.USDE/USD | Crypto | alt/0 | Pyth (Liste) | `Cr8vurLth4b7CFNdvoXDpxuRi21CWvbQFLKy8BTwN4Wf` | `6ec879b1…` | ja | available | Full | 1.489 | 2026-09-18 16:03 | 54 / 55 / 64 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.USDG/USD | Crypto | neu/0 | nicht belegt | `Gf58wkSwsrEVphGbagXgbp5BEaUbkJfCm1vp8jfehj3L` | `daa58c6a…` | nein | — | Full | 4.265 | 2026-09-18 16:00 | 271 / 271 / 271 | 24/7 | Takt p50 271 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.USDG/USD | Crypto | alt/0 | nicht belegt | `6JkZmXGgWnzsyTQaqRARzP64iFYnpMNT4siiuUDUaB8s` | `daa58c6a…` | nein | — | Full | 4.082 | 2026-09-18 15:59 | 270 / 275 / 275 | 24/7 | Takt p50 270 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.USDS/USD | Crypto | neu/0 | nicht belegt | `BC1J4HFFraWf5dnp1wPJWNXkkoMDoHn7v18gzcbh6aGf` | `77f0971a…` | nein | — | Full | 5.069 | 2026-09-18 15:58 | 152 / 270 / 270 | 24/7 | Takt p50 152 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.USDT/USD | Crypto | neu/0 | Pyth (Liste) | `3XBYLaF9wisQLaCxTgchH6xeNJGchwDauGpot1GcRMZV` | `2b89b9dc…` | ja | available | Full | 1.178 | 2026-09-18 16:02 | 49 / 55 / 59 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.USDT/USD | Crypto | alt/0 | Pyth (Liste) | `HT2PLQBcG5EiCcNSaMHAjSgd9F98ecpATbk4Sk5oYuM` | `2b89b9dc…` | ja | available | Full | 1.147 | 2026-09-18 16:02 | 54 / 59 / 59 | 24/7 | Stablecoin, Ausgang praktisch fest |
| C | Crypto.USDY/USD | Crypto | neu/0 | nicht belegt | `CUGbUPs6SBA1dF12GCFrcGrgdWDxAezB1SqSk7HhoZq` | `e393449f…` | nein | — | Full | 6.289 | 2026-09-18 16:00 | 595 / 595 / 595 | 24/7 | Takt p50 595 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.USX/USD | Crypto | neu/0 | nicht belegt | `A2vekGVVbR6Xoen51og5i2xTfaWTtErMRveGFGSGxQP8` | `80950327…` | nein | — | Full | 0.139 | 2026-09-18 16:01 | 182 / 271 / 271 | 24/7 | Takt p50 182 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.WETH/USD | Crypto | neu/0 | nicht belegt | `DhPJotUrEsgC51EoYwb6TMX1BocGx2MLbCmRG8GTxt2r` | `9d4294bb…` | nein | — | Full | 17.18 | 2026-09-18 16:00 | 595 / 595 / 595 | 24/7 | Takt p50 595 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.XBTC/USD | Crypto | neu/0 | nicht belegt | `Dii1Sek3bwCszPwLpeBdjDhiiHg2VPrNBZbRD3wAMSFB` | `ae8f269e…` | nein | — | Full | 49.744 | 2026-09-18 16:01 | 271 / 271 / 271 | 24/7 | Takt p50 271 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.NAV.ACRED/USD | Crypto NAV | neu/0 | Pyth (Liste) | `3an2gaeUKhvDBhTP1M7ocqDaX7Nqw36jPr8zwrMXjL6N` | `40ac3329…` | ja | available | Full | 0 | 2026-09-18 16:02 | 54 / 55 / 59 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.NAV.ACRED/USD | Crypto NAV | alt/0 | Pyth (Liste) | `6gyQ2TKvvV1JB5oWDobndv6BLRWcJzeBNk9PLQ5uPQms` | `40ac3329…` | ja | available | Full | 0 | 2026-09-18 16:03 | 54 / 59 / 64 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.NAV.ONYC/USD | Crypto NAV | neu/0 | nicht belegt | `81yWm9JDhCGgzxWivVkz4tZAEJxYE1VB8tMKKEFbTx71` | `babbfcc7…` | nein | — | Full | 0 | 2026-09-18 16:03 | 5 / 5 / 19 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.NAV.USCC/USD | Crypto NAV | neu/0 | Pyth (Liste) | `J3iEibToYJMWZ2d8b189QuhzSu8C7rSVYbsMxaYE5yq7` | `5d73a595…` | ja | available | Full | 0 | 2026-09-18 16:02 | 54 / 55 / 59 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.NAV.USCC/USD | Crypto NAV | alt/0 | Pyth (Liste) | `823Y4cV7XH2TzkB9NdHfTRoCKLrqXv8EgQP5nzEG43Hp` | `5d73a595…` | ja | available | Full | 0 | 2026-09-18 16:03 | 54 / 54 / 74 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.NAV.USTB/USD | Crypto NAV | neu/0 | Pyth (Liste) | `FawNuE6ZmYJjHeYfsQGmmqrNNabWL5wfDTX9vrzroW2S` | `dea78edd…` | ja | available | Full | 0 | 2026-09-18 16:02 | 54 / 55 / 59 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.NAV.USTB/USD | Crypto NAV | alt/0 | Pyth (Liste) | `EqggHKbjePzmXAX6MW3EsgjiJ4mhkbb8j5s5KfGs1gLq` | `dea78edd…` | ja | available | Full | 0 | 2026-09-18 16:03 | 54 / 54 / 74 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.CASH/RD.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `AftThCx4rMSYFJ8fLXjpiaMqMDix7fD8XqJEetddUKAM` | `64c74ffd…` | ja | available | Full | 0.003 | 2026-09-18 16:03 | 30 / 40 / 40 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.CASH/RD.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `7ELVkNXhZLJGdwPGps8sEBgs583TewjZoRzgf9Zdp5T8` | `64c74ffd…` | ja | available | Full | 0.003 | 2026-09-18 16:02 | 29 / 35 / 45 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.DSOL/SOL.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `8JwKa4Qs2tXxo3FMcKPBDcvMfiHF2HQaWjFELDtTq4mG` | `fce16340…` | ja | available | Full | 0 | 2026-09-18 16:02 | 50 / 55 / 59 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.DSOL/SOL.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `LeE5Lq1vBahDREJysyeoqZ1NwuZEjAL8oM5Vb949fQZ` | `fce16340…` | ja | available | Full | 0 | 2026-09-18 16:03 | 54 / 55 / 64 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.EHYUSD/JITOSOL.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `HVj3u7iEqnBJDve4nBVro7aa2YSz8Zb1v3XvQeZ2KHLW` | `9773ee09…` | ja | available | Full | 3.682 | 2026-09-18 15:01 | – | 24/7 | in 20 min kein zweites Update |
| C | Crypto.EHYUSD/JITOSOL.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `HMatQq5HdiChYGDnTfggJpQPVBnQPgJnxbLzmPbxa3F7` | `9773ee09…` | ja | available | Full | 3.682 | 2026-09-18 15:01 | – | 24/7 | in 20 min kein zweites Update |
| C | Crypto.EUSX/USX.RR | Crypto Redemption Rate | neu/0 | nicht belegt | `Fu9y6QEEiBTPnmPmkLLJBV7ZEKXsjQHyEdMWobNnsEkc` | `f36e12e6…` | nein | — | Full | 9.872 | 2026-09-18 16:01 | 271 / 271 / 271 | 24/7 | Takt p50 271 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.HYUSD/JITOSOL.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `4SNPS6Q9GWBSxGiqv5rH4utVeCL2UfxKQgpXUqztNHGa` | `36d77e38…` | ja | available | Full | 307.017 | 2026-09-18 16:02 | 59 / 59 / 69 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.HYUSD/JITOSOL.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `BaXuqaNFuWPg7v5kDFE8sC1d3S2xnZx5AJMG1qTRf3TE` | `36d77e38…` | ja | available | Full | 307.032 | 2026-09-18 16:02 | 59 / 60 / 74 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.HYUSD/USD.RR | Crypto Redemption Rate | neu/0 | nicht belegt | `2hADaCUP7asWEuUKRRTy8M1z9XBJjtYmVKCbnp8LJJmj` | `4a599c2e…` | nein | — | Full | 0.88 | 2026-09-18 16:02 | 295 / 309 / 309 | 24/7 | Takt p50 295 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.INF/SOL.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `5gsMphAZgUknRbuo1DPA7iwrX3ahGpR59B8mmnn15PBE` | `3e9961b8…` | ja | available | Full | 2.136 | 2026-09-18 16:02 | 54 / 55 / 59 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.INF/SOL.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `4MbCk4vH47K2gHee6nTg62KScpGu2bV3YDeTZtpQm3ro` | `3e9961b8…` | ja | available | Full | 2.131 | 2026-09-18 16:03 | 54 / 55 / 64 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.JITOSOL/SOL.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `2bDeHa8T3GeRwTMjvKegDgCAcSU9DMKR52xLn8pJW19p` | `01d577b0…` | ja | available | Full | 0 | 2026-09-18 16:02 | 50 / 55 / 59 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.JITOSOL/SOL.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `CmGnCwUEYC7Kp9Sca4ULJRckSR8eJKLFTk1ed3wwGc78` | `01d577b0…` | ja | available | Full | 0 | 2026-09-18 16:03 | 54 / 55 / 64 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.JUPSOL/SOL.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `AzEhiYKye59fHPL7PzNzZ6rTD9HWdakWEpPu49gnoYAM` | `f8d8d6b6…` | ja | available | Full | 0 | 2026-09-18 16:02 | 54 / 55 / 59 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.JUPSOL/SOL.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `D7UqeBmCEmhGXGYfi2y9RfoCa7t1Xw5iZLBeYZ3sxFSe` | `f8d8d6b6…` | ja | available | Full | 0 | 2026-09-18 16:03 | 54 / 59 / 64 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.MSOL/SOL.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `2y7guvgebzBFepcAEpXUDAQNBpwo2Zv11D4q1ix6L8w2` | `046e7c1c…` | ja | available | Full | 0 | 2026-09-18 16:02 | 50 / 55 / 59 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.MSOL/SOL.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `DDUdB7TwNtJJyHwQB36AqYSp5SUwKf8TUfXdJJr5R2J6` | `046e7c1c…` | ja | available | Full | 0 | 2026-09-18 16:03 | 54 / 55 / 64 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.NALPHA/USD.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `5bFvcgXYshesx2Q6Q1AZM8UW5myFbbttxt6AHSxT56Qn` | `57d1e11b…` | ja | available | Full | 0 | 2026-09-18 16:02 | 54 / 55 / 59 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.NALPHA/USD.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `DihTptVgZNyfxN5ya1V5XThRJHhzZ4V2RAPpwvNXkxUK` | `57d1e11b…` | ja | available | Full | 0 | 2026-09-18 16:03 | 54 / 55 / 64 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.NBASIS/USD.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `FGbsobLknh2u1eH7Q4DV2u85HBopwLHw59fHqVwMbHXY` | `fd9397e6…` | ja | available | Full | 12.152 | 2026-09-18 16:02 | 54 / 55 / 59 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.NBASIS/USD.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `Cv7ZRaS7vezPHVfYBYqUvaXBqh9VABbC1JDczCHzAd3j` | `fd9397e6…` | ja | available | Full | 12.152 | 2026-09-18 16:03 | 54 / 55 / 64 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.NFALCON/USD.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `DRduiCSF6NGLzHHeny5hWwprvrhoHy9VXADt95hTsAyi` | `32364732…` | ja | available | Full | 0 | 2026-09-18 16:02 | 59 / 64 / 74 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.NFALCON/USD.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `6MKpWqGCLcwURBGKaCQiGem1hQVUsSixymRZcPvfnhRC` | `32364732…` | ja | available | Full | 0 | 2026-09-18 16:02 | 59 / 60 / 69 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.NOPAL/USD.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `39ja2SDYj1BsSyatXgSdNrgtxuory42cjNJFL2PKuAAU` | `8858dfaa…` | ja | available | Full | 0 | 2026-09-18 16:02 | 54 / 55 / 59 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.NOPAL/USD.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `3GDZNVfeYJupHxj65tyCC44HW5NHPTycBihFrCEcDTBj` | `8858dfaa…` | ja | available | Full | 0 | 2026-09-18 16:03 | 54 / 55 / 64 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.NWISDOM/USD.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `FKKTbU8zok5wGYYUJdX7Xp99zmSVqVJoe2BFuhWAWJaj` | `384986c9…` | ja | available | Full | 0 | 2026-09-18 16:02 | 54 / 55 / 59 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.NWISDOM/USD.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `CTwo3uNzA3Pj1aJRN77Xi7icfq9Q53JWTfppUrEYHfhC` | `384986c9…` | ja | available | Full | 0 | 2026-09-18 16:02 | 54 / 59 / 64 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.PST/USDC.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `2r3AysmX5q9Jo6vznSrkwZxV1wqs9FNniUd8tf2n66oq` | `675e36f8…` | ja | available | Full | 0 | 2026-09-18 16:03 | 5 / 5 / 19 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.PST/USDC.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `CBGwQddTeYn3KdvxGWtU95fqCcavzHK9XPFBLENDF5JR` | `675e36f8…` | ja | available | Full | 7.169 | 2026-09-18 16:00 | 221 / 226 / 226 | 24/7 | Takt p50 221 s, zu langsam für einen Stichzeitpunkt |
| C | Crypto.RKUSOL/SOL.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `E4P6yCg9WkDFZ5dS34VyutWnFk2wA1gZxTvjDLCjPRej` | `a0eccdd4…` | ja | available | Full | 0 | 2026-09-18 16:02 | 54 / 55 / 59 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.RKUSOL/SOL.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `AWyj5oLQYVGhwHjB4z7Xhrshp3nK9cdJdvv5zeHSU55S` | `a0eccdd4…` | ja | available | Full | 0 | 2026-09-18 16:02 | 54 / 59 / 64 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.SSOL/SOL.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `9qYStiZz65fSGkpTsk1niVYifjK34d79hMbpNNcwDxTd` | `add6499a…` | ja | available | Full | 0 | 2026-09-18 16:02 | 54 / 55 / 59 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.SSOL/SOL.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `2doCYXwYNt2FhzfCdgpW4YAwczvdzB27xtJkzQd5Kre2` | `add6499a…` | ja | available | Full | 0 | 2026-09-18 16:03 | 54 / 59 / 64 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.SYRUPUSDC/USDC.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `6qxpjnkoYKJ9E1ez1Gu1tuJ9zex4tYBkPiNpG1XCbpQT` | `2ad31d1c…` | ja | available | Full | 0 | 2026-09-18 16:02 | 54 / 55 / 59 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.SYRUPUSDC/USDC.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `GWdwWDhYFUc8ZD6uCTtEAAwx97V1ZCsxPWGL7vhSha6w` | `2ad31d1c…` | ja | available | Full | 0 | 2026-09-18 16:02 | 54 / 59 / 64 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.XSOL/JITOSOL.RR | Crypto Redemption Rate | neu/0 | Pyth (Liste) | `F2Xn7pUNgjkC9V5ZLrKmgV6Seh5CuiAr43qe2QmPVrb6` | `332e31d3…` | ja | available | Full | 375.449 | 2026-09-18 16:02 | 59 / 60 / 74 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Crypto.XSOL/JITOSOL.RR | Crypto Redemption Rate | alt/0 | Pyth (Liste) | `E54fqWx342CY6aQqXmtDDauUypvP9SK7KUnARJyyTV9W` | `332e31d3…` | ja | available | Full | 375.485 | 2026-09-18 16:02 | 59 / 60 / 69 | 24/7 | Umtauschkurs/NAV, kein Marktpreis |
| C | Equity.US.AAPL/USD | Equity | alt/1 | Dritter | `D9uk39pqZMcnmtPP9WeC8cREUpKZmyXLga9mSQ79SphW` | `49f6b65c…` | nein | — | Full | 0.639 | 2026-09-18 16:03 | 10 / 15 / 15 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |
| C | Equity.US.AMD/USD | Equity | alt/1 | Dritter | `4est8NR419iGFnMvEVczBW1cCMstB6N2xK54TaCanCN1` | `3622e381…` | nein | — | Full | 1.38 | 2026-09-18 16:03 | 10 / 15 / 19 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |
| C | Equity.US.AMZN/USD | Equity | alt/1 | Dritter | `4eT5d4SJ7GjD8HMpMysSNoPV7RBVTBGzoSEkynmPLMPS` | `b5d0e0fa…` | nein | — | Full | 0.988 | 2026-09-18 16:03 | 10 / 15 / 19 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |
| C | Equity.US.CRWV/USD | Equity | alt/1 | Dritter | `6MgWmNscPXnj77YazE7qH27fgWn28QRtYr8iELw5b8zR` | `2a78b781…` | nein | — | Full | 1.873 | 2026-09-18 16:03 | 10 / 15 / 15 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |
| C | Equity.US.GLXY/USD | Equity | neu/0 | Pyth (Liste) | `EVH2jJ6vTKrUz4jpkGQzXysFM78X7GN9uegUcA9oavWB` | `67e031d1…` | ja | available | Full | 6.267 | 2026-09-18 16:02 | 54 / 54 / 64 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |
| C | Equity.US.GLXY/USD | Equity | alt/0 | Pyth (Liste) | `EHEfCJoRUewTW91Lv2k33eLW72JkbxbVH6YsisTskg1n` | `67e031d1…` | ja | available | Full | 6.28 | 2026-09-18 16:02 | 54 / 55 / 59 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |
| C | Equity.US.GOOGL/USD | Equity | alt/1 | Dritter | `7aUtbtC3o3GVwRWvaDp5fxKjBq53QL3UrVmDzDgeNo8M` | `5a48c03e…` | nein | — | Full | 0.858 | 2026-09-18 16:03 | 10 / 15 / 15 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |
| C | Equity.US.INTC/USD | Equity | alt/1 | Dritter | `FK3GQy2PjQ18G2yPEV8eTpK8GFPoTFkVYhFcWmDc3rRG` | `c1751e08…` | nein | — | Full | 0.935 | 2026-09-18 16:03 | 10 / 15 / 19 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |
| C | Equity.US.META/USD | Equity | alt/1 | Dritter | `6NJCSCAWy1yB1jEGhPbsMTrT4WH13o8BGD5wgPbBtdY9` | `78a3e3b8…` | nein | — | Full | 1.238 | 2026-09-18 16:03 | 10 / 15 / 15 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |
| C | Equity.US.MSFT/USD | Equity | alt/1 | Dritter | `EKhrgXYwqsjgxF71Gxznui1zdoeqgxJzzPzfefEmm5un` | `d0ca23c1…` | nein | — | Full | 0.91 | 2026-09-18 16:03 | 10 / 15 / 15 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |
| C | Equity.US.MSTR/USD | Equity | alt/1 | Dritter | `KDQSrjsiur6YxyuY4veB7Gd13MKhwNoMZTQWvx1c93S` | `e1e80251…` | nein | — | Full | 1.681 | 2026-09-18 16:03 | 10 / 15 / 15 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |
| C | Equity.US.MU/USD | Equity | alt/1 | Dritter | `4eMZuk9khRP5uMnk5f1i1uA8joNMcHtBwDGCstW65bai` | `152244dc…` | nein | — | Full | 1.171 | 2026-09-18 16:03 | 10 / 15 / 15 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |
| C | Equity.US.NVDA/USD | Equity | alt/1 | Dritter | `5VETJ8h3p4JrESYrzhjTDAWPEjDjfcnduqe9CjxgqBNd` | `b1073854…` | nein | — | Full | 0.458 | 2026-09-18 16:03 | 10 / 15 / 15 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |
| C | Equity.US.QQQ/USD | Equity | alt/1 | Dritter | `TWtoAxPvaXy46uy3Vr4UwFxmWdgyMjpZAJSFxV4RGbF` | `9695e2b9…` | nein | — | Full | 0.219 | 2026-09-18 16:03 | 10 / 15 / 15 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |
| C | Equity.US.SNDK/USD | Equity | alt/1 | Dritter | `GfKS3Bk6MBMAM4ZpxYSJZ1f2pfSHmVmycYMH9DmzCZ8a` | `c86a1f20…` | nein | — | Full | 2.803 | 2026-09-18 16:03 | 10 / 15 / 15 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |
| C | Equity.US.SPY/USD | Equity | alt/1 | Dritter | `CRDaGwcVnKdRNRtx6fjHtvrBgKM5U55AhbqBWhtPMDA` | `19e09bb8…` | nein | — | Full | 0.197 | 2026-09-18 16:03 | 10 / 15 / 15 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |
| C | Equity.US.TSLA/USD | Equity | alt/1 | Dritter | `FQB8c4zB8Emrp9W8bmyk6GanCLq4aRytHYPDAnaEpq9z` | `16dad506…` | nein | — | Full | 0.978 | 2026-09-18 16:03 | 10 / 15 / 15 | 0930-1600 0930-1600 0930-1600 0930-1600 0930-1600 C C | werktags 04:00 UTC geschlossen |

## Ruhende Konten (285)
Existieren, aber letzter publish_time älter als 24 h. Nicht nutzbar.

<details><summary>Liste aufklappen</summary>

| Feed | Klasse | Stack/Shard | Konto | letzter publish_time (UTC) | Pyth-Liste |
|---|---|---|---|---|---|
| Crypto.AAPLX/AAPL.RR | Crypto Redemption Rate | alt/0 | `4vuxa9hrEi3uWZinS3K3tGvFu9fx6KJuefgdoaoBefLS` | 2026-07-21 | nein |
| Crypto.AAPLX/USD | Crypto | alt/0 | `Gs4DVtiGSJ9LJvXaQFjYp6vhLNK2QsH4qWox2ck1kuMp` | 2026-09-12 | nein |
| Crypto.ACT/USD | Crypto | alt/1 | `3tv967gcDDK9ZbWZP99CgsP6yjSShUYeAiom1pY2TEFL` | 2024-12-04 | nein |
| Crypto.ACT/USD | Crypto | neu/0 | `2KmosZWhnSedyhAtBbSSBRfATa4f7nkFQSMtKdk7iFnW` | 2026-06-04 | nein |
| Crypto.ADA/USD | Crypto | neu/0 | `AESDzoBwfQkMo2qdxGpsG4cZgMp5xxqABdYBxJqwaDNs` | 2026-06-04 | nein |
| Crypto.AIXBT/USD | Crypto | alt/1 | `4H9y6AXAp5CDxavMYaKLqvZ1pozKWhm8E5hp99UNKzQJ` | 2025-06-11 | nein |
| Crypto.AIXBT/USD | Crypto | neu/0 | `AMKK3Z8EuMWxtfmETUB1VLQ1poJJHkCgrTkuLZk7qjWz` | 2026-06-04 | nein |
| Crypto.AMZNX/USD | Crypto | alt/0 | `HVWLZ3JEY6nV1zKtAmdsNsUm99SrYs4b5MGVCJkeAZ66` | 2026-09-12 | nein |
| Crypto.APE/USD | Crypto | alt/1 | `Bb9hUhkxYPF45KpLMY28WvMr7NvG9rd87KxvSAbaRij3` | 2026-08-12 | nein |
| Crypto.APE/USD | Crypto | neu/0 | `BAwJuVBsNfF28KQvyr5wieDy6umcQGwZi1UbbrWNmnmp` | 2026-06-04 | nein |
| Crypto.APT/USD | Crypto | alt/0 | `9oR3Uh2zsp1CxLdsuFrg3QhY2eZ2e5eLjDgDfZ6oG2ev` | 2025-05-01 | nein |
| Crypto.APT/USD | Crypto | alt/1 | `F3nJLLMbNz9MJhiQ4So2Y5SgsRPhgpyfEsfqSw3nCAs4` | 2024-09-15 | nein |
| Crypto.ARB/USD | Crypto | alt/0 | `36XiLSLUq1trLrK5ApwWs6LvozCjyTVgpr2uSAF3trF1` | 2025-05-13 | nein |
| Crypto.ARB/USD | Crypto | alt/1 | `Fm8a8nif7Ls9MzBonTm1MoqGpYG5sELyA2SyQseQjKcB` | 2026-08-12 | nein |
| Crypto.ARC/USD | Crypto | neu/0 | `AHDjfXzhAcMAbccKxde85zVCvJyoo7SEAv8M6Bh5TSkT` | 2026-06-04 | nein |
| Crypto.ASTR/USD | Crypto | neu/0 | `7bhB7LhdycNpgdyYiwxYQX5cVkBKfxFjeiKA4K7XL1Fo` | 2026-06-04 | nein |
| Crypto.AUSD/USD | Crypto | alt/0 | `669wSh7zdipR9SUHNqJYYCbDMx2KpcMigqDrXXtrViyZ` | 2026-08-18 | nein |
| Crypto.AUSD/USD | Crypto | neu/0 | `BfmtRFV55K7b1gkh6Kc9ccWjyFTbZHv9VKjvwnp9gCvD` | 2026-09-17 | nein |
| Crypto.AVAX/USD | Crypto | alt/0 | `HUBqpBf3aGJdVQndFHmMUd1eMcixt7S4swYPCx8A93K1` | 2026-08-18 | nein |
| Crypto.AVAX/USD | Crypto | neu/0 | `7jLdwNAevCi884eHYetEi569VEyCiEMv9qjXK4kG7nf5` | 2026-09-16 | nein |
| Crypto.BAT/USD | Crypto | alt/0 | `EHH5mjVUsBUF7jD9nFcvB5TnG1fi6U54hRRphAxsVAWQ` | 2026-08-18 | nein |
| Crypto.BAT/USD | Crypto | neu/0 | `h4sLcfmyrgPwAsmi2vGvKm3r22T4YRrAUKKRDQy7e44` | 2026-09-17 | nein |
| Crypto.BERA/USD | Crypto | alt/0 | `Ghby4XwpWnkmBnZ7a1SgBrwy2gEZE9P8HAWkHLUu6CDX` | 2025-05-01 | nein |
| Crypto.BIO/USD | Crypto | alt/0 | `6KyngSTLXWMNfdNqypV386z34KShV2er8RVYqx8naE1D` | 2026-05-06 | nein |
| Crypto.BIO/USD | Crypto | neu/0 | `2ACjaiVZqqevUE5Leea6e16j78XqRKuvXqBi3MgaztXi` | 2026-07-29 | nein |
| Crypto.BNB/USD | Crypto | alt/0 | `A3qp5QG9xGeJR1gexbW9b9eMMsMDLzx3rhud9SnNhwb4` | 2026-08-18 | nein |
| Crypto.BNB/USD | Crypto | neu/0 | `CzwLTJyGEKkZ7wAaGwdpTnH8829CLFQ5EemXH5rudFjk` | 2026-09-17 | nein |
| Crypto.BOME/USD | Crypto | neu/0 | `cRFGDe7w1QrhqachGWQuovMPraME9btXCJELYdBRbh1` | 2026-06-04 | nein |
| Crypto.BONK/USD | Crypto | alt/1 | `HvgYGERTSGTqt8qowUmTsxWHfsLJJYN4vSobwmEgofD1` | 2026-08-12 | nein |
| Crypto.BONK/USD | Crypto | neu/1 | `AcirTgizXxhV74VWRxq9HpCDHtiErXnsCfNAeaCGHvvZ` | 2026-05-06 | nein |
| Crypto.BRETT/USD | Crypto | neu/0 | `D6MkvzfwaCQpUK2jotaogFgKggSeidTowRGsy6kgCEGT` | 2026-06-04 | nein |
| Crypto.BSOL/USD | Crypto | alt/1 | `8X2okycACHzPNmMgsZDa5vDYyqcRWci1Vouzds4am7gj` | 2025-08-12 | nein |
| Crypto.BSOL/USD | Crypto | neu/1 | `7kmxxKR3899guiHuaToz4evJdBoe9mzp3EZTLudoQ9Rd` | 2026-05-06 | nein |
| Crypto.BTC/USD | Crypto | alt/2 | `6AqrcddYoHo62S2RPwGpLTqWrQE59fubjndTm2fRJ9Je` | 2024-04-11 | nein |
| Crypto.CAKE/USD | Crypto | alt/0 | `HM1TD8Ur5Cq535NhbxHTuavRof8PCeZBAhuSXboCoXrH` | 2026-08-18 | nein |
| Crypto.CAKE/USD | Crypto | neu/0 | `4mBoxBLjaZVMc1UL1wZW21i7gZbgedeQ5vS9ABriQQRj` | 2026-09-17 | nein |
| Crypto.CHILLGUY/USD | Crypto | alt/1 | `CVz2ngmTXULSavdyAUGKGUbJqiMKRJJfGNZ3X2SgJnkQ` | 2024-12-04 | nein |
| Crypto.CHILLGUY/USD | Crypto | neu/0 | `9dvbrgQrwKSs45btb7raRXfU5bpgTqVe5aHamgPS291B` | 2026-06-04 | nein |
| Crypto.CHZ/USD | Crypto | neu/0 | `9KcsM7iE3nM8Fm2fWWioZpkYkE1BJoeGCZCgzwmpnqKk` | 2026-06-04 | nein |
| Crypto.CLANKER/USD | Crypto | neu/0 | `CadF2ayxCDnWrZoTtaupHCJXmU5Kp8SJppEgyppjawcJ` | 2026-06-04 | nein |
| Crypto.COINX/COIN.RR | Crypto Redemption Rate | alt/0 | `4S9Labj9bT2CqRJb5uc36x54gZoN8JBc6eJYLTB2orBx` | 2026-07-20 | nein |
| Crypto.COINX/USD | Crypto | alt/0 | `6aCwE8Gu4vCY14BUYUsvPQgKNP3ELaBgaMcc3QdtG4c4` | 2026-09-12 | nein |
| Crypto.CORE/USD | Crypto | neu/0 | `42XkJi1Z22TdiYUmA6sQ4qHoVh9Uo6myBgiiQ8FikmRd` | 2026-06-04 | nein |
| Crypto.CRCLX/USD | Crypto | alt/0 | `8gfVVaN5jZVGGAYs11TNptaAbL851mTSt6eCoKaUL5CR` | 2026-09-12 | nein |
| Crypto.DAI/USD | Crypto | alt/0 | `FmfrxJ7YH8yVxoYpJ9ZDMeb8gUceYXYaSrQiBJ1uSZjN` | 2026-08-18 | nein |
| Crypto.DAI/USD | Crypto | neu/0 | `HwNekWzLUXhNxTJtpusjjUZtkAd822JB54grrZPHpM2h` | 2026-09-17 | nein |
| Crypto.DBR/USD | Crypto | alt/0 | `5jdovW9tF9p4Wzd5SECyq8nE2ujgf5ZguqE8HHcHenw3` | 2026-07-31 | nein |
| Crypto.DBR/USD | Crypto | alt/1 | `2aop1BtgTzxcJ1YjTDmFbTswb7vhiDGDfhdo2Hefz1pK` | 2025-05-13 | nein |
| Crypto.DEGEN/USD | Crypto | neu/0 | `HmjSLUXmF1aTFiCQAUboTGpGfrR2wkAya27h5T5q8rWW` | 2026-06-04 | nein |
| Crypto.DIME/USD | Crypto | neu/0 | `AJ8Pn7Xk6aQnFz4va6mj6YCEJ7vK4Pih3rAFYNMJyb47` | 2026-06-04 | nein |
| Crypto.DOGE/USD | Crypto | alt/0 | `681QkKLoAQrB5h23Ewq9c8rjM19RBuzqwXZf2RPr9Pyw` | 2026-09-12 | nein |
| Crypto.DOT/USD | Crypto | neu/0 | `EMaVHfbFsmBgDedcattamnvxJPQGcQHV5BqSCwWKjBHQ` | 2026-06-04 | nein |
| Crypto.DRIFT/USD | Crypto | alt/0 | `9iGAnDv9JbAfV5PUPif7mNu55FoBtJcysYWjfXPAy6ho` | 2026-06-23 | nein |
| Crypto.DRIFT/USD | Crypto | neu/0 | `DPPSTmqSoGJQ7CGa7XdZBTdvbZM9Jy9jbjsukuCYm9aB` | 2026-06-04 | nein |
| Crypto.DYDX/USD | Crypto | neu/0 | `6QPwuvDEEvRpbs7SwF3hrkkUAy5xFVBM41UUKmjHvWiA` | 2026-06-04 | nein |
| Crypto.DYM/USD | Crypto | alt/0 | `7RxdEbZV3ec7jfbUzVPucaDBY3KRY4FS797rmHHzYQSo` | 2025-05-01 | nein |
| Crypto.DYM/USD | Crypto | neu/0 | `9Gg4cXQKMPMLXBAtqmjUuw597uskoXqo6PxG8pW3Rrg9` | 2026-06-04 | nein |
| Crypto.EIGEN/USD | Crypto | alt/0 | `64x2TaUVMrmxGDCcWYntWR8TPrXA3uaC8TfX9997Kam` | 2025-05-01 | nein |
| Crypto.ELIZAOS/USD | Crypto | neu/0 | `2mi5fyxcaZBTnVH4yms32g5BGXxmhjS47e1j3HSpxCTG` | 2026-06-04 | nein |
| Crypto.ENA/USD | Crypto | neu/0 | `BNkvNFWRP1wcAPdRMaGhVZDbTuBLkP1uB4RhT9CRZRYk` | 2026-06-04 | nein |
| Crypto.ETH/BTC | Crypto | alt/0 | `5JwbqPPMNpzE2jVAdobWo6m5gkhsDhRdGBo3FYbSfmaK` | 2024-06-17 | nein |
| Crypto.ETH/BTC | Crypto | alt/1 | `G7dR28cb6VyVXcc81zL3FjmgZS81DhfMFxBpUZgqpUCn` | 2024-04-22 | nein |
| Crypto.ETH/USD | Crypto | alt/2 | `C9AN6cNiRiqmhgHWthFbeya9HjeNirgt3tJ4LGUEfGeC` | 2024-04-11 | nein |
| Crypto.EUSX/USX.RR | Crypto Redemption Rate | alt/0 | `w1sgiDz1vsb3GqHLbe58DeBHXCh4JpgWxu5Ko3fiGv7` | 2026-08-22 | nein |
| Crypto.FDUSD/USD | Crypto | alt/0 | `3UY8ttAAb3UfiNBX8HRqj65LmVoCo96JQXRiSe483Lki` | 2026-08-26 | nein |
| Crypto.FDUSD/USD | Crypto | neu/0 | `4qpCY2QptNBzfRg2qTox26sjjQhuNUore6ywvHyDkTC2` | 2026-09-17 | nein |
| Crypto.FLUID/USD | Crypto | alt/0 | `4yipcGs3JHHfbL7Eorcq1PaaRdaTSPaJYyeSeYkWAsL5` | 2026-04-22 | nein |
| Crypto.FLUID/USD | Crypto | neu/0 | `DfAKyxcfmKixgJp3eFmhPH2g3rwgdUZtXBsT2qwFqNjg` | 2026-07-29 | nein |
| Crypto.FOGO/USD | Crypto | neu/0 | `BrtGzbnS1TZZtKm21RPFhckhh3KovGwCnASv5MAWbAQ9` | 2026-06-04 | nein |
| Crypto.FRXUSD/USD | Crypto | alt/0 | `BYJF4YRmgGbuvC6hXQNL21qi92FZuJw66FLbBHh6rPiy` | 2026-08-17 | nein |
| Crypto.FWDI.SS/FWDI.RR | Crypto Redemption Rate | alt/0 | `FZWSpPPteGgPeNv3kugyZZoRZNzswfi1qNipHT1DtjMa` | 2026-07-22 | nein |
| Crypto.G/USD | Crypto | neu/0 | `99ewsgk8GQQJTe4aQ99SKTVgB2tMi3vcfYEF5WmfVKkA` | 2026-06-04 | nein |
| Crypto.GALA/USD | Crypto | neu/0 | `83VszuDaC9en2UokMHBob3pX3S7vxkKVkbqNQM7mMnKu` | 2026-06-04 | nein |
| Crypto.GLDX/USD | Crypto | alt/0 | `FMGx9GMRAsAnFciE4HPHSMoWVZ6UgzmFJZ1nXdKVGH6e` | 2026-09-12 | nein |
| Crypto.GLXY.SS/GLXY.RR | Crypto Redemption Rate | alt/0 | `3uvvRXgBetb19nJKb9pRxvKL3YCZy7XcLdaRbFd7Wxcw` | 2026-07-22 | nein |
| Crypto.GMT/USD | Crypto | alt/0 | `BVb6DuAk7DPk6ViscWXE7Vmka9yEoNGC5NjMi9D9C2Ca` | 2025-10-30 | nein |
| Crypto.GMT/USD | Crypto | neu/0 | `wZP4Cuh4vPESQVszV3PbpA5gvPkVQhx7J93b4xg5fCz` | 2026-06-04 | nein |
| Crypto.GMX/USD | Crypto | alt/1 | `4XiA7bEzbrwamDwJW6iEWbpE5R2wMmPL2j4d8qZ3Dgph` | 2026-08-12 | nein |
| Crypto.GOAT/USD | Crypto | alt/0 | `3KebxXoZLaZvvdc3ecmdgwWQWSCLQeuouS6mrF7ar1en` | 2026-08-13 | nein |
| Crypto.GOOGLX/GOOGL.RR | Crypto Redemption Rate | alt/0 | `5KtoPy9WsV2tg87qQbpPFPJeTyDyyvnaurqeiwk1f3Ks` | 2026-07-20 | nein |
| Crypto.GOOGLX/USD | Crypto | alt/0 | `HeLrriTGigH3g9qgzZTpkWWkYe1yXKgE6nA7YdBjsvva` | 2026-09-12 | nein |
| Crypto.GRASS/USD | Crypto | alt/0 | `1vdRiUwEcjRArZFYosVaPFJKyuqYrPFNvshbZ4yCACS` | 2026-08-13 | nein |
| Crypto.GRASS/USD | Crypto | neu/0 | `7zogzkzQ23Moa7U5nGae612zwK8DsSw8mfbZ9JSUYERp` | 2026-08-24 | nein |
| Crypto.HNT/USD | Crypto | alt/0 | `4DdmDswskDxXGpwHrXUfn2CNUm9rt21ac79GHNTN3J33` | 2026-08-21 | nein |
| Crypto.HNT/USD | Crypto | alt/1 | `6EgygF8xUfehjH1md8QsbGikjcHfvBLpwMHZ8XAHuZvs` | 2025-08-12 | nein |
| Crypto.HOODX/HOOD.RR | Crypto Redemption Rate | alt/0 | `BkLXe2FGM8udS2GMewjoYbmLjxKhfApEXYyYR2yKzAj3` | 2026-07-21 | nein |
| Crypto.HOODX/USD | Crypto | alt/0 | `EC93PJ3KRj7PSwLXHR1Kh6znNNLyNSUQ26NTtUarUkFe` | 2026-09-12 | nein |
| Crypto.HOODX/USD | Crypto | neu/0 | `E9eZfBLKehitg3PoxRquYYpfv2fuc1HUXj4zP4ZdV33P` | 2026-09-16 | nein |
| Crypto.HUMA/USD | Crypto | alt/0 | `Hg4oAkdu63GcuGioxyz4Lmez2Zon1FuhYiQvC2NQYoa7` | 2026-04-20 | nein |
| Crypto.HUMA/USD | Crypto | neu/0 | `GsSfTtYnY2TcVzmpFHSLYXTUtjYgQAaY22pGTu7U7a2` | 2026-06-04 | nein |
| Crypto.HYPER/USD | Crypto | neu/0 | `Fw48CigW6uNDaKzDtDjP78MTcg1vDgE3mbeDmQeVQmmb` | 2026-06-04 | nein |
| Crypto.INF/USD | Crypto | alt/1 | `Bfz72YR3wWvuxcRFNVjdowii6Q6Lwo83nUG6jqMg2P2Z` | 2025-08-12 | nein |
| Crypto.INJ/USD | Crypto | alt/0 | `GwXYEfmPdgHcowF9GZwbb1WiTGTn1fuT3hbSLneoBKK6` | 2025-09-02 | nein |
| Crypto.INJ/USD | Crypto | alt/1 | `Bk25Bfrn3fU4C6of7GQptFtEiXEo74V9mhqaYTcFLUNE` | 2025-08-12 | nein |
| Crypto.IO/USD | Crypto | neu/0 | `AAzXwTvAFm1TgYJgyWBeQ1hrEN6gcP9Sn9q6BRRYgw3q` | 2026-06-04 | nein |
| Crypto.JITOSOL/SOL.RR | Crypto Redemption Rate | alt/1 | `6HjiUqLPeawRBpf8Pc9MZnaWEEamCKn4gwBuFMFTb8RW` | 2025-07-20 | nein |
| Crypto.JITOSOL/USD | Crypto | alt/1 | `97phupBHVPV6M7Y8spzDeaHrXQWb25wVaqmAjKHNB6xn` | 2025-08-12 | nein |
| Crypto.JITOSOL/USD | Crypto | alt/2 | `Aya14RT3JqnVH5jNeUT1y9KVyhHTHNWCsXZ8yL3DVCoJ` | 2024-04-11 | nein |
| Crypto.JLP/USD | Crypto | alt/1 | `EkpxD3jh6mP2seGS3Rgc3qwwjNDt15pmuxGcvVzhiPWJ` | 2025-08-12 | nein |
| Crypto.JLP/USD.RR | Crypto Redemption Rate | alt/0 | `8GtJymgmRdNtnghp4rh5TZbBQLhR5gWtKChRUkeJQUAm` | 2026-08-24 | nein |
| Crypto.JUPSOL/SOL.RR | Crypto Redemption Rate | alt/1 | `Hct3p7thVYeybtRwkBsakHAjgZ5YjSh5yfLw2HrgnUBc` | 2025-08-11 | nein |
| Crypto.KMNO/USD | Crypto | alt/0 | `ArjngUHXrQPr1wH9Bqrji9hdDQirM6ijbzc1Jj1fXUk7` | 2026-08-19 | nein |
| Crypto.KMNO/USD | Crypto | alt/1 | `E7fYZwJTyfhVYXLem1KeqDhdUTeHmU1yXsMPJuUhcUjw` | 2025-08-12 | nein |
| Crypto.LAYER/USD | Crypto | alt/0 | `2d6huLjzdgpD3C2mLv2jUQPJvVLDj4aEpvhuhbvwLRgh` | 2026-07-23 | nein |
| Crypto.LAYER/USD | Crypto | neu/0 | `73MCyrP51U9GB4i2pPjLLxhjkhyKVKPTJy3Ha8xDCQFr` | 2026-06-04 | nein |
| Crypto.LEO/USD | Crypto | neu/0 | `5EJ87Dbics5BrLkr62JtLosG5ZJBAvLxTgA6aSYSf4BZ` | 2026-06-04 | nein |
| Crypto.LINK/USD | Crypto | alt/0 | `7bWHpGtb2j3jqbpA5gFctdmgZELubiZDBxmt1pEzkBHR` | 2026-08-18 | nein |
| Crypto.LINK/USD | Crypto | neu/0 | `8RogtxKDwicTUNmpumyVVxhFT2bycCbNMgdsriRPufbj` | 2026-09-17 | nein |
| Crypto.LIT/USD | Crypto | alt/0 | `2dNUA95dx1pptfdbFW8h5y4GLcbScp3xWDHCdbRfajgy` | 2026-01-21 | nein |
| Crypto.LIT/USD | Crypto | alt/1 | `413Qco72zhM2D39o6WPk42eA89QAPDvzkKurzG6wPN3E` | 2026-08-12 | nein |
| Crypto.LIT/USD | Crypto | neu/0 | `Gpwnn2nutDKSSjFShnq9gBkd7rzhdai5Tz4HmDffUxnh` | 2026-06-04 | nein |
| Crypto.LUNA/USD | Crypto | neu/0 | `EutVuMbrywT6RqgrF6eJcwhd94Gc3ZoKS9mK9LHnpKBs` | 2026-06-04 | nein |
| Crypto.MANA/USD | Crypto | neu/0 | `C5BW7WybkibyHCc9H65datMZ4ZYYUBzpaopbzt1bWgYj` | 2026-06-04 | nein |
| Crypto.MASK/USD | Crypto | neu/0 | `CppsT6TsNujket346RqeFv1DSNPBoTbykVe15Lpap86Z` | 2026-06-04 | nein |
| Crypto.MCDX/USD | Crypto | alt/0 | `9Cvyi5y1aR2nhNbkeFoe8VNQXgoL9dBMrpUsx9iqVnrP` | 2026-09-12 | nein |
| Crypto.MCDX/USD | Crypto | neu/0 | `FZfejo2gYP3acpMscjLP13pe34L67Mk2c2d9ykkVV4pJ` | 2026-09-16 | nein |
| Crypto.ME/USD | Crypto | alt/0 | `6nrLmQDXdzDN5EhkXedzf6rmm5tYXqCaWkXm5CjEgRsS` | 2025-12-13 | nein |
| Crypto.ME/USD | Crypto | neu/0 | `9dnsahLZ4J45qJVG63RXBZD1EmHMxfwJK2ipLxKryoGq` | 2026-06-04 | nein |
| Crypto.MELANIA/USD | Crypto | neu/0 | `CZSLoGwn36BUK5DtKxJVyxUGaSxQogiozSwduqtmqLMi` | 2026-06-04 | nein |
| Crypto.META/USD | Crypto | alt/0 | `G6cAdn5HsyoCbZfsbqDQW7BPgjxsPGk5AGCu4CiTdLaQ` | 2026-07-29 | nein |
| Crypto.METAX/USD | Crypto | alt/0 | `HmqkFx31Jk1STgqVfxYAz6pKtwgn9mXZdNZfWnu6sqWS` | 2026-09-12 | nein |
| Crypto.METAX/USD | Crypto | neu/0 | `DNJjaeaQcNmTCyQBhYm39UqHMdggvDbJ2Qpk8C8yzKQP` | 2026-09-16 | nein |
| Crypto.MEW/USD | Crypto | alt/1 | `tsv2GoinbJYWN77vDNbLCCEkuZu5vQkpmQkVJghwCvF` | 2025-08-12 | nein |
| Crypto.MNDE/USD | Crypto | alt/1 | `J8TjZELLH6BLm6Tpsenc6x49jEfFdrmf7ToGWJTXjaEd` | 2025-08-12 | nein |
| Crypto.MNT/USD | Crypto | neu/0 | `9CufzsvLbuxJRGcSQcSVzMGLhqeQm3D7udegWFnfPMgB` | 2026-06-04 | nein |
| Crypto.MOG/USD | Crypto | alt/0 | `BLSEasVpJqY5YAxnmgeos6dqok5jX7oiSBBSE96Jmd4Z` | 2025-06-14 | nein |
| Crypto.MOG/USD | Crypto | neu/0 | `56WWzPSZqudk2eb4mai5Gkk4hRNuucQyB1bgigNTC14T` | 2026-06-04 | nein |
| Crypto.MON/USD | Crypto | alt/0 | `2EjKYYQDvZYF262936Xx4L23zGkiVWc2Q5DZCKb26fXL` | 2026-07-31 | nein |
| Crypto.MOODENG/USD | Crypto | neu/0 | `2rcUP3RZfq8cm6btnoDVKySNqXsYyymJZifQUnHHcX92` | 2026-06-04 | nein |
| Crypto.MSFTX/USD | Crypto | alt/0 | `9KiECPa4BdbLHM61iur7u7svmRKA2MUJ76RLGfsVihvC` | 2026-09-12 | nein |
| Crypto.MSOL/USD | Crypto | alt/1 | `FJorqNWgQs28y6NeA4rLAV9DxyiYAbbBxjZEGZfvbiMS` | 2025-08-12 | nein |
| Crypto.MSOL/USD | Crypto | alt/2 | `BkiVQzvh4h6hmRcUzFUJUjQ5zHooqdbUUBRm5NyQw8R` | 2024-04-11 | nein |
| Crypto.MSOL/USD | Crypto | neu/1 | `4DoDc5X48XBaCGPYMsr13YUSm1m5kVcKjjqHR44iTFBn` | 2026-05-06 | nein |
| Crypto.MSTRX/MSTR.RR | Crypto Redemption Rate | alt/0 | `5cWXcVyw5LWfvKjUHm6PKnfEfbW9C6bYSHRGhiU7hZC1` | 2026-07-21 | nein |
| Crypto.MSTRX/USD | Crypto | alt/0 | `C1AgDTF3hG9a23cGrCZcDhTFNzZuJ5BxYmVwwESP1Da1` | 2026-09-12 | nein |
| Crypto.NAV.ACRED/USD | Crypto NAV | alt/1 | `ExNwRD932Pf4QxXfeHDdD2NQNs5AraNsLTmNvVn1Q2Jw` | 2025-08-12 | nein |
| Crypto.NAV.ONYC/USD | Crypto NAV | alt/0 | `8uto8utKdfs2ajrmBtcFL5s9mXbc7UPg8HSdLwCn1Mg7` | 2026-08-26 | nein |
| Crypto.NEAR/USD | Crypto | alt/0 | `4Ag6xt275tDDkdWhFsCq3vTHAvNAzKVRNiqAswzb699A` | 2026-08-18 | nein |
| Crypto.NEAR/USD | Crypto | alt/1 | `CBNLgma3xFTSKjWJbgQkAgCRgGZyHbUsBxjZ97mux66M` | 2026-08-12 | nein |
| Crypto.NEAR/USD | Crypto | neu/0 | `4LSGwa892rciU4ecGfzhaFP8E28m1tYnu1JuRq9zvaYD` | 2026-09-17 | nein |
| Crypto.NEIRO/USD | Crypto | neu/0 | `8nH9QEUCxpUWQsFYA8APDwPZF4VACCLDjnyUi4Viit13` | 2026-06-04 | nein |
| Crypto.NFLXX/USD | Crypto | alt/0 | `FUqSvECa7qTFsn8QncA5MHpohUfz227295LFvVj5AWFh` | 2026-09-12 | nein |
| Crypto.NFLXX/USD | Crypto | neu/0 | `5ZqCN5ofu7bxjFpwt7gPGfEfbUZnzxQ129xyuaCSze43` | 2026-08-17 | nein |
| Crypto.NVDAX/NVDA.RR | Crypto Redemption Rate | alt/0 | `9Qxr7ZFsMCoA7Yo1vEMc23mqeZX5qx6xBo5jbHgVHKir` | 2026-07-20 | nein |
| Crypto.NVDAX/USD | Crypto | alt/0 | `6TPsjFigUaMFanRCsxQ4WbmG215xhRBXsb5y5Cn5L6eE` | 2026-09-12 | nein |
| Crypto.OP/USD | Crypto | alt/0 | `DgbEZkKzsRCQgbpdwiM5XcNZ4KzR5hsQZabtHGemf3Cc` | 2026-03-26 | nein |
| Crypto.OP/USD | Crypto | alt/1 | `AZTG45CfCVrfc6DdWRsJZT5rt5Nh3ck8SwF7pWd2FVCq` | 2024-09-15 | nein |
| Crypto.ORCA/USD | Crypto | alt/0 | `4CBshVeNBEXz24GZpoj8SrqP5L7VGG3qjGd6tCST1pND` | 2026-08-18 | nein |
| Crypto.ORCA/USD | Crypto | alt/1 | `67Mv5Nmztf8bmaHtS47fq1CbXB8rEFMoZGePktXKEJZC` | 2025-08-12 | nein |
| Crypto.PAXG/USD | Crypto | alt/0 | `D2ipc3P6qrJDdUtdAoB6iWZCUfzMJK6dxJt8zffRHq18` | 2026-08-19 | nein |
| Crypto.PENGU/USD | Crypto | alt/0 | `27zzC5wXCeZeuJ3h9uAJzV5tGn6r5Tzo98S1ZceYKEb8` | 2026-08-19 | nein |
| Crypto.PENGU/USD | Crypto | alt/1 | `4cTq3Mqarh2ny6QkrGRe1tMxnNG3Vwi2eMVoGtKMgiks` | 2025-08-12 | nein |
| Crypto.PEPE/USD | Crypto | alt/0 | `3adfGDsTjqC55Mw5MfzpcLpNMKGGPBwc9M8xAYq4VEQe` | 2024-07-09 | nein |
| Crypto.PEPE/USD | Crypto | alt/1 | `BgtDdtLnB7oRvPWeyBCXGPsiX4LZbQdSJYKZq9TvKNvk` | 2026-08-13 | nein |
| Crypto.PEPE/USD | Crypto | neu/0 | `Dy2e9ibAmWwCxCnbTXB3kTXyge3DTPud1dGdH98quiuH` | 2026-06-04 | nein |
| Crypto.PNUT/USD | Crypto | alt/0 | `8EWYFU21Gf1rVa93qbpvPxpnfCpRJ1URyXNcbP6EqLAY` | 2026-03-30 | nein |
| Crypto.PNUT/USD | Crypto | neu/0 | `4Ah59WNbes7N6U8g9auxBCuRWVvwtybnxaTj3yMPwxEQ` | 2026-06-04 | nein |
| Crypto.PONKE/USD | Crypto | neu/0 | `Arnd46UyW9QGToTtyKCtEvbqJ9DXR59uwHu1P9H55J2s` | 2026-06-04 | nein |
| Crypto.POPCAT/USD | Crypto | alt/0 | `6UxPR2nXJNNM1nESVWGAf8NXMVu3SGgYf3ZfUFoGB9cs` | 2026-08-18 | nein |
| Crypto.PRIME/USD | Crypto | alt/0 | `Fo9K2sEDCEYNwgBmrfnioocgHEq3DVyoeJ46bomtvSkp` | 2025-12-04 | nein |
| Crypto.PRIME/USD | Crypto | neu/0 | `ERqfC5Tbd48Fae7FwRsHGqznjTK6a7dLYCEcyRGxNsUh` | 2026-06-04 | nein |
| Crypto.PYTH/USD | Crypto | alt/1 | `FCpyQdYXqMHZiPLP8vnU8yicSQT5iKVFgSFFcrUrXJ2k` | 2026-05-05 | nein |
| Crypto.PYUSD/USD | Crypto | alt/0 | `9zXQxpYH3kYhtoybmZfUNNCRVuud7fY9jswTg1hLyT8k` | 2026-08-26 | nein |
| Crypto.QQQX/QQQ.RR | Crypto Redemption Rate | alt/0 | `BYaWQnztYwBDPvH2m7yTGRx3TdSumGcu9ocCPhQ4HHdk` | 2026-07-21 | nein |
| Crypto.QQQX/USD | Crypto | alt/0 | `BRZ4SSorCG3DQ1KLgTPu7TYmQWsxa8ghqz2BAfDzs6a3` | 2026-09-12 | nein |
| Crypto.QQQX/USD | Crypto | neu/0 | `BMcyd2UQqakGbWnNRAC67TLAFhV64dzLVeEyRHKyzmUi` | 2026-09-15 | nein |
| Crypto.RAY/USD | Crypto | alt/0 | `Hhipna3EoWR7u8pDruUg8RxhP5F6XLh6SEHMVDmZhWi8` | 2026-08-25 | nein |
| Crypto.RAY/USD | Crypto | alt/1 | `FkbAbzqLa9MLHiVxr9FeVBDZ1g1rmtEsziyS98YfAq6n` | 2025-08-12 | nein |
| Crypto.REZ/USD | Crypto | alt/0 | `fWwYsjN8k7cZV3QsgU53VQt1dDh7rwPUKw4n4qavdy6` | 2026-03-30 | nein |
| Crypto.REZ/USD | Crypto | neu/0 | `4udXHxSWmK7gBJ6yTRCLuC3wp6FsRxrLYW6FEvxSdZzQ` | 2026-06-04 | nein |
| Crypto.RLB/USD | Crypto | alt/0 | `FKhA7f11fMokfi3c7J8R9M3TSJ3E26aeUuSm9bADgPF3` | 2025-03-05 | nein |
| Crypto.RUNE/USD | Crypto | neu/0 | `zM65dZWj2E3zSJezAevCJzj5zr5AYZYEdaAxKBUtZLZ` | 2026-06-04 | nein |
| Crypto.S/USD | Crypto | neu/0 | `8iNrtSRJoX2kWVkxi3AVNzYHY7rZy8HcisNHrSenDPpu` | 2026-06-04 | nein |
| Crypto.SEI/USD | Crypto | alt/0 | `GATaRyQr7hq52GQWq3TsCditpNhkgq5ad4EM14JoRMLu` | 2025-05-01 | nein |
| Crypto.SHIB/USD | Crypto | alt/1 | `7sAg7Nvqv7sonXrLBi3ToXsmsH1NrPwuZoLLFuHDQaFC` | 2026-08-13 | nein |
| Crypto.SHIB/USD | Crypto | neu/0 | `FM5EyHgLvX8dswKkUnkvKqxjkGuT7vagkB5qcSeGSKNh` | 2026-06-04 | nein |
| Crypto.SOL/USD | Crypto | alt/2 | `BvsVtB5ykG1wUY9EMvgqkzBQQX67jhMCPzRPhGh7FYDb` | 2024-04-11 | nein |
| Crypto.SOL/USD | Crypto | neu/1 | `GGdMnioYUC8qFWrWXJP2n3YHAns49MJW87CeuT7sgvrf` | 2026-05-06 | nein |
| Crypto.SONIC/USD | Crypto | neu/0 | `HJgPLndheNiaru7hrx2zNDJ7Z3qH5edhSQEoNKaDatou` | 2026-06-04 | nein |
| Crypto.SPCXX/USD | Crypto | alt/0 | `6u5tiC8JdcLdgMjoJE7QTf8suHyVmxbKZW4TLnhFr1fk` | 2026-09-12 | nein |
| Crypto.SPX6900/USD | Crypto | alt/0 | `7YmBpFooNruexenhJLU1wwUWUCzgETLQGVF1jLjqqaWq` | 2026-07-05 | nein |
| Crypto.SPX6900/USD | Crypto | alt/1 | `EEmksGrZbQxC3aKQL1FVfRj8Wzh396XD5vSrL6C36gSp` | 2025-06-14 | nein |
| Crypto.SPX6900/USD | Crypto | neu/0 | `BCF6FEb7iXcJxhK7kuYHfo1mDaSKNUaB2MK6wC6Q74df` | 2026-08-24 | nein |
| Crypto.SPYX/SPY.RR | Crypto Redemption Rate | alt/0 | `2if3wciQYbmgCzicHgofw2NFA6YHAQHxQKxzSZWb8Cpg` | 2026-07-21 | nein |
| Crypto.SPYX/USD | Crypto | alt/0 | `jf8MarLKgBte4f3NWufbNpGRCuBfJLhuZPuFigvSQR2` | 2026-09-12 | nein |
| Crypto.SSOL/SOL.RR | Crypto Redemption Rate | alt/1 | `82WJA33efnZrCjxQGxFWg2FZqgpyJm7zfAXaYnYJUUb5` | 2025-08-12 | nein |
| Crypto.STRK/USD | Crypto | alt/0 | `CcRDwd4VYKq5pmUHHnzwujBZwTwfgE95UjjdoZW7qyEs` | 2025-05-01 | nein |
| Crypto.STRK/USD | Crypto | neu/0 | `5rMMBGRHrLJGHnTEb9r6Yveeb1CcuVrUqrsrRjfUE8wz` | 2026-06-04 | nein |
| Crypto.SUI/USD | Crypto | alt/0 | `GgV3a7YeVRga9prjNGEDBG9NwatSaD8rwjZ4GNjPiXTq` | 2026-03-26 | nein |
| Crypto.SUI/USD | Crypto | neu/0 | `5FSHKLrPrWPUHyyDf4LkXNdVbzPyWCBkxKFmWqGBQtbN` | 2026-06-04 | nein |
| Crypto.SUSDE/USD | Crypto | alt/0 | `BjU7ZbbjJD2TinunF4AeEUhgJnRLwxMNqTcJesBFFm2m` | 2026-08-24 | nein |
| Crypto.SUSDE/USDE.RR | Crypto Redemption Rate | alt/0 | `CDTggzvDHKLN8uVFSSafcDaX7jxCRbUFMyRwg8FdfvGB` | 2026-08-26 | nein |
| Crypto.SUSDE/USDE.RR | Crypto Redemption Rate | alt/1 | `ACQeAmRbr8upcmP1i9Ushj68wAKt5o8mGPUvPg27uk8N` | 2025-02-03 | nein |
| Crypto.TAO/USD | Crypto | alt/0 | `HHxPbFCdhCNJ1oWDB6hLFTjjFCydiXiLEkdHDohW6TTv` | 2026-07-28 | nein |
| Crypto.TAO/USD | Crypto | neu/0 | `56aKrVxdFYeXkki6aH4DMAV8vvo6c8bYBncoMTtAybnX` | 2026-09-02 | nein |
| Crypto.TIA/USD | Crypto | alt/0 | `6HpM5WSg4PCS4iAD13iSbcG4RbFErLS3pyC5qgtjqxqF` | 2025-05-01 | nein |
| Crypto.TNSR/USD | Crypto | alt/1 | `YtKNXQ3mqVGRpHY2PBS3DPVy4hJ84C63YahhPaMMk2w` | 2025-08-12 | nein |
| Crypto.TON/USD | Crypto | neu/0 | `3oWD83H7eS5B34YfpppMn6DKYTVhdyc8LpqpdryJdkTd` | 2026-06-04 | nein |
| Crypto.TRX/USD | Crypto | alt/0 | `k6Uy1WtqWnVHv1WNpwW8L4hmLtJCu2AqfSLLcX5kEfg` | 2026-04-21 | nein |
| Crypto.TRX/USD | Crypto | neu/0 | `4ygStrhCj7iLBgzwbtaUMNnjEzzbYHQdEzuediETR5Xm` | 2026-06-04 | nein |
| Crypto.TSLAX/TSLA.RR | Crypto Redemption Rate | alt/0 | `4a4TAWMimr7GHbWPpKtHTqGhgagVTCW5rAN9PprM6NEJ` | 2026-07-20 | nein |
| Crypto.TSLAX/USD | Crypto | alt/0 | `GpoWLTd6GoisYxYgHz7mTcZvgnfJu4SN7T6PxWjgUTFY` | 2026-09-12 | nein |
| Crypto.UNI/USD | Crypto | alt/0 | `By6KRq5KjvEmsjumNGBXQWyedaV3sAq89yjiFm6Poy3k` | 2026-08-18 | nein |
| Crypto.UNI/USD | Crypto | neu/0 | `C3STT4PZo7tSgunDoDZ6AaudG33kgErrduoJikRbQ8vn` | 2026-09-17 | nein |
| Crypto.USDC/USD | Crypto | alt/1 | `91LF2K1yGkwpePM43yctMX1BGwf6atSFgjcPnNYG8czx` | 2025-08-12 | nein |
| Crypto.USDS/USD | Crypto | alt/0 | `DyYBBWEi9xZvgNAeMDCiFnmC1U9gqgVsJDXkL5WETpoX` | 2026-08-26 | nein |
| Crypto.USDT/USD | Crypto | alt/1 | `CiLYhPcxv6b4t9vPAPoZMQLRwKD92GWiKhCKEQx2yZBU` | 2025-08-12 | nein |
| Crypto.USDTB/USD | Crypto | alt/0 | `9T4f1GHDEKju4FkKLUHpK3gGidgQLMo1yaMC6H6AZwDY` | 2026-09-03 | nein |
| Crypto.USDY/USD | Crypto | alt/0 | `9VxAH1GnCgDRm2L6F4ikpm2wdNeq6S731LxXPHsWHAG2` | 2026-08-18 | nein |
| Crypto.USELESS/USD | Crypto | alt/0 | `DDHL1wLPcHfgjJXoKQLo9yNUxg1tSvuQfxsRideimA8t` | 2026-02-06 | nein |
| Crypto.USX/USD | Crypto | alt/0 | `2fLyonDim37cG8M1u7QBCFHZ1LVhQeMi6cJeNUktMQwY` | 2026-08-26 | nein |
| Crypto.VIRTUAL/USD | Crypto | neu/0 | `6VpudrUawGfm7mnDjzyAwtPQWuKjccQNPo48tzmQ8pYt` | 2026-06-04 | nein |
| Crypto.W/USD | Crypto | alt/1 | `A5eEUWdeuxSDf8n2XfA75z3PwZSbXdmdzAPubPJcZ9f8` | 2025-08-12 | nein |
| Crypto.WBTC/USD | Crypto | alt/1 | `9FnfVZHo16gtg8AMjHt7WSkYrmFaqKy8E3Y5XKZ5FxmZ` | 2025-08-12 | nein |
| Crypto.WCT/USD | Crypto | alt/0 | `F8mqAH4BgzouXb1pVLkz3zLa5Vrmdf1to2zJXdLSrL1U` | 2026-05-18 | nein |
| Crypto.WCT/USD | Crypto | neu/0 | `49tz7ox74stviN9vXAw42Cv9SxCJZidMKcxfDrwsNSm2` | 2026-06-04 | nein |
| Crypto.WETH/USD | Crypto | alt/0 | `4TQ1VVWkrYUvyQ6hMmjepwr7swvqsyvLi75BiJi13Tf3` | 2026-08-18 | nein |
| Crypto.WLFI/USD | Crypto | neu/0 | `5aFP7iWfu2491RLq2np91hs1KT2z4nGbhquRyC2wreyM` | 2026-06-04 | nein |
| Crypto.WSTETH/USD | Crypto | alt/0 | `HyoTrHkmhM8YETBagUFqtT95JpkFWtLDtL3uQHsLVT5j` | 2026-08-18 | nein |
| Crypto.WSTETH/USD | Crypto | neu/0 | `2nQqXSQKqtDguiuDvnpXuaS5Kt2TVMuJsKygEdYzgqQW` | 2026-07-30 | nein |
| Crypto.XAUT/USD | Crypto | alt/0 | `6aLRPrkf5SM4mZdQCbb23YMZirN8bX7pqbbk1mZfb1s9` | 2026-08-06 | nein |
| Crypto.XBTC/USD | Crypto | alt/0 | `5UeVpnvvtYFBcHFp9U7eMVejQvHh284n5Wnk1EmT98yA` | 2026-08-18 | nein |
| Crypto.XMR/USD | Crypto | alt/1 | `ErvSeU384xZ8GCjdb2y1GCPitSAwiAzDjk3HcDuur2Pw` | 2026-08-12 | nein |
| Crypto.XMR/USD | Crypto | neu/0 | `FBCRk4fCcudsbAayHGHwwvbzBczNcctEmJ2GpPmd6tiF` | 2026-06-04 | nein |
| Crypto.XRP/USD | Crypto | alt/0 | `Ae3LGcV5Wt5Z11xvhxSX1h65uNyjuX4qYFFbgifLx5eX` | 2026-09-12 | nein |
| Crypto.XRP/USD | Crypto | neu/0 | `Ajt2KbWdP5k1iGr3yDZkZpSgFKDVb41WjABTm57c34ti` | 2026-08-28 | nein |
| Crypto.XSGD/USD | Crypto | neu/0 | `D2rRvbZ1aLpVFPDNcbRQnJpotvAoq44yp9yhdRzvh3FP` | 2026-06-04 | nein |
| Crypto.ZEN/USD | Crypto | neu/0 | `7oTRAx5t2EBsnCKttkazAdntTRrNe9m29jG4AVnvB2u6` | 2026-06-04 | nein |
| Crypto.ZEREBRO/USD | Crypto | neu/0 | `GYJGabtVCFxft8XyK7SDhBTWmr3CojTXioVdJ2PDMMEc` | 2026-08-24 | nein |
| Crypto.ZEUS/USD | Crypto | alt/0 | `C2Y1BNWe994KLsRmc11qcckaYTvSycKQ3S9xMZcMZ7iJ` | 2026-07-30 | nein |
| Crypto.ZEUS/USD | Crypto | neu/0 | `2E5nKsCVqzh8zYqWDshsAfrnwodJsT5AwCJrKu5qBb5L` | 2026-07-30 | nein |
| Crypto.ZORA/USD | Crypto | neu/0 | `BeJnJfXuyw9LRXcrfDLHGajRFDqtYsBCwTykAhbRRcPR` | 2026-06-04 | nein |
| Equity.US.AAPL/USD | Equity | alt/0 | `DJ2FyTgUAkEtXW3U5P9PF19meFTRtW4ZWKKFgACfVbUy` | 2026-08-14 | nein |
| Equity.US.AMZN/USD | Equity | alt/0 | `GBkjjFxbaFY9TBHpAPypk5JBchpPPve2jskAcd9zuFNd` | 2026-08-20 | nein |
| Equity.US.AVGO/USD | Equity | alt/0 | `2jgfs5FsDQkdCrgcCKHEd7p9KNtKAyWznMSyu21WbFgS` | 2026-05-19 | nein |
| Equity.US.COIN/USD | Equity | alt/0 | `91JXaWGHr57awfqhXQP2TxrkLX6CpvtBaaRjz1PEQqXn` | 2026-08-14 | nein |
| Equity.US.CRCL/USD | Equity | alt/0 | `7zWGncBP5aGTDmEK7Ej4GYwGc2kXFHZJZFxmq28ocCaG` | 2026-08-26 | nein |
| Equity.US.CRWD/USD | Equity | alt/0 | `8zWQVp313FFdanpZoQeDohp5HE7ugoJE2VaX4sYPHj4e` | 2026-05-19 | nein |
| Equity.US.DHR/USD | Equity | alt/0 | `54f3QWxFrEDByLpuen8k9qaSTYiCRcAcpzWcH6pbZ7Ht` | 2026-05-06 | nein |
| Equity.US.DIA/USD | Equity | alt/0 | `45yaErTLUjZvTE95B48etKkUqPb9y5Fn49maJe47v5wq` | 2026-07-02 | nein |
| Equity.US.FWDI/USD | Equity | alt/0 | `6hZRbSdvdAM6smU8mmQjx7rr1wp9RGLzRp4dao4kMms6` | 2026-07-22 | nein |
| Equity.US.GLD/USD | Equity | alt/0 | `4ZVfYJzpww4uQ6qaVnonfKVgPeZ6kHZ3mE8W3hK7eiFf` | 2026-08-17 | nein |
| Equity.US.GME/USD | Equity | alt/0 | `6AvVgYACju3WKAMSMZibU8UtDeQhF6si9f1vyrdthiJp` | 2026-08-14 | nein |
| Equity.US.GOOG/USD | Equity | alt/0 | `9bsQhkxKkuct1JYzi3WnEarHLWgviVcTK6GPSJ5nSXF2` | 2026-07-02 | nein |
| Equity.US.GOOGL/USD | Equity | alt/0 | `HShKFQqhYkUiXpVyyLmrAALXwWqHB7ikLmPbrwJzpRNh` | 2026-08-14 | nein |
| Equity.US.HIMS/USD | Equity | alt/0 | `8fnWtZJsXpe8T6xRxb5qNLWrMYGQxphw4mMyPtAkPmq6` | 2026-05-19 | nein |
| Equity.US.HOOD/USD | Equity | alt/0 | `5tZizzQN776ZWTibPJKecjk1DkTSDHu47dXM3SxR5D5i` | 2026-08-14 | nein |
| Equity.US.IWM/USD | Equity | alt/0 | `JB5qxBAeY2e3V8oAVPaPPyLt3D4QDJxSDPxReJoxwsub` | 2026-07-02 | nein |
| Equity.US.KO/USD | Equity | alt/0 | `58TvF41sXqh2bYD5hzgVH25Ns3tLzx6Qxy39tkvhUHCa` | 2026-08-14 | nein |
| Equity.US.LLY/USD | Equity | alt/0 | `AmhgzXb37V3YegqdXoDTGL5QVhSV83dESyadboJwc7sQ` | 2026-05-06 | nein |
| Equity.US.MCD/USD | Equity | alt/0 | `4gRz4DRNxWauuA6nWVw286qWdn7yzeMFupqXakAG2Bza` | 2026-08-14 | nein |
| Equity.US.META/USD | Equity | alt/0 | `GsKrMNoa1Mqjpif4SYk2WjdduWZP699hXRdP51yBM6K2` | 2026-08-14 | nein |
| Equity.US.MSFT/USD | Equity | alt/0 | `7VYuuJxz8w2rLA9tJG2KZ9T1fSMcjC7uECoYA6nDaqtK` | 2026-08-14 | nein |
| Equity.US.MSTR/USD | Equity | alt/0 | `HJGvGyWrAXdZPG4Q7LNkkKja72FDkJW7ixuyg3u6vZyP` | 2026-08-14 | nein |
| Equity.US.NVDA/USD | Equity | alt/0 | `2w1Tg1XTZbUib7srfRoStJ4v5JXVsK7roQEGMsMaGZFC` | 2026-08-26 | nein |
| Equity.US.NVO/USD | Equity | alt/0 | `96q5heUgagmBhXZLBYCk3dvbhoPewy7tLbdVsJvp1Jq` | 2026-05-06 | nein |
| Equity.US.PEP/USD | Equity | alt/0 | `48poNkAU9LTF7ovyfXfmxRfzAEyjJpCVvAbvPuSWUvNY` | 2026-08-14 | nein |
| Equity.US.PLTR/USD | Equity | alt/0 | `7RP45Z6dsTrHQakMg7xha1RLZGk1x2pVViBjpUMpzdBK` | 2026-07-02 | nein |
| Equity.US.QQQ/USD | Equity | alt/0 | `EwssJrQ7UVz6itHEaQQsKWikhZ3iHddyxRhmR7pTvwt5` | 2026-09-11 | nein |
| Equity.US.QQQM/USD | Equity | alt/0 | `Dx3MjzGRzn5WuJqAQYcGyEDCGSAmn9Sciygrc6zxKGoG` | 2026-07-02 | nein |
| Equity.US.RKLB/USD | Equity | alt/0 | `H2tjxYMHGVN9F8S7ewVaECDZtRpVxgfrtAMEGtRDvqYe` | 2026-05-19 | nein |
| Equity.US.SNDK/USD | Equity | alt/0 | `H23YCk4YueuYxPS3E5BqbA9NA6dv1CRjBNG4aX4E7x6z` | 2026-07-06 | nein |
| Equity.US.SPY/USD | Equity | alt/0 | `9owhtgrdLiUMAH9JKxYFt5pUY4Luy4EzzLhdcWPVuDyy` | 2026-08-26 | nein |
| Equity.US.STRC/USD | Equity | alt/0 | `GcEfvXPFyoWLfZeKCoA2gRwLCQds49anRfVzVRcU9cai` | 2026-08-14 | nein |
| Equity.US.STRC/USD | Equity | neu/0 | `4cYCPT56wKRBHPDy2FDhTpL9F7cwXZ59WsuhQJU9JfmC` | 2026-07-31 | nein |
| Equity.US.TMO/USD | Equity | alt/0 | `5f9eekiFMRESBFgdCS7CPaJGtt6kZAPsMtaFraeGjDRD` | 2026-05-06 | nein |
| Equity.US.TSLA/USD | Equity | alt/0 | `E8WFH8brgP58arcuW2wwsPHiomYrSvrgWTsRLZLAEZUQ` | 2026-09-11 | nein |
| Equity.US.UNH/USD | Equity | alt/0 | `HBCUey2zP688M1XcH5CXj5sr7P9YqNDb6ERTnjDziKLW` | 2026-05-19 | nein |
| Equity.US.VNQ/USD | Equity | alt/0 | `2hxcaArrSKpNsUmeGr7dsDHsuYxUcxRpCWkiCfStp3Du` | 2026-05-19 | nein |
| Equity.US.VOO/USD | Equity | alt/0 | `LVreNUP8XfYuhsVQgXEm9csBUKiLTESKrxCFYdZ4HjN` | 2026-07-02 | nein |
| Equity.US.VRTX/USD | Equity | alt/0 | `CmuiU9H1WmLZrPnfJLZ4DuktUJwDU3mpKFosnihAWbTn` | 2026-05-19 | nein |
| Equity.US.XOM/USD | Equity | alt/0 | `8EV2DC3WqFBYffRekh48haP9dRm6HpXwXBYKgjUqM42M` | 2026-08-14 | nein |
| FX.AUD/USD | FX | alt/0 | `6pPXqXcgFFoLEcXfedWJy3ypNZVJ1F3mgipaDFsvZ1co` | 2026-07-03 | nein |
| FX.EUR/JPY | FX | alt/0 | `4Q4cykpuwRaw18nv8ULyUn4n7TrPJowe8bBF5V4mJucD` | 2026-07-03 | nein |
| FX.EUR/USD | FX | alt/0 | `Fu76ChamBDjE8UuGLV6GP2AcPPSU6gjhkNhAyuoPm7ny` | 2026-08-24 | nein |
| FX.GBP/USD | FX | alt/0 | `G25Tm7UkVruTJ7mcbCxFm45XGWwsH72nJKNGcHEQw1tU` | 2026-07-31 | nein |
| FX.NZD/USD | FX | alt/0 | `A4rweVuHNya9iafJ8HhH5gP9HWnHjXvej2WD8aFhaqhc` | 2026-07-03 | nein |
| FX.USD/BRL | FX | alt/0 | `nBWiPMtkBwntztmjV3mwWAwHEY5K4VtQ9niiMkKKjXA` | 2026-04-10 | nein |
| FX.USD/CAD | FX | alt/0 | `Vy9fodPDPBx3Wjb93KnbawwtUMr5F6cG4nu7SqX4RZK` | 2026-07-03 | nein |
| FX.USD/CHF | FX | alt/0 | `2ZqJFpxWzbu39KHRq95L8q9jRzi31a4NWcpDfZy5eUjb` | 2026-07-03 | nein |
| FX.USD/CNH | FX | alt/0 | `CBh4vU47hYJPDL7gAQLWiQdy6UYAR5z5k2JEvuyZXqYt` | 2026-03-18 | nein |
| FX.USD/JPY | FX | alt/0 | `AMpTDXYcq8WaDR4FG8JW239vuwzAGqeS4fJSqGZi9V2P` | 2026-07-03 | nein |
| FX.USD/MXN | FX | alt/0 | `8SFnFrqM9b67n4UziDAcs9D5LwGc1X4bc8zF4g5BG1Ux` | 2026-04-08 | nein |
| Metal.XAG/USD | Metal | alt/0 | `H9JxsWwtDZxjSL6m7cdCVsWibj3JBMD9sxqLjadoZnot` | 2026-07-03 | nein |
| Metal.XAU/USD | Metal | alt/0 | `2uPQGpm8X4ZkxMHxrAW1QuhXcse1AHEgPih6Xp9NuEWW` | 2026-08-26 | nein |

</details>
