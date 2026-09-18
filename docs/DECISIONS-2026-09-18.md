# Observed — Stand 18.09.2026, 22:30 MESZ

Fortschreibung von DECISIONS-2026-09-17.md. Dort stehen die weiter gültigen Entscheidungen
(Missing = 1,000, Zeitwechsel, Nachtausgabe-Design, Record mit early read, Share-Karten, Betrieb).

## Termine korrigiert (belegt, Solana Mobile + Radiants, 08.09.2026)
- Bewertung: 10. Oktober bis 8. November. Gewinner: **10. November** (nicht 11.).
- Einreichung: 8. Oktober, 23:59 PST = 9. Oktober, 08:59 MESZ.
- **Nach der Einreichung darf bis zum 10.11. kein Code mehr geändert werden.** Es gibt keine Nacharbeit.
- Veröffentlichung im dApp Store ist kein Bewertungskriterium, aber Pflicht für Gewinner — mit einem
  Monat Zeit nach der Bekanntgabe. Kein Termindruck vorher.
- Plan: Feature-Freeze 02.10., Video/Deck/Repo bis 08.10., Einreichung 08.10. (Tag setzen),
  Veröffentlichung 12.11., unabhängig vom Ergebnis.

## Fenster und Jury
- Seal-Fenster **16:00–04:00 UTC**, Referenz 04:00, Ergebnis 16:00, Aufdecken Folgetag 16:00–04:00.
- Begründung korrigiert: NICHT "Mehrheit der Judges in den USA" (unbelegt). Belegt ist: Die
  Aktivitätszeiten der Judges auf X überlappen am dichtesten 16:00–23:00 UTC (4 von 6 prüfbaren
  Accounts, Grok-Recherche 18.09.). Ein Judge mit asiatischem Rhythmus (Chase, 04–10 UTC) liegt bei
  jeder 12-Stunden-Lage außerhalb.
- Folge: **Erststart bei geschlossenem Fenster ist Hauptweg**, nicht Randfall. Vollständige
  Beispielrunde plus "Yours starts at 16:00 UTC, 18:00 where you are", aus Gerätezeit gerechnet.
- Alle Judges haben ein Seeker (Dinkelberg). Kein Übungsmodus. Stattdessen: SGT-Migration, mehrere
  Wallets, Wallet-Wechsel, Seed Vault nicht eingerichtet, ältere Android-Version absichern.

## Datenquelle — offene Kernfrage, Entscheidung Montag 21.09.
Belegt (Pyth-Doku, DAO-Beschlüsse, Grok):
- Hermes braucht seit 26.08.2026 einen Schlüssel. Starter 500 $/Monat, Free = kein API-Zugang.
  Benchmarks (/v1/updates/price/{timestamp}) ist genau unser Pfad — gleicher Schlüssel.
- **Pythnet wird abgeschaltet** ("Pythnet is being retired", Core→Pro-Migration, Sunset Q3 2026).
  Triton hat Pythnet/Hermes zum 30.07. eingestellt. → **Eigenes Hermes ist tot**, es gibt keine
  Datenquelle mehr dafür.
- On-chain lesen braucht keinen Plan (Pyth-FAQ, technisch bestätigt).
- Gesponserte Konten: 64 Feeds von Pyth selbst gepflegt (33 belegt), ~50–55 s Takt. Gold, Devisen,
  US-Aktien werden von einer **unbekannten Einzelwallet** bezahlt; 285 von 513 Konten stehen still.
  → **Cross-Asset-Fragen sind raus.** Saison 1 bleibt Krypto.
- Der gesponserte Feed erfüllt unsere Eindeutigkeitsregel (prev_publish_time < T ≤ publish_time)
  praktisch nie: ~2 % Trefferquote auf Shard 0, ~9 % auf Shard 1.
- Switchboard: Sicherheitsvorfall 29.08. (kompromittierter Orakel-Schlüssel, IOTA auf 10 Mio. $,
  Move-Chains gestoppt, kein Ursachenbericht). Öffentlicher Crossbar ist laut eigener Doku
  "best-effort", 429 unter Last. Kamino nutzt laut eigener Doku Pyth Pro + Chainlink, nicht SB.
  → **Nicht für Saison 1.** Für Saison 2 mit eigenem Crossbar erneut prüfen.
- Verbleibender Weg: gesponserte Konten lesen + **Schnappschuss**. Auswahlregel: **letztes Update
  vor T, gelesen nach T** (nicht "erster gültiger Schreibzugriff, enger Korridor" — bei 5 s Takt
  wären bis zu ~24 Kandidaten zulässig, das trägt den Anspruchssatz nicht). Schwäche ehrlich in die Spec.

### Offen für Montag
1. **Kompatibilitätstest (Vorrang):** Akzeptiert unser Build die seit 26.08. live liegenden Daten?
   Pyth hat den Emitter gewechselt (G9LV2mp9… → 6R92oFT…). Falls nein: stiller Totalausfall.
2. Wochenendauswertung des 48-Stunden-Loggers (Lücken, Alter um 04:00/16:00).
3. Messung, wie oft das Rennen verloren geht (erwartete NO_RESOLVE pro Saison).
4. Alt- oder Neu-Empfänger: Kosten des Wechsels in Stunden.
5. Namen der 33 von Pyth gepflegten Feeds.

## Anspruch neu formuliert (ChatGPT, übernommen)
Drei Versprechen wurden als eines behandelt. Gültig ist nur:
> Die Auswertungsregel steht vor der Vorhersage fest. Weder Betreiber noch Einreicher können
> nachträglich einen anderen zulässigen Datenpunkt oder ein anderes Ergebnis wählen. Welcher
> Datenquelle das System vertraut, ist offengelegt.

"Niemand kann das Ereignis beeinflussen" ist bei Preisen unmöglich und wird nicht behauptet.
Technisch wichtig: **"First submitted" ist kein Beweis für "first published".** Ein signiertes
Update beweist Veröffentlichungsreihenfolge, das Lesen eines Kontos nur Einreichungsreihenfolge.
Im Pitch wird der Satz gesagt, der zum gewählten Weg gehört. Ausführlich in ANSPRUCH-UND-DEMO.md.

## Fragen — Richtung entschieden, Kalender offen
Drei Meinungen (Fable, ChatGPT, Grok) plus eigene Analyse:
- **Vergleich** ("Schlägt SOL heute Bitcoin?") ist der beste Typ: alle drei unabhängig dafür.
  ChatGPT hat nur dort sofort ein Bauchgefühl; Grok belegt, dass relative Stärke der tatsächliche
  tägliche Streit auf X ist. Braucht zwei Feeds pro Runde (Programmänderung) — **für Saison 1
  gestrichen, weil nicht sicher lieferbar.**
- **Bewegung** ("mehr als 2 %, egal wohin") ist der einzige Typ mit belegbarer Fähigkeitskomponente
  (Volatilität ist autokorreliert, Ereignistage). Statistisch am ehrlichsten, emotional flacher.
  **Saison 1 fährt diese eine Familie.** Programm braucht ein Feld für den Fragetyp.
- **Richtung** nur als kleine Kontrollgruppe. **Momentum gestrichen** (= Richtung mit längerem
  Fenster, erzwingt ebenfalls die Basisrate).
- **Ereignistage in den Kalender** (FOMC, CPI, Arbeitsmarkt): Termine stehen fest, dort ist
  Bewegung vorhersagbar. Beste einzelne Idee aus der Runde.
- Schwellen aus echter Schwankungsbreite, Ziel: Basisraten 30–70 %.
- Zwei Messgrößen ab Saisonstart: **Anteil exakter 50er-Antworten** (Fables Test; über 40 % nach
  sieben Tagen = Fragen taugen nicht) und **Streuung der Antworten je Fragetyp**.
- Pro Runde: eigener Brier und Crowd-Brier als nackte Zahlen, ohne Wertung. Kein Tagessieger.

## Demo — neue Pflichtkomponente
"Betrüge deine eigene App live, und sie lässt dich nicht." Korrigierte Sortierung in
ANSPRUCH-UND-DEMO.md: drei echte Ablehnungen, eine Verfügbarkeitsaussage, eine Spielregel.
Im Video nur eine davon (Zahl nachträglich ändern, 20 s), der Rest in Deck und Repo.
Die Tests liegen bereits grün im Repo; sie müssen nur sichtbar gemacht werden.

## Design
- ChatGPTs Verzahnung (Titanium) ist die stärkste Seal-Idee; die Zahnreihen taugen auch als
  Markenelement (Trennlinien, Share-Karte, Store).
- Eigene Fassung mit unseren Tokens, Zeitführung (Anlauf, Unschärfe, Rückfederung, wanderndes Licht)
  und Zeitwechsel liegt als Observed-Seal-v2.html vor.
- Verworfen: Knotennetz/Kugel (KI-Klischee), Grain, gesperrte Mono-Versalien, Mittelpunkt-Ketten.
- Zeitlogik in allen Entwürfen auf 16:00–04:00 UTC korrigieren ("until midnight" ist falsch).

## Priorität ab jetzt
**Die App mit Wallet steht vor allem anderen.** Sie existiert noch nicht (Gerüst mit Mock-Daten,
Spike ohne SGT-Prüfung). Zwei der vier Bewertungskriterien hängen vollständig daran. Alles Weitere
— Orakelfeinschliff, Fragenoptimierung, Design — ist nachrangig, bis ein Juror auf seinem Seeker
siegeln und am nächsten Tag aufdecken kann.

Fortschrittsmaßstab: **Wie viele echte Tageswechsel haben Nutzer erfolgreich durchlaufen?**
Steht heute auf null.
