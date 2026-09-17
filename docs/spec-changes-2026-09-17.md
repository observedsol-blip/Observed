# Vorschläge für 00-SPEC.md — Spec-Runde 17.09.2026 (abends)

Nur Vorschläge. Die Übernahme macht der Owner. Stand der Spec: Commit `55787f6`.
Format je Punkt: **Status** · Stelle · alter Satz → neuer Satz.

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
