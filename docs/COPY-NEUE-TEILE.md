# Texte für Kalibrierungstest, Satz vor dem Siegeln, Record-Korrektur (18.09.2026)

Gehört nach 03-SCREEN-MAP.md, weil CLAUDE.md verlangt, dass UI-Texte wörtlich von dort kommen.
Bis das eingearbeitet ist, gilt diese Datei als Quelle für genau diese drei Teile.
App-Sprache ist Englisch. Copy-Regel durchgehend: konkrete Irrtümer zeigen, nicht diagnostizieren.

## A. Kalibrierungstest beim ersten Start

Ersetzt die Beispielrunde als Inhalt für Erststart bei geschlossenem Fenster und für den Weg ohne
Genesis Token. Teil des geführten Wegs ("See how it works").

### Einstieg
Kicker: `BEFORE YOU START`
Hero: `How sure is sure?`
Body: `Twelve questions. You already know the answers are out there — you just don't know them.
Answer with a number: how likely is it that you are right?`
CTA: `Start · 2 minutes`
Secondary: `Skip`

### Fragenformat
Dieselbe Skala wie im Hauptspiel (5–95, 21 Positionen). Über der Skala:
`How likely is this true?`
Nach jeder Antwort sofort die Auflösung, eine Zeile, ohne Wertung:
`True.` bzw. `False.` + Quelle klein in Mono.

### Die zwölf Fragen
Jede Antwort MUSS vor dem Bau gegen eine Quelle geprüft und die Quelle in der App klein angezeigt
werden. Ein Faktenfehler im Kalibrierungstest zerstört das Vertrauen sofort.

1. `The Danube is longer than the Rhine.` → True (≈2850 km vs ≈1230 km)
2. `Australia has more people than the Netherlands.` → True (≈27 Mio vs ≈18 Mio)
3. `The summit of Mount Everest is the point farthest from Earth's centre.` → False (Chimborazo)
4. `Sweden has more lakes than Finland.` → False (Finnland ≈188 000, Schweden ≈97 000)
5. `Reykjavík lies farther north than Anchorage.` → True (64,1° N vs 61,2° N)
6. `Iceland is larger than Bavaria.` → True (≈103 000 km² vs ≈70 500 km²)
7. `An octopus has more than two hearts.` → True (drei)
8. `The Sahara is larger than Brazil.` → True (≈9,2 Mio km² vs ≈8,5 Mio km²)
9. `Greater Tokyo has more people than Canada.` → False (≈37 Mio vs ≈40 Mio) — knapp, gute Frage
10. `Gold is denser than lead.` → True (19,3 vs 11,3 g/cm³)
11. `Rome lies farther north than New York City.` → True (41,9° N vs 40,7° N)
12. `The Pacific Ocean is more than twice the size of the Atlantic.` → False (≈165 vs ≈85 Mio km²,
    knapp unter dem Doppelten)

### Ergebnis — keine Diagnose, konkrete Irrtümer
Kicker: `YOUR FIRST READING`
Hero, Variante A (überschätzt, häufigster Fall):
`On 8 questions you were at least 80% sure. 5 of them were true.`
Hero, Variante B (gut kalibriert):
`On 8 questions you were at least 80% sure. 7 of them were true.`
Hero, Variante C (zu vorsichtig):
`You never went above 70%. Nine of your answers were right.`
Darunter, immer:
`Twelve questions are not a verdict. They are a first look.`
CTA: `Show me where I was wrong` → Liste der Fehleinschätzungen, absteigend nach Sicherheit:
Zeile je Eintrag: `You said 90% · False` + die Frage klein darunter.

### Übergabe an den Tagesablauf
Ein ruhiger Bildschirm, kein zweiter Mock-Record:
Hero: `Tomorrow it counts.`
Body: `One question a day about something nobody knows yet. You answer with a number, seal it, and
open it the next evening. Over weeks that becomes a record you cannot rewrite.`
Zeile: `Tonight's question opens at 16:00 UTC · 18:00 where you are.`
Link: `See a finished call →` (führt in die Vorschau; „call“ nach der Wortregel vom 21.09.)
Link klein: `See a real sealed round on Solana →` (Explorer-Link auf eine echte Runde der Saison — hier bleibt „round“, weil der Link die Kette benennt)

## B. Der Satz vor dem Siegeln
> **Überholt am 21.09.2026 durch 03-SCREEN-MAP §11.2 (E13/E8).** Dort steht die
> freigegebene Fassung: Überschrift nach Seite (`What tipped you toward Up?`), Unterzeile
> `One sentence for tomorrow. Optional.` und der Freigabe-Schalter. Gilt weiter aus diesem
> Abschnitt: Zeichengrenze 140 mit Zähler ab 120, die Anzeige auf Result
> (`Yesterday you wrote:` / `No note yesterday.`) und der einmalige Hinweis beim ersten Mal.
> **Hinfällig:** `Stays on this phone. Nobody else sees it.` — der Satz kann jetzt geteilt
> werden; die Privatheit steht in der Unterzeile des Schalters.

### Eingabe auf Today, unter der Skala, über dem Seal-Knopf
Label: `Why? (optional)`
Placeholder: `One line. Tomorrow you'll be glad you wrote it.`
Zeichengrenze: 140, Zähler erst ab 120 sichtbar.
Hinweis darunter, klein: `Stays on this phone. Nobody else sees it.`

### Anzeige auf Result, unter "You gave Yes a 40% chance."
Wenn ein Satz existiert:
`Yesterday you wrote:` + Text in Literata, kursiv, nicht in Anführungszeichen.
Wenn keiner existiert:
`No note yesterday.` (grau, klein, keine Aufforderung, kein Vorwurf)

### Hinweis beim ersten Mal, einmalig unter dem Eingabefeld
`After the outcome, everyone thinks they saw it coming. Your own words from yesterday are the only
thing that disagrees.`

## C. Record-Screen: Ersatz für leaningOf

Heute diagnostiziert app/src/mock.ts ab 10 aufgedeckten Runden ("Leaning hot") und misst dabei eine
Neigung zu "Ja" statt Übermut. Beides raus.

Unter 21 aufgedeckten Runden, Hero:
`On 5 questions you were at least 80% sure. 3 of them happened.`
Darunter: `Too few calls for a verdict.`
Wenn weniger als 3 Runden mit ≥80 %: `Not enough confident calls yet.`

Ab 21 aufgedeckten Runden bleibt das Temperatur-Urteil wie geplant ("You run hot."), weil es dann
aus den eigenen Daten getragen ist.

## D. Judge Mode / geführter Weg
Kein eigener Modus, sondern ein Faden durch Teile, die ohnehin gebaut werden:
Erststart → `See how it works` → Kalibrierungstest → Übergabe-Bildschirm → Beispielrunde mit
Aufdeck-Moment → Beispiel-Record mit Kurve → `Tonight's question opens at 16:00 UTC`.
Bedingungen: durchgehend als Beispiel gekennzeichnet ("Sample · not your phone"), und mindestens ein
Explorer-Link auf eine echte versiegelte Runde der laufenden Saison, damit die Kette vorkommt.

## D. Export und Import des Geheimnisses (E2) — **überholt**

> **Ersetzt am 21.09.2026 durch die freigegebene Fassung in 03-SCREEN-MAP §11.8.** Dort heißt es
> durchgehend „backup code“ statt „key“, es gibt eine Warnung gegen das Einfügen der
> Wallet-Phrase und einen Überspringen-Weg. Der Vorschlag unten ist nur noch Protokoll.

Hintergrund: Seed Vault Wallet kann keine Nachrichten signieren (am Gerät geprüft, fünf
Versuche). Das Saison-Geheimnis ist deshalb zufällig und liegt auf dem Gerät. Eine
Deinstallation verliert damit die noch offenen Antworten — höchstens drei Tage, weil das
Aufdeckfenster 72 h dauert. Der Export ist die Gegenmaßnahme, und die Copy muss beides sagen:
was er nützt, und was ohne ihn passiert.

### Onboarding, Schritt 3 (steht bereits so in 03 §1, bleibt)
`Keep this installation. Reinstalling can forfeit a pending answer. This is not your seed phrase.`

### Einstellungen — neuer Abschnitt
Überschrift: `Backup`
Body: `Your open answers live on this phone. If you uninstall the app, answers you have sealed
but not yet revealed are lost. Copy this key and keep it somewhere safe — with it, a new
installation can open them again.`
Knopf: `Copy backup key`
Nach dem Kopieren, klein: `Copied. It is useless without this wallet.`

### Einstellungen — Wiederherstellung
Überschrift: `Restore`
Body: `Paste the backup key from your old installation. Your sealed answers come back from the
chain — the sentences you wrote do not.`
Feld-Platzhalter: `64 characters`
Fehler bei falscher Eingabe: `That is not a backup key.`
Erfolg: `Restored. {n} open {n, plural, one {call} other {calls}} are yours again.`

### Warum der Satz nicht zurückkommt
Der Satz war nie auf der Kette, außer der Spieler hat ihn ausdrücklich geteilt (E8). Das steht
in der Restore-Copy, damit niemand ihn vermisst und uns für unehrlich hält.

