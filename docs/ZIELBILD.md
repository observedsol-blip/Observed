# Observed — Zielbild (Stand 18.09.2026)

Entstanden aus der Frage "wie würdest du das bauen, wenn Zeit keine Rolle spielt" und den Antworten
von ChatGPT und Fable. Zwei Teile: was jetzt noch reinkommt, und woran nach dem 10.11. weitergebaut
wird. Die laufenden Entscheidungen stehen in DECISIONS-2026-09-18.md.

Diese Datei ersetzt die ältere Zielbild.md im übergeordneten Ordner.

## Was jetzt noch reinkommt

### 1. Der eigene Satz vor dem Siegeln (höchste Priorität nach dem Kernablauf)
Optional, ein Satz: "Ich denke das, weil …". Wird zusammen mit Zahl und Salt gespeichert und beim
Aufdecken neben der eigenen Antwort angezeigt.

Warum es das Wertvollste pro Aufwand ist:
- Es zerstört die Rückschau-Ausrede. Nach dem Ergebnis erzählt sich jeder, er habe es kommen sehen.
  Die eigenen Worte von gestern machen das unmöglich. Dieser Selbstbetrug ist das Thema der App,
  und wir haben ihn bisher nur über Zahlen angegriffen, obwohl er sprachlich passiert.
- Es füllt den Aufdeck-Moment. Heute zeigt der Zeitwechsel eine Zahl und ein Ergebnis; mit dem Satz
  zeigt er den Nutzer selbst, gestern.
- **Es senkt die Anforderung an die Fragen.** Wenn der interessante Teil die eigene Begründung ist,
  muss die Frage nicht faszinierend sein, sondern nur eine Meinung zulassen. Das entschärft die
  Entscheidung, mit der einfachsten Fragenfamilie zu starten.
- Es ist die halbe Gruppenfunktion (siehe Saison 2): Ohne Begründungen vergleicht eine Gruppe nur
  Zahlen.

Günstige Fassung ohne Programmänderung: Satz nur lokal, neben Salt und Zahl. Für den Nutzer allein
voll wirksam — man belügt sich nicht selbst über etwas, das man selbst geschrieben hat.
Teure Fassung (Saison 2): Satz geht in die Versiegelung und beim Aufdecken auf die Kette, damit
andere ihn prüfen können.

Texte dafür: COPY-NEUE-TEILE.md, Abschnitt B.

### 2. Kalibrierungstest beim ersten Start (wenn die Zeit reicht)
Zwei Minuten, zwölf Fragen mit feststehender Antwort, die man aber nicht einfach weiß
("Ist die Donau länger als der Rhein?"). Antwort wie im Hauptspiel als Wahrscheinlichkeit.
Braucht keine Kette, kein Orakel, keine Wallet.

Löst drei Probleme: der erste Abend ist nicht leer; der unangenehme Moment kommt am Tag eins statt
nach drei Wochen; die Skala wird erlebt statt erklärt.

**Copy-Regel dazu, wichtig:** konkrete Irrtümer zeigen, nicht diagnostizieren. "Hier hast du dich
überschätzt" trifft; "Du bist ein überschätzender Mensch" nach zwölf Trivia-Fragen riecht nach
Persönlichkeitstest. Gilt auch für den Record-Screen: "Du läufst heiß" ist nach zwanzig eigenen
Runden verdient, vorher nicht.

Texte und die zwölf Fragen: COPY-NEUE-TEILE.md, Abschnitt A.

## Saison 2 (nach dem 10.11.)

### 3. Kleine geschlossene Gruppen — von ChatGPT auf Platz 1 gesetzt
Drei bis fünf Leute, dieselben Fragen, nach dem Aufdecken sieht man Zahlen **und Begründungen** der
anderen. Keine Rangliste nach Punkten (misst Glück). Zitat aus dem Test: "Ich will morgen sehen,
warum mein sonst so vorsichtiger Freund heute 90 % gesetzt hat."
Das ist der Wiederkehrgrund, den wir nicht haben — wir haben die Rangliste gestrichen, ohne Ersatz.
Voraussetzung: Nummer 1 in der verifizierbaren Fassung.

### 4. Beweis-Schnittstelle statt fester Orakel-Anbindung
Das Programm prüft nicht "Pyth", sondern Belege. Jede Runde benennt in ihren Bedingungen den
Belegtyp und seine Parameter; im Programm liegen mehrere Prüfer nebeneinander (signiertes
Preis-Update, Kontozustand, Solana-eigener Zustand, später beglaubigte Web-Antworten).
Begründung: Genau daran haben wir zwei Tage verloren. Ein Orakel ändert sein Geschäftsmodell und die
ganze Architektur wackelt. Mit einer Beweis-Schnittstelle wäre das eine neue Runde mit anderem Typ
gewesen, kein Umbau.

### 5. Fragenportfolio, in dem die Sicherheit schwankt
Tageswerte (stehen nach Mitternacht fest, kein Zeitfenster-Rennen), Vergleiche über Anlageklassen,
Ereignistage, Fragen über Solana selbst. Kalibrierung ist nur interessant, wenn die eigene
Sicherheit schwankt.

### 6. Der starke Anspruch, bezahlt
Veröffentlichungsreihenfolge mit signiertem Update, dessen Vorgängerfeld das Programm prüft:
genau ein veröffentlichtes Update entscheidet, und niemand hat es ausgewählt.

## Reihenfolge jetzt
1. Kernablauf auf dem Gerät: Wallet → Antwort → Siegeln → App schließen → am nächsten Tag Aufdecken
   → Ergebnis → Record. Inklusive Wiederaufnahme nach Absturz.
2. Der Satz vor dem Siegeln (lokal).
3. Der Einstiegstest, wenn Zeit bleibt.
4. Alles andere nach dem 10.11.

Fortschrittsmaßstab bis dahin (von ChatGPT): **Wie viele echte Tageswechsel haben Nutzer
erfolgreich durchlaufen?** Steht heute auf null. Alles andere ist Kosmetik, solange dieser Zähler
nicht läuft.
