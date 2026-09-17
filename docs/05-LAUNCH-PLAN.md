# OBSERVED — Launch-Plan: fünf Dinge, die abheben (v1, 17.09.2026)

Kein neues Feature in der App. Alles hier macht sichtbar, was die App ist. Reihenfolge nach Abhängigkeit.

## 0. Voraussetzung für alles
Die Schleife läuft am 8. Oktober auf Mainnet fehlerfrei und **weiter bis 11. November** (Gewinnerbekanntgabe). Cron, Proxy und Push laufen unbeaufsichtigt; Sentry-Alerts auf dein Telefon; Runbook in 02. Kalender-Saison: 64 Blätter, Start = erster Mainnet-Tag, Fragen bis mindestens 11. Nov. Wenn das nicht steht, entfällt Punkt 1 — und Punkt 1 ist der wichtigste.

## 1. Die Judges spielen selbst (Ziel, an dem sich alles ausrichtet)
- **Was:** App im dApp Store ab Einreichung, tägliche Frage läuft durch die gesamte Bewertungsphase. Im Deck: QR-Code zum Store, ein Satz: „Seal one today. Tomorrow you'll know something about yourself.“
- **Wann:** Store-Einreichung so früh wie möglich in Woche 3 (Review-Zeit einplanen); Fallback: signierter APK-Link im Repo, wie die Regeln es ohnehin verlangen.
- **Wer:** du; Claude Code für Release-Build und Signatur.
- **Abnahme:** ein fremdes Seeker (Tester) installiert aus dem Store, versiegelt, bekommt am nächsten Mittag die Push mit der Menge — ohne dass du eingreifst.
- **Risiko:** ein Fehler während der Bewertungsphase ist schlimmer als kein Live-Betrieb. Deshalb Woche 2 Reviews und Woche 3 keine neuen Features.

## 2. Kalender als öffentliche Prüfung
- **Was:** statische Seite `calendar` (02): pro Tag der Hash; nach der Auflösung Frage, Bedingungen, Merkle-Beweis, „verify“-Knopf, der gegen `Config.calendar_root` nachrechnet.
- **Wann:** Woche 2, nach `publish_calendar` auf Mainnet.
- **Wer:** Claude Code (ein Nachmittag).
- **Abnahme:** ein Außenstehender kann für einen aufgelösten Tag den Beweis prüfen, ohne dir zu vertrauen.
- **Deck-Satz:** „Niemand — ich eingeschlossen — kann eine Frage nachschieben. Prüfen Sie es.“

## 3. Betriebsdaten live
- **Was:** statische Seite `status` (02) aus dem Cron-JSON: Runden, aufgelöst / NO_RESOLVE, Median-Verzögerung, Retry-Anteil; Kohorten-Trichter N → M → K, D7 wo erreicht; Pushes und manuelle Erinnerungen offengelegt. Keine Adressen, keine Namen.
- **Wann:** Trichter-Tabelle leer ab Devnet-Tag 4 anlegen; Seite in Woche 2; Zahlen laufen von selbst.
- **Wer:** Claude Code; du legst die Kohorte an.
- **Abnahme:** die Zahl im Deck stimmt mit der Seite überein, am Tag der Einreichung und am 11. November.
- **Deck-Satz:** „Von N Geräten kamen K an drei Tagen zurück — live nachlesbar.“

## 4. Ein Befund statt eines Features
- **Was:** nach ≥ 14 Kohortentagen die Kalibrierung der Menge auswerten (alles liegt on-chain): Reliability-Kurve der Menge, Über-/Unterkonfidenz in Punkten, die Fragen mit der größten Abweichung, Menge gegen Immer-50. Eine Folie, eine Kurve, ein Satz.
- **Wann:** Woche 3, Tag 18–20.
- **Wer:** ich (Auswertung), Claude Code (Skript gegen Chain).
- **Abnahme:** der Satz ist wahr, die Stichprobe steht daneben, kein Rundungsgeschummel.
- **Deck-Satz (Beispiel, Zahlen offen):** „Bei 80 % Sicherheit lag die Menge in 61 % der Fälle richtig.“

## 5. Die versiegelte Vorhersage über sich selbst
- **Was:** am ersten Mainnet-Tag versiegelst du öffentlich eine Wahrscheinlichkeit für „Observed lands in the top 10 of Clock In“ — als Memo-Transaktion mit demselben Hash-Schema (nicht als Runde: das Programm löst nur Feed-Fragen auf). Aufdeckung als zweite Memo-Tx am 11. November, Salt und Wert im Deck vorab an niemanden.
- **Wann:** Tag des Mainnet-Starts; Aufdeckung 11. Nov.
- **Wer:** du, zehn Minuten.
- **Abnahme:** beide Transaktionen verlinkt, Hash nachrechenbar.
- **Deck-Satz:** „Ich habe meine Sicherheit vorab festgelegt. Am 11. November sehen Sie, ob sie stimmte.“

## Reihenfolge im Kalender
| Tag | Punkt |
|---|---|
| 4 | Trichter-Tabelle anlegen (3) |
| Woche 2 | Mainnet, `publish_calendar`, Seiten 2 + 3, Memo-Seal (5) |
| Woche 3, Tag 18–20 | Befund (4) |
| Woche 3, so früh wie möglich | Store-Einreichung (1) |
| 8. Okt | Deck mit QR, Links zu 2 und 3, Folie 4, Folie 5 |
| bis 11. Nov | Betrieb, Alerts, keine Änderungen an Regeln |

## Was nicht dazukommt
Credential, Vote, Pot, Sponsor, Leaderboard. Nichts davon vor dem 11. November. (Das Widget ist v1-Pflicht, siehe Spec §9.)
