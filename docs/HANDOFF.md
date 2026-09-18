# HANDOFF â€” gemeinsames GedÃ¤chtnis von Claude (Chat) und Claude Code

Diese Datei ist die einzige Stelle, an der beide schreiben. Sie ersetzt keine Spec und keine
Entscheidungsdatei. Sie hÃ¤lt fest, was der jeweils andere noch nicht weiÃŸ, und wo einer den anderen
korrigiert hat â€” damit derselbe Fehler nicht zweimal passiert.

Ablage: `docs/HANDOFF.md` im Repo. Das Repo ist die Wahrheit; es gibt bewusst keine zweite Kopie.

## Spielregeln
1. **Claude Code schreibt hier**, wenn er (a) eine Annahme aus Chat/Spec widerlegt hat, (b) eine
   Messung hat, die eine Entscheidung Ã¤ndert, (c) etwas braucht, das nur Dinkelberg oder der Chat
   liefern kann. Nicht fÃ¼r normalen Fortschritt â€” der steht in Commits und `docs/spikes/`.
2. **Claude (Chat) schreibt hier**, wenn eine Entscheidung fÃ¤llt, die den Code betrifft, und wenn er
   eine eigene frÃ¼here Aussage zurÃ¼ckzieht.
3. **Jeder Eintrag: Datum Â· wer Â· ein Satz Behauptung Â· ein Satz Beleg Â· die Folge.** Keine
   BegrÃ¼ndungsaufsÃ¤tze, die gehÃ¶ren in DECISIONS-*.md.
4. **Wer die Datei liest, liest sie ganz.** Deshalb hart begrenzt: Abschnitt â€žKorrekturen" maximal
   15 EintrÃ¤ge, Abschnitt â€žOffen" maximal 10. Beim Ãœberlaufen wird der Ã¤lteste erledigte Eintrag
   gelÃ¶scht, nicht archiviert.
5. Widerspruch wird nicht geglÃ¤ttet. Wenn Chat und Claude Code verschiedener Meinung sind, stehen
   **beide Positionen** hier, bis Dinkelberg entscheidet. Kein stilles Ãœberschreiben.
6. Keine SchlÃ¼ssel, keine Wallet-Adressen von Dinkelberg, keine Secrets â€” auch nicht als Beispiel.

## Stand
- Letzte Aktualisierung: 18.09.2026, spÃ¤t abends, von Claude Code (EintrÃ¤ge ab Zeile â€žzweite Kopieâ€œ und Bewertung unten).
- Einreichung 08.10., Feature-Freeze 02.10., danach **kein Code mehr bis 10.11.**
- Aktuelle PrioritÃ¤t: Kernablauf auf dem GerÃ¤t (Wallet â†’ Antwort â†’ Siegeln â†’ SchlieÃŸen â†’ Aufdecken
  â†’ Ergebnis â†’ Record, inkl. Wiederaufnahme nach Absturz). Alles andere ist nachrangig.
- FortschrittsmaÃŸstab: **Wie viele echte Tageswechsel hat ein Nutzer durchlaufen?** Steht auf null.

## Korrekturen â€” wer wen widerlegt hat

| Datum | Wer korrigiert | Behauptung | Beleg | Folge |
|---|---|---|---|---|
| 18.09. | Claude Code â†’ Chat | Auswahlregel â€žerster gÃ¼ltiger Schreibzugriff, enger Korridor" | Bei ~5 s Takt sind bis zu ~24 Werte zulÃ¤ssig â€” trÃ¤gt den Anspruchssatz nicht | Regel ist jetzt **â€žletztes Update vor T, gelesen nach T"** |
| 18.09. | Claude Code â†’ Chat | ChatGPTs Videozeile Ã¼ber eigene Runden mit â‰¥80 % | Start 26.09. â†’ bis 06.10. nur ~10 Runden, davon wenige â‰¥80 % | Beispielzahlen im Video vor dem Dreh nachrechnen, nicht annehmen |
| 18.09. | Claude Code â†’ Chat | Chat hatte zwei nÃ¶tige ProgrammÃ¤nderungen Ã¼bersehen | Fragetyp-Feld fÃ¼r â€žBewegung"; Migration auf den neuen Pyth-Stack | Beides steht vor Saisonstart an |
| 18.09. | ChatGPT â†’ Chat | â€žBetrugs-Demo mit fÃ¼nf Beweisen" | Zwei der fÃ¼nf sind keine IntegritÃ¤tsbeweise (VerfÃ¼gbarkeit, Spielregel) | Sortiert in ANSPRUCH-UND-DEMO.md; im Video nur einer |
| 18.09. | Review â†’ Programm | Missing wird mit 0,250 gescored | Simulation: â€žnur Treffer aufdecken" war dominante Strategie (0,098 gegen 0,238) | **Missing = 1,000 (10 000 bps)**, Copy Ã¼berall â€žcounts as a full miss" |
| 18.09. | Chat â†’ Konzept | Cross-Asset-Fragen (Gold, Devisen, Aktien) | Diese Feeds zahlt eine unbekannte Einzelwallet; 285 von 513 Konten stehen still | Saison 1 bleibt Krypto, eine Fragenfamilie (â€žBewegung") |
| 18.09. | Claude Code â†’ Dinkelberg | Die neuen Dokumente (HANDOFF, DECISIONS, ANSPRUCH, ZIELBILD, COPY) und die CLAUDE.md-Ã„nderung lagen in einer zweiten Kopie | `Documents\Observerd SOL\observed-repo` steht auf `55787f6` (17.09.); das Repo steht auf `fc3dad8` und ist 20 Commits weiter (Missing 1,000, DEPLOY_AUTHORITY, Resolver, sponsored-feeds) | In das Repo Ã¼bernommen. Die Windows-Kopie nicht mehr benutzen, sondern lÃ¶schen oder neu klonen, sonst entstehen zwei Wahrheiten |
| 18.09. | Claude Code â†’ Chat/Spec | â€žServer aus, ein anderes GerÃ¤t lÃ¶st trotzdem auf" (ANSPRUCH Â§2) und â€žspÃ¤ter ausgefÃ¼hrt = gleiches Ergebnis" (Spec Â§3) gelten mit der Schnappschuss-Regel nicht mehr | â€žLetztes Update vor T" ist nur lesbar, bis das nÃ¤chste Update das Konto Ã¼berschreibt: auf Shard 0 im alten Stack nach 52â€“55 s, im neuen Stack bei SOL/BTC nach â‰¤5 s (docs/sponsored-feeds.md, 20-min-Messung) | Die VerfÃ¼gbarkeitsaussage lautet dann â€žjeder kann auflÃ¶sen, aber nur im Landefenster direkt nach T". Die NO_RESOLVE-Quote (Offen 3) entscheidet, ob der Satz trÃ¤gt |
| 18.09. | Claude Code â†’ Chat | DECISIONS-18: gesponserte Feeds hÃ¤tten â€ž~50â€“55 s Takt" | Das gilt nur fÃ¼r den alten Stack. Im neuen Stack (`pyt2F4â€¦`), der die Pythnet-Abschaltung Ã¼berlebt, kamen SOL und BTC in 20 min alle â‰¤5 s (Grenze der Abfrage), ETH alle ~54 s | Das Landefenster fÃ¼r â€žletztes Update vor T" ist bei SOL/BTC Sekunden, nicht eine Minute. Die Wochenendmessung erfasst den neuen Stack seit 18.09. 15:42 UTC |
| 18.09. | Claude Code â†’ Chat | Offen 1 (KompatibilitÃ¤t) ist teilweise schon beantwortet | `pyth-solana-receiver-sdk` 2.0.0 prÃ¼ft ohne Feature `pro-compatible` den Besitzer `rec5Eâ€¦`: Konten im alten Stack werden angenommen, Konten im neuen Stack (`rec2HHâ€¦`) abgelehnt. Der Emitterwechsel spielt beim Lesen eines Kontos keine Rolle, das Programm prÃ¼ft nur Besitzer, Diskriminator und `Full` | Offen bleibt nur, wie lange der alte Stack noch aktualisiert wird. Der Wechsel ist ein Cargo-Feature plus neue Fixtures, 2â€“4 h (teuerste Unbekannte: Fixtures aus echten Konten des neuen Stacks) |
| 18.09. | Claude Code â†’ Chat | â€žSOL bewegt sich an ~45 % der Tage um mehr als 2 %" | FÃ¼r unser Fenster 04â†’16 UTC: 33,5 % Ã¼ber 365 Tage, 26,7 % in den letzten 90. Montag bis Freitag 40 %, Samstag/Sonntag 17 % (docs/spikes/baserate.md) | Schwellen mÃ¼ssen nach Werktag und Wochenende getrennt werden, sonst liegt die Basisrate am Wochenende bei 17 %, also auÃŸerhalb von 30â€“70 %. Eine eingefrorene Rate driftet um ~14 Punkte im Jahr |
| 18.09. | Claude Code â†” Chat (offen) | **Chat:** Die Basisraten-Linie macht KI-Nutzung sichtbar. **Claude Code:** Sie zeigt in Saison 1 nichts Unterscheidbares | Der Basisraten-Spieler schlÃ¤gt â€žimmer 50 %" auf 90 Tagen nur um 0,006â€“0,048. Der Standardfehler eines Spielers Ã¼ber 13 Runden liegt bei Â±0,014â€“0,037. Schon die Aufteilung Werktag/Wochenende, also das Mindeste, was ein Modell sagt, schlÃ¤gt die eingefrorene Rate (BTC 0,244 â†’ 0,207) | Die Linie unterschÃ¤tzt das Modell und ist innerhalb des Rauschens. Entscheidung (a/b/c) bei Dinkelberg, siehe Offen 10 |
| 18.09. | Claude Code â†” Chat (offen) | **Chat:** Bei â€žBewegung" hat ein Modell den grÃ¶ÃŸten Vorsprung, wegen der Basisrate. **Claude Code:** GrÃ¶ÃŸter Vorsprung ja, aber aus einem anderen Grund | Die Basisrate halten wir mit Schwellen um 30â€“70 % ohnehin nahe 50 %. Der eigentliche Vorsprung ist die aktuelle VolatilitÃ¤t (implizite Vola, Ereignistage), und die ist vorhersagbar. Bei Richtung und Vergleich hat niemand einen Vorsprung, auch kein Modell | Wer KI sichtbar machen will, brÃ¤uchte eine Linie â€žaktuelle VolatilitÃ¤t" statt â€žBasisrate". Das ist in Saison 1 nicht machbar |
| 18.09. | Claude Code â†’ Chat | COPY-NEUE-TEILE widerspricht Code und sich selbst | (1) â€žSkala 5â€“95, 21 Positionenâ€œ: 5â€“95 hat 19 Positionen; der Code kennt 0â€“100 in 5er-Schritten = 21 (`p_bps % 500`). (2) Abschnitt A â€žersetzt die Beispielrundeâ€œ, aber Ãœbergabe und Abschnitt D fÃ¼hren weiter in die Beispielrunde. (3) Frage 4 (Seen in Schweden/Finnland) hÃ¤ngt an der ZÃ¤hlgrenze und ist nicht eindeutig. (4) Die LÃ¶sungen sind 8Ã— wahr und 4Ã— falsch; wer immer ~70 % â€žwahrâ€œ sagt, schneidet gut ab. (5) Abschnitt C behÃ¤lt ab 21 Runden â€žYou run hot.â€œ, aber `leaningOf` misst eine Neigung zu Ja, nicht Ãœbermut | Vor der Ãœbernahme nach 03 korrigieren: Skala 0â€“100, Beispielrunde behalten oder streichen, Frage 4 ersetzen, 6 wahr / 6 falsch, Urteil ab 21 aus einem Temperatur-Fit statt `leaningOf` |
| 18.09. | Claude Code â†’ Chat | ANSPRUCH Â§2: â€žDie Tests zu den drei Ablehnungen liegen grÃ¼n im Repoâ€œ | Die Tests fÃ¼r â€žzeitlich falscher Kursâ€œ und â€žgÃ¼nstigerer Kursâ€œ prÃ¼fen die alte Hermes-Regel (`NotFirstAfter`, `BeforeWindow`, `OutsideOracleWindow`). Nur der Test â€žZahl nachtrÃ¤glich Ã¤ndernâ€œ Ã¼berlebt den Umbau unverÃ¤ndert | Die beiden anderen werden beim Wechsel auf den Schnappschuss neu geschrieben. GrÃ¼n sind sie heute, nach dem Umbau erst wieder mit neuen Tests |

## Stolpersteine, die zweimal Zeit gekostet haben
- **Pyth ist kein fester Grund.** Hermes braucht seit 26.08. einen SchlÃ¼ssel, Pythnet wird
  abgeschaltet, der Emitter hat gewechselt (`G9LV2mp9â€¦` â†’ `6R92oFTâ€¦`). Jede Annahme Ã¼ber Pyth wird
  gegen die Doku von heute geprÃ¼ft, nie gegen Erinnerung.
- **AufwandsschÃ¤tzungen im Chat sind keine Messungen.** Zahlen zu Bytes, CUs, GebÃ¼hren und
  Freigaben kommen aus `docs/spikes/`, sonst stehen sie nicht in Dokumenten.
- **AufwandsschÃ¤tzungen in Stunden bitte als Spanne** mit der teuersten bekannten Unbekannten
  benannt â€” Dinkelberg rechnet sie erfahrungsgemÃ¤ÃŸ nach unten.
- **UI-Texte**: `CLAUDE.md` verlangt sie wÃ¶rtlich aus `docs/03-SCREEN-MAP.md`. Neue Texte liegen
  zuerst in `docs/COPY-NEUE-TEILE.md` und mÃ¼ssen von dort nach 03 wandern, bevor sie in Code gehen.

## Offen â€” mit Besitzer
| # | Was | Wer | Bis |
|---|---|---|---|
| 1 | KompatibilitÃ¤tstest: akzeptiert unser Build die seit 26.08. live liegenden Daten? Bei Nein: stiller Totalausfall | Claude Code | Mo 21.09. |
| 2 | Wochenendauswertung 48-h-Logger (LÃ¼cken, Alter um 04:00/16:00 UTC) | Claude Code | Mo 21.09. |
| 3 | Wie oft wird das Rennen verloren (erwartete NO_RESOLVE pro Saison)? | Claude Code | Mo 21.09. |
| 4 | Alt- oder Neu-EmpfÃ¤nger: Wechselkosten in Stunden | Claude Code | Mo 21.09. |
| 5 | Namen der 33 von Pyth gepflegten Feeds â€” **erledigt**: `docs/sponsored-feeds.md`, Gruppe A (fc3dad8) | Claude Code | erledigt 18.09. |
| 6 | Kernablauf auf dem Seeker, einmal durchgespielt Ã¼ber einen echten Tageswechsel | Dinkelberg | vor 28.09. |
| 7 | `.spec-unlock` anlegen, wenn 00-SPEC geÃ¤ndert werden muss | Dinkelberg | bei Bedarf |
| 8 | Offline-SchlÃ¼ssel + Hot Wallet erzeugen, Cloudflare/Helius/healthchecks einrichten | Dinkelberg | vor Saisonstart |
| 9 | Expo-Token und Pyth-Key erneuern (standen im Chat) | Dinkelberg | sofort |
| 10 | Basisraten-Linie: (a) festschreiben, nur Feld, (b) Client-SchÃ¤tzung, (c) weglassen. Countdown im Test ja/nein. Aufwand und Bewertung siehe unten | Dinkelberg | vor Sa 19.09. (Programm) |

## Bewertung Claude Code, 18.09. (VorschlÃ¤ge aus dem Chat)
- **Basisrate, Daten:** nicht tot. Coinbase-Stundenkerzen, ohne SchlÃ¼ssel, einmalig, 90 Anfragen fÃ¼r 3 Feeds Ã— 365 Tage. Das ist Coinbase-Kurs, nicht Pyth, fÃ¼r eine Rate unerheblich (docs/spikes/baserate.md).
- **Basisrate, Vertrauen:**
  - (a) ist ein **Feld**, kein Umbau: `base_rate_bps u16` in `RoundTerms`, damit im `terms_hash` und im Kalender. Das kommt in dieselbe Layout-Ã„nderung vor Saisonstart, die ohnehin ansteht (Fragetyp, `source_kind`, Version). Datenbasis und Skript im Klartext in CALENDAR.md.
  - (b) widerspricht dem Anspruchssatz, weil es eine unbelegte Zahl ist.
  - (c) kostet nichts.
- **Basisrate, Definition:** Nur eingefroren ist festschreibbar. Rollierend hieÃŸe nachtrÃ¤glich berechnet, also nicht versiegelbar. Getrennt nach Werktag und Wochenende, sonst ist sie fÃ¼r die HÃ¤lfte der Tage falsch. Ereignistage: ~10 in 180 Tagen, Standardfehler einer Rate bei n = 10 â‰ˆ Â±16 Punkte. Eine eigene Ereignisrate ist nur mit 2+ Jahren Daten und belegten Terminlisten ehrlich; sonst die Linie an Ereignistagen als â€žignores event days" beschriften.
- **Basisrate, Aufwand:** 7â€“11 h gesamt, davon 2â€“3 h im Programm und Generator vor Saisonstart, der Rest im Client. Teuerste Unbekannte: Terminliste der Ereignistage. Verschiebt den Saisonstart nicht, wenn nur das Feld jetzt kommt und die Anzeige nach dem 10.11.; mit Anzeige kostet es 5â€“8 h aus der App-Woche, also Satz oder Test.
- **Countdown:** 3â€“5 h (Timer, Pause bei App im Hintergrund, Frage ohne BerÃ¼hrung = Ã¼bersprungen, Ergebnis mit n < 12, Abschaltoption fÃ¼r Bedienungshilfen nach WCAG 2.2.1). Vom Persistenz- und Wiederaufnahme-Pfad **vollstÃ¤ndig entkoppelt**, solange der Test nicht in den Siegel-Speicher schreibt: nur das Endergebnis unter eigenem SchlÃ¼ssel, bei Absturz Neustart des Tests ab Frage 1. Einzige BerÃ¼hrung ist der Erststart. Der Abgleich offener Siegel beim Kaltstart muss **vor** dem Test laufen, nicht dahinter. Es fehlen Texte fÃ¼r â€žZeit abgelaufenâ€œ und â€žohne Timerâ€œ.
- **Familie auf eigenen Kettendaten** (â€žDurchschnitt heute > 50 %?"): pro Runde billiger, weil kein Orakel, kein Rennen und kein NO_RESOLVE aus ZeitgrÃ¼nden. Sie ist aber ein zweiter PrÃ¼fer, 4â€“6 h, und liest den Histogramm-Zustand einer anderen Runde. AuÃŸerdem schlieÃŸt Spec Â§7 sie aus (â€žKeine Meta-Frage"), und bei wenigen Spielern verschiebt ein Einzelner den Mittelwert, auch durch gezieltes Nichtaufdecken fÃ¼r 1,000. Sie fÃ¼r Saison 1 zu verwerfen war aus Umsetzungssicht richtig. FÃ¼r Saison 2 ist sie der PrÃ¼fer â€žSolana-eigener Zustand" aus dem Zielbild.

## Was der Chat gerade nicht weiÃŸ
Claude Code sieht den Code, der Chat nicht. Wenn eine Entscheidung im Chat auf einer Annahme Ã¼ber
den Code beruht, die falsch ist, ist das der wichtigste Eintrag, den es hier geben kann â€” bitte
lieber einen zu viel als einen zu wenig.
