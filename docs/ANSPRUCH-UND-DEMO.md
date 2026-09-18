# Observed — Anspruchssatz und Betrugs-Demo (18.09.2026)

Gehört zu DECISIONS-2026-09-18.md. Beides ist entschieden und geht so in Spec, Deck und Tests.

## 1. Der Anspruchssatz

Drei Versprechen wurden bisher als eines behandelt:
1. Niemand kann das Ergebnis festlegen. → leistet das Programm.
2. Niemand kann den Datenpunkt auswählen. → leistet die Auswahlregel.
3. Niemand kann das Ereignis beeinflussen. → bei Preisen unmöglich, wird nicht behauptet.

**Gültige Fassung (Spec, deutsch):**
> Die Auswertungsregel steht vor der Vorhersage fest. Weder Betreiber noch Einreicher können
> nachträglich einen anderen zulässigen Datenpunkt oder ein anderes Ergebnis wählen. Welcher
> Datenquelle das System vertraut, ist offengelegt.
> Nicht behauptet wird, dass niemand das Ereignis beeinflussen kann. Preise werden von Menschen
> gemacht.

**Gültige Fassung (App und Deck, englisch):**
> The rule was fixed before the prediction. Neither the operator nor anyone else can pick a
> different admissible reading or a different outcome afterwards. The source this app trusts is
> named in Settings.

**Die datenwegabhängige Zusatzzeile** (steht erst nach der Montagsentscheidung fest):
- Veröffentlichungsreihenfolge (nur mit signiertem Update / API-Schlüssel):
  "Every round resolves on exactly one published update — the first one after the deadline.
  Nobody chooses it."
- Einreichungsreihenfolge (gesponsertes Konto lesen, Schnappschuss):
  "Every round resolves on the last reading published before the deadline, and it cannot be
  replaced."
  → Diese Fassung nennt zusätzlich die gemessene Restunsicherheit: In wie vielen Runden hätte die
  Wahl zwischen den zulässigen Werten das Ergebnis überhaupt verändert (aus den Wochenenddaten).

**Merksatz für die Entscheidung:** "First submitted" ist kein Beweis für "first published".
Ein signiertes Update trägt prev_publish_time in der Signatur und beweist damit
Veröffentlichungsreihenfolge. Das Lesen eines Kontos beweist nur, wer zuerst gelandet ist.
Deshalb lautet die Regel auf dem verbleibenden Weg **"letztes Update vor T, gelesen nach T"** —
sie benennt genau einen Wert, ohne Reihenfolge behaupten zu müssen.

## 2. Die Betrugs-Demo, korrigiert

Ursprünglich fünf Punkte als ein Beweis. ChatGPT hat zu Recht zerlegt: zwei davon sind keine
Integritätsbeweise. Richtige Sortierung:

### Drei echte Ablehnungen (Integrität, Tests liegen grün im Repo)
| Versuch | Antwort des Programms | Was es beweist |
|---|---|---|
| Abgegebene Zahl nachträglich ändern | Commitment passt nicht | Die Antwort ist unveränderlich |
| Echten, aber zeitlich falschen Kurs einreichen | Für diese Runde unzulässig | Die Regel stand vorher fest |
| Günstigeren Kurs derselben Quelle einreichen | Auswahlregel lässt ihn nicht zu; Wert ist festgeschrieben | Keine nachträgliche Wahl |

### Eine Verfügbarkeitsaussage (getrennt benennen)
Server abgeschaltet, ein anderes Gerät löst die Runde trotzdem auf. Kein Beweis gegen Betrug,
sondern der Beleg, dass das Spiel ohne uns weiterläuft.

### Eine Spielregel (getrennt benennen)
Wer nicht aufdeckt, bekommt den vollen Fehlschlag (1,000). Schützt den Record vor selektivem
Aufdecken. Spieldesign, keine Kryptografie.

### Im Video nur einer
Die Zahl nachträglich ändern, 20 Sekunden. Der einzige, den man ohne Erklärung versteht, und der
einzige, der erklärt, warum der eigene Record etwas bedeutet. Der Rest gehört ins Deck und ins
Repo. Begründung: Eine Minute Sicherheitsnachweis wirkt wie eine Entwicklerpräsentation
(ChatGPT-Erstkontakttest, 18.09.: "beim ersten Versuch beeindruckend, ab dem dritten anstrengend").

## 3. Was aus demselben Test noch folgt (Video)
Härtester Befund: "Ihr beweist ausführlich, dass der Record schwer zu manipulieren ist, aber zeigt
kaum, warum jemand einen haben will." Das ist der Echo-Fehler eine Ebene höher.
Konsequenz für die Videostruktur: kurz Frage und Zahl, kurz Siegeln, kurz Zeitwechsel, eine
Manipulation (20 s), dann der lange Teil (40 s) über einen echten Menschen mit echten Zahlen —
"Bei zehn Fragen war ich mir zu mindestens 80 % sicher. Fünf davon sind eingetreten." Dafür reichen
Dinkelbergs eigene Runden ab Saisonstart bis zur Abgabe (rund zehn Runden). Zweite Begründung
dafür, die Saison früh zu starten. Claude Codes Veto beachten: Bei Start 26.09. sind es bis zum
06.10. ~10 Runden, davon wenige mit ≥80 % — die Beispielzahlen im Video müssen vorher nachgerechnet
werden, nicht angenommen.
Schlusssatz abschwächen: "Nach dreißig Tagen erkennst du erste Muster" statt "weißt du es".
