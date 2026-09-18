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
- Letzte Aktualisierung: 18.09.2026, spät abends, von Claude Code (Einträge ab Zeile „zweite Kopie“ und Bewertung unten).
- Einreichung 08.10., Feature-Freeze 02.10., danach **kein Code mehr bis 10.11.**
- Aktuelle Priorität: Kernablauf auf dem Gerät (Wallet → Antwort → Siegeln → Schließen → Aufdecken
  → Ergebnis → Record, inkl. Wiederaufnahme nach Absturz). Alles andere ist nachrangig.
- Fortschrittsmaßstab: **Wie viele echte Tageswechsel hat ein Nutzer durchlaufen?** Steht auf null.

## Korrekturen — wer wen widerlegt hat

| Datum | Wer korrigiert | Behauptung | Beleg | Folge |
|---|---|---|---|---|
| 18.09. | Claude Code → Chat | Auswahlregel „erster gültiger Schreibzugriff, enger Korridor" | Bei ~5 s Takt sind bis zu ~24 Werte zulässig — trägt den Anspruchssatz nicht | Regel ist jetzt **„letztes Update vor T, gelesen nach T"** |
| 18.09. | Claude Code → Chat | ChatGPTs Videozeile über eigene Runden mit ≥80 % | Start 26.09. → bis 06.10. nur ~10 Runden, davon wenige ≥80 % | Beispielzahlen im Video vor dem Dreh nachrechnen, nicht annehmen |
| 18.09. | Claude Code → Chat | Chat hatte zwei nötige Programmänderungen übersehen | Fragetyp-Feld für „Bewegung"; Migration auf den neuen Pyth-Stack | Beides steht vor Saisonstart an |
| 18.09. | ChatGPT → Chat | „Betrugs-Demo mit fünf Beweisen" | Zwei der fünf sind keine Integritätsbeweise (Verfügbarkeit, Spielregel) | Sortiert in ANSPRUCH-UND-DEMO.md; im Video nur einer |
| 18.09. | Review → Programm | Missing wird mit 0,250 gescored | Simulation: „nur Treffer aufdecken" war dominante Strategie (0,098 gegen 0,238) | **Missing = 1,000 (10 000 bps)**, Copy überall „counts as a full miss" |
| 18.09. | Chat → Konzept | Cross-Asset-Fragen (Gold, Devisen, Aktien) | Diese Feeds zahlt eine unbekannte Einzelwallet; 285 von 513 Konten stehen still | Saison 1 bleibt Krypto, eine Fragenfamilie („Bewegung") |
| 18.09. | Claude Code → Dinkelberg | Die neuen Dokumente (HANDOFF, DECISIONS, ANSPRUCH, ZIELBILD, COPY) und die CLAUDE.md-Änderung lagen in einer zweiten Kopie | `Documents\Observerd SOL\observed-repo` steht auf `55787f6` (17.09.); das Repo steht auf `fc3dad8` und ist 20 Commits weiter (Missing 1,000, DEPLOY_AUTHORITY, Resolver, sponsored-feeds) | In das Repo übernommen. Die Windows-Kopie nicht mehr benutzen, sondern löschen oder neu klonen, sonst entstehen zwei Wahrheiten |
| 18.09. | Claude Code → Chat/Spec | „Server aus, ein anderes Gerät löst trotzdem auf" (ANSPRUCH §2) und „später ausgeführt = gleiches Ergebnis" (Spec §3) gelten mit der Schnappschuss-Regel nicht mehr | „Letztes Update vor T" ist nur lesbar, bis das nächste Update das Konto überschreibt: auf Shard 0 im alten Stack nach 52–55 s, im neuen Stack bei SOL/BTC nach ≤5 s (docs/sponsored-feeds.md, 20-min-Messung) | Die Verfügbarkeitsaussage lautet dann „jeder kann auflösen, aber nur im Landefenster direkt nach T". Die NO_RESOLVE-Quote (Offen 3) entscheidet, ob der Satz trägt |
| 18.09. | Claude Code → Chat | DECISIONS-18: gesponserte Feeds hätten „~50–55 s Takt" | Das gilt nur für den alten Stack. Im neuen Stack (`pyt2F4…`), der die Pythnet-Abschaltung überlebt, kamen SOL und BTC in 20 min alle ≤5 s (Grenze der Abfrage), ETH alle ~54 s | Das Landefenster für „letztes Update vor T" ist bei SOL/BTC Sekunden, nicht eine Minute. Die Wochenendmessung erfasst den neuen Stack seit 18.09. 15:42 UTC |
| 18.09. | Claude Code → Chat | Offen 1 (Kompatibilität) ist teilweise schon beantwortet | `pyth-solana-receiver-sdk` 2.0.0 prüft ohne Feature `pro-compatible` den Besitzer `rec5E…`: Konten im alten Stack werden angenommen, Konten im neuen Stack (`rec2HH…`) abgelehnt. Der Emitterwechsel spielt beim Lesen eines Kontos keine Rolle, das Programm prüft nur Besitzer, Diskriminator und `Full` | Offen bleibt nur, wie lange der alte Stack noch aktualisiert wird. Der Wechsel ist ein Cargo-Feature plus neue Fixtures, 2–4 h (teuerste Unbekannte: Fixtures aus echten Konten des neuen Stacks) |
| 18.09. | Claude Code → Chat | „SOL bewegt sich an ~45 % der Tage um mehr als 2 %" | Für unser Fenster 04→16 UTC: 33,5 % über 365 Tage, 26,7 % in den letzten 90. Montag bis Freitag 40 %, Samstag/Sonntag 17 % (docs/spikes/baserate.md) | Schwellen müssen nach Werktag und Wochenende getrennt werden, sonst liegt die Basisrate am Wochenende bei 17 %, also außerhalb von 30–70 %. Eine eingefrorene Rate driftet um ~14 Punkte im Jahr |
| 18.09. | Claude Code ↔ Chat (offen) | **Chat:** Die Basisraten-Linie macht KI-Nutzung sichtbar. **Claude Code:** Sie zeigt in Saison 1 nichts Unterscheidbares | Der Basisraten-Spieler schlägt „immer 50 %" auf 90 Tagen nur um 0,006–0,048. Der Standardfehler eines Spielers über 13 Runden liegt bei ±0,014–0,037. Schon die Aufteilung Werktag/Wochenende, also das Mindeste, was ein Modell sagt, schlägt die eingefrorene Rate (BTC 0,244 → 0,207) | Die Linie unterschätzt das Modell und ist innerhalb des Rauschens. Entscheidung (a/b/c) bei Dinkelberg, siehe Offen 10 |
| 18.09. | Claude Code ↔ Chat (offen) | **Chat:** Bei „Bewegung" hat ein Modell den größten Vorsprung, wegen der Basisrate. **Claude Code:** Größter Vorsprung ja, aber aus einem anderen Grund | Die Basisrate halten wir mit Schwellen um 30–70 % ohnehin nahe 50 %. Der eigentliche Vorsprung ist die aktuelle Volatilität (implizite Vola, Ereignistage), und die ist vorhersagbar. Bei Richtung und Vergleich hat niemand einen Vorsprung, auch kein Modell | Wer KI sichtbar machen will, bräuchte eine Linie „aktuelle Volatilität" statt „Basisrate". Das ist in Saison 1 nicht machbar |
| 18.09. | Claude Code → Chat | COPY-NEUE-TEILE widerspricht Code und sich selbst | (1) „Skala 5–95, 21 Positionen“: 5–95 hat 19 Positionen; der Code kennt 0–100 in 5er-Schritten = 21 (`p_bps % 500`). (2) Abschnitt A „ersetzt die Beispielrunde“, aber Übergabe und Abschnitt D führen weiter in die Beispielrunde. (3) Frage 4 (Seen in Schweden/Finnland) hängt an der Zählgrenze und ist nicht eindeutig. (4) Die Lösungen sind 8× wahr und 4× falsch; wer immer ~70 % „wahr“ sagt, schneidet gut ab. (5) Abschnitt C behält ab 21 Runden „You run hot.“, aber `leaningOf` misst eine Neigung zu Ja, nicht Übermut | Vor der Übernahme nach 03 korrigieren: Skala 0–100, Beispielrunde behalten oder streichen, Frage 4 ersetzen, 6 wahr / 6 falsch, Urteil ab 21 aus einem Temperatur-Fit statt `leaningOf` |
| 18.09. | Claude Code → Chat | ANSPRUCH §2: „Die Tests zu den drei Ablehnungen liegen grün im Repo“ | Die Tests für „zeitlich falscher Kurs“ und „günstigerer Kurs“ prüfen die alte Hermes-Regel (`NotFirstAfter`, `BeforeWindow`, `OutsideOracleWindow`). Nur der Test „Zahl nachträglich ändern“ überlebt den Umbau unverändert | Die beiden anderen werden beim Wechsel auf den Schnappschuss neu geschrieben. Grün sind sie heute, nach dem Umbau erst wieder mit neuen Tests |

## Stolpersteine, die zweimal Zeit gekostet haben
- **Pyth ist kein fester Grund.** Hermes braucht seit 26.08. einen Schlüssel, Pythnet wird
  abgeschaltet, der Emitter hat gewechselt (`G9LV2mp9…` → `6R92oFT…`). Jede Annahme über Pyth wird
  gegen die Doku von heute geprüft, nie gegen Erinnerung.
- **Aufwandsschätzungen im Chat sind keine Messungen.** Zahlen zu Bytes, CUs, Gebühren und
  Freigaben kommen aus `docs/spikes/`, sonst stehen sie nicht in Dokumenten.
- **Aufwandsschätzungen in Stunden bitte als Spanne** mit der teuersten bekannten Unbekannten
  benannt — Dinkelberg rechnet sie erfahrungsgemäß nach unten.
- **UI-Texte**: `CLAUDE.md` verlangt sie wörtlich aus `docs/03-SCREEN-MAP.md`. Neue Texte liegen
  zuerst in `docs/COPY-NEUE-TEILE.md` und müssen von dort nach 03 wandern, bevor sie in Code gehen.

## Offen — mit Besitzer
| # | Was | Wer | Bis |
|---|---|---|---|
| 1 | Kompatibilitätstest: akzeptiert unser Build die seit 26.08. live liegenden Daten? Bei Nein: stiller Totalausfall | Claude Code | Mo 21.09. |
| 2 | Wochenendauswertung 48-h-Logger (Lücken, Alter um 04:00/16:00 UTC) | Claude Code | Mo 21.09. |
| 3 | Wie oft wird das Rennen verloren (erwartete NO_RESOLVE pro Saison)? | Claude Code | Mo 21.09. |
| 4 | Alt- oder Neu-Empfänger: Wechselkosten in Stunden | Claude Code | Mo 21.09. |
| 5 | Namen der 33 von Pyth gepflegten Feeds — **erledigt**: `docs/sponsored-feeds.md`, Gruppe A (fc3dad8) | Claude Code | erledigt 18.09. |
| 6 | Kernablauf auf dem Seeker, einmal durchgespielt über einen echten Tageswechsel | Dinkelberg | vor 28.09. |
| 7 | `.spec-unlock` anlegen, wenn 00-SPEC geändert werden muss | Dinkelberg | bei Bedarf |
| 8 | Offline-Schlüssel + Hot Wallet erzeugen, Cloudflare/Helius/healthchecks einrichten | Dinkelberg | vor Saisonstart |
| 9 | Expo-Token und Pyth-Key erneuern (standen im Chat) | Dinkelberg | sofort |
| 10 | Basisraten-Linie: (a) festschreiben, nur Feld, (b) Client-Schätzung, (c) weglassen. Countdown im Test ja/nein. Aufwand und Bewertung siehe unten | Dinkelberg | vor Sa 19.09. (Programm) |

## Bewertung Claude Code, 18.09. (Vorschläge aus dem Chat)
- **Basisrate, Daten:** nicht tot. Coinbase-Stundenkerzen, ohne Schlüssel, einmalig, 90 Anfragen für 3 Feeds × 365 Tage. Das ist Coinbase-Kurs, nicht Pyth, für eine Rate unerheblich (docs/spikes/baserate.md).
- **Basisrate, Vertrauen:**
  - (a) ist ein **Feld**, kein Umbau: `base_rate_bps u16` in `RoundTerms`, damit im `terms_hash` und im Kalender. Das kommt in dieselbe Layout-Änderung vor Saisonstart, die ohnehin ansteht (Fragetyp, `source_kind`, Version). Datenbasis und Skript im Klartext in CALENDAR.md.
  - (b) widerspricht dem Anspruchssatz, weil es eine unbelegte Zahl ist.
  - (c) kostet nichts.
- **Basisrate, Definition:** Nur eingefroren ist festschreibbar. Rollierend hieße nachträglich berechnet, also nicht versiegelbar. Getrennt nach Werktag und Wochenende, sonst ist sie für die Hälfte der Tage falsch. Ereignistage: ~10 in 180 Tagen, Standardfehler einer Rate bei n = 10 ≈ ±16 Punkte. Eine eigene Ereignisrate ist nur mit 2+ Jahren Daten und belegten Terminlisten ehrlich; sonst die Linie an Ereignistagen als „ignores event days" beschriften.
- **Basisrate, Aufwand:** 7–11 h gesamt, davon 2–3 h im Programm und Generator vor Saisonstart, der Rest im Client. Teuerste Unbekannte: Terminliste der Ereignistage. Verschiebt den Saisonstart nicht, wenn nur das Feld jetzt kommt und die Anzeige nach dem 10.11.; mit Anzeige kostet es 5–8 h aus der App-Woche, also Satz oder Test.
- **Countdown:** 3–5 h (Timer, Pause bei App im Hintergrund, Frage ohne Berührung = übersprungen, Ergebnis mit n < 12, Abschaltoption für Bedienungshilfen nach WCAG 2.2.1). Vom Persistenz- und Wiederaufnahme-Pfad **vollständig entkoppelt**, solange der Test nicht in den Siegel-Speicher schreibt: nur das Endergebnis unter eigenem Schlüssel, bei Absturz Neustart des Tests ab Frage 1. Einzige Berührung ist der Erststart. Der Abgleich offener Siegel beim Kaltstart muss **vor** dem Test laufen, nicht dahinter. Es fehlen Texte für „Zeit abgelaufen“ und „ohne Timer“.
- **Familie auf eigenen Kettendaten** („Durchschnitt heute > 50 %?"): pro Runde billiger, weil kein Orakel, kein Rennen und kein NO_RESOLVE aus Zeitgründen. Sie ist aber ein zweiter Prüfer, 4–6 h, und liest den Histogramm-Zustand einer anderen Runde. Außerdem schließt Spec §7 sie aus („Keine Meta-Frage"), und bei wenigen Spielern verschiebt ein Einzelner den Mittelwert, auch durch gezieltes Nichtaufdecken für 1,000. Sie für Saison 1 zu verwerfen war aus Umsetzungssicht richtig. Für Saison 2 ist sie der Prüfer „Solana-eigener Zustand" aus dem Zielbild.

## Was der Chat gerade nicht weiß
Claude Code sieht den Code, der Chat nicht. Wenn eine Entscheidung im Chat auf einer Annahme über
den Code beruht, die falsch ist, ist das der wichtigste Eintrag, den es hier geben kann — bitte
lieber einen zu viel als einen zu wenig.
