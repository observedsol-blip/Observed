# Spike: Basisraten für „Bewegung" im Fenster 04:00 → 16:00 UTC (18.09.2026)

Frage: Gibt es eine Quelle für historische Tagesbewegungen, die wir einmalig vor Saisonstart ohne Schlüssel
und ohne laufende Abhängigkeit nutzen können? Und was würde eine Basisraten-Linie im Record zeigen?

## Quelle
Coinbase Exchange, öffentliche Stundenkerzen (`/products/{SOL,BTC,ETH}-USD/candles?granularity=3600`),
ohne Schlüssel. 30 Anfragen je Produkt für 365 Tage, 8 751 Kerzen, 364 auswertbare Tage.
Bewegung = |Schluss der 15:00-Kerze / Eröffnung der 04:00-Kerze − 1|.
Einschränkung: Coinbase-Kurs, nicht das Pyth-Aggregat. Für eine Rate über Monate unerheblich, für den
Ausgang einer einzelnen Runde nicht verwendbar. Skripte: `spikes/baserate/`.

## Anteil der Tage mit Bewegung über x (19.09.2025–18.09.2026)
| Feed | > 1 % | > 1,5 % | > 2 % | > 3 % | Median |
|---|---|---|---|---|---|
| SOL | 59,9 % (Mo–Fr 65,8 · Sa/So 45,2) | 44,2 % (50,0 · 29,8) | **33,5 %** (40,0 · 17,3) | 18,7 % | 1,37 % |
| BTC | 42,9 % (52,3 · 19,2) | 27,2 % (35,0 · 7,7) | 19,5 % (25,0 · 5,8) | 8,0 % | 0,90 % |
| ETH | 53,8 % (60,0 · 38,5) | 37,1 % (44,2 · 19,2) | 26,9 % (33,1 · 11,5) | 17,0 % | 1,11 % |

Drift: SOL > 2 % erste Jahreshälfte 40,7 %, zweite 26,4 %, letzte 90 Tage 26,7 %
(BTC 23,6 → 15,4 %, ETH 33,5 → 20,3 %).

## Brier eines Spielers, der stur die Basisrate setzt (auf 5 % gerundet)
Gelernt auf den ersten 274 Tagen, gemessen auf den letzten 90.
| Frage | immer 50 % | eingefrorene Basisrate | Basisrate getrennt nach Mo–Fr / Sa–So | Standardfehler 13 Runden / 64 Runden |
|---|---|---|---|---|
| SOL > 2 % | 0,250 | 0,202 (p = 0,35) | 0,192 (0,40 / 0,20) | ±0,037 / ±0,017 |
| BTC > 1 % | 0,250 | 0,244 (p = 0,45) | 0,207 (0,50 / 0,25) | ±0,014 / ±0,006 |
| ETH > 1,5 % | 0,250 | 0,218 (p = 0,40) | 0,223 (0,50 / 0,20) | ±0,025 / ±0,011 |
