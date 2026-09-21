# Figma-Brief — Observed

**Zweck:** Das ist die einzige Eingabe für den Entwurf in Figma. Alles hier ist **gemessen**, nicht
gewünscht: jeder Wert, jeder String und jeder Zustand steht mit der Datei, aus der er kommt
(Stand 21.09.2026, Commit `0d3a25e`). Was nicht hier steht, existiert im Repo nicht — dann ist es
unten unter **§4 Lücken** benannt und **wird nicht erfunden**. Neue Texte schreibt der Owner, nicht
der Entwurf.

Zwei Regeln, die überall gelten:

- **Wortregel (Owner, 21.09.2026):** Nutzerseitig heißt es **„call“**, nie „round“. „Round“ bleibt
  nur in Explorer-Links, README und Belegtexten. Quelle: `docs/03-SCREEN-MAP.md:2`.
- **Zeitregel:** Feste Uhrzeiten stehen **UTC und lokal** („Seal by 04:00 UTC · 06:00 where you
  are“). Persönliche Fristen im Widget stehen **nur lokal** („first closes Fri 18:00“), weil dort
  kein Platz für beides ist. Quelle: `docs/03-SCREEN-MAP.md:10` und die Widget-Zeilen in §Widget.

App-Sprache ist Englisch. Dunkel ist der einzige Modus (`app/app.json` → `userInterfaceStyle:
"dark"`), Hochformat (`orientation: "portrait"`). Zielgerät: Solana Seeker, 6,36", ca. 390 dp breit
(`app/src/tokens.ts:58`).

---

## 1. Tokens

Alle Farb-, Schrift- und Abstandswerte liegen in **`app/src/tokens.ts`**. Es gibt im gesamten
`app/src` **keinen einzigen weiteren Hex-Wert und keinen `rgba()`** (geprüft mit grep, Ergebnis
leer) — siehe §5 für die Stellen, wo Farbe oder Schrift trotzdem an der Skala vorbeigeht.

### 1.1 Farbe — `app/src/tokens.ts:11–22`

| Token | Wert | Quelle | Bedeutung laut Code |
|---|---|---|---|
| `color.ground` | `#1C1F1D` | `tokens.ts:14` | „warmes Papier, nachts“ — Hintergrund jeder Fläche |
| `color.ink` | `#E8E0D4` | `tokens.ts:16` | Fließtext und Überschriften |
| `color.meta` | `#8B8680` | `tokens.ts:18` | sekundär / Graphit |
| **`color.pencil`** | **`#5B7CFA`** | `tokens.ts:19` | **die „Du“-Farbe** — siehe 1.2 |
| `color.hairline` | `rgba(232, 224, 212, 0.18)` | `tokens.ts:21` | Ink auf 18 % — jede Linie |

Kommentar im Kopf der Datei: der Design-Bibel-Brief nennt Pencil `#3A6EA5`, **der Owner-Override
`#5B7CFA` gewinnt** (`tokens.ts:5–6`). Im Entwurf gilt `#5B7CFA`.

### 1.2 Die „Du“-Farbe — wo Pencil erlaubt ist

Der Kommentar an `tokens.ts:18` ist die Regel: *„ONLY: the user's own value + cursor, the user's
bucket, the strike over ‚pending‘“*. Gemessene Verwendungen, vollständig:

| Stelle | Datei | Was |
|---|---|---|
| eigener Wert, groß | `components/SideConfidence.tsx:47,49` | die Prozentzahl und das `%` |
| aktive Seite | `components/SideConfidence.tsx:80,87` | Rahmen und Text von `Up`/`Down`, wenn gewählt |
| Cursor auf der Skala | `components/Scale.tsx:161` | 2 dp breit, 28 + 6 dp hoch |
| eigener Balken | `components/Scale.tsx:222` | der eigene Bucket in der Verteilung, alle anderen `meta` |
| Strich-Moment | `components/StrikeMoment.tsx:25,38` | „observed“ und die Durchstreichung von „pending“ |
| Freigabe-Schalter an | `components/SentenceField.tsx:56` | Track des Switch |
| Zeichenzähler zu lang | `components/SentenceField.tsx:47` | nur im Überlauf |
| Backup-Warnung | `components/Backup.tsx:89,95` | Unterstrich und Text der Phrasen-Warnung |
| Fehlerzeile Today | `screens/Today.tsx:151` | Netzwerk-/Wallet-Fehler |
| Diagnose-Log | `screens/Diagnostics.tsx:170` | nur im Diagnose-Build |

**Nicht** Pencil: der Primärknopf. `components/PrimaryButton.tsx:6–7` sagt es ausdrücklich —
Ink auf Ground mit Haarlinien-Rand.

### 1.3 Schrift — `app/src/tokens.ts:24–45`, geladen in `app/src/fonts.ts`

**Sieben** statische TTF-Schnitte (seit 22.09.2026 mit `Literata_400Regular_Italic`, siehe unten), keine Variable Fonts (`fonts.ts:4–15`, mit Begründung):
`Literata_400Regular`, `Literata_600SemiBold`, `IBMPlexSans_400Regular`, `IBMPlexSans_500Medium`,
`IBMPlexMono_400Regular`, `IBMPlexMono_500Medium`, `Literata_400Regular_Italic`.

Der Kursivschnitt kam am 22.09.2026 dazu: 03 §3 verlangt den Satz von gestern in Literata kursiv,
gezeichnet wurde bis dahin Plex Sans mit künstlicher Schräge. Der Schnitt lag im bereits
installierten Paket — kein neues Paket.

Rollen (`tokens.ts:24–45`): Serif = Frage und Lesungssatz · Sans = Bedienelemente und Labels ·
Mono = Ticks, Zeiten, Preise, Feed-IDs, Signaturen · **`font.figures` = Plex Sans**, nicht Mono:
Plex Monos Null trägt einen Mittelpunkt, den der Brief verbietet, und die Familie hat keinen
Schnitt ohne ihn; Plex Sans hat tabulare Ziffern (`tokens.ts:34–44`).

### 1.4 Typoskala — `app/src/tokens.ts:59–75`

| Token | Familie | Größe / Zeilenhöhe | Sonstiges |
|---|---|---|---|
| `type.kicker` | Sans 400 | 12 / 16 | `letterSpacing 1.2`, im Code zusätzlich `uppercase` (`Type.tsx:8`) |
| `type.label` | Sans 400 | 13 / 18 | |
| `type.body` | Sans 400 | 15 / 22 | |
| `type.question` | Literata 400 | 24 / 32 | |
| `type.questionSmall` | Literata 400 | 17 / 24 | |
| `type.reading` | Literata 600 | 34 / 42 | die Ergebniszeile |
| `type.sentence` | **Literata 400 kursiv** | 17 / 26 | der eigene Satz von gestern (seit 22.09.) |
| `type.hero` | Plex Sans 500 | 64 / 70 | `letterSpacing −1`, die eigene Prozentzahl |
| `type.numberLarge` | Plex Sans 500 | 40 / 46 | |
| `type.figures` | Plex Sans 400 | 13 / 18 | |
| `type.figuresSmall` | Plex Sans 400 | 11 / 16 | |
| `type.mono` | Plex Mono 400 | 13 / 18 | |
| `type.monoSmall` | Plex Mono 400 | 11 / 16 | |

Fertige Textbausteine in `app/src/components/Type.tsx`: `Kicker` (meta, uppercase), `Label`
(meta), `Body` (ink), `Question`, `QuestionSmall`, `Reading`, `Mono` (ink), `Figures` (ink),
`FiguresMeta` (meta, 11), `MonoMeta` (meta, 11), `Block` (nur `marginTop`, Standard 24).

### 1.5 Raster und Maße

| Token / Konstante | Wert | Quelle |
|---|---|---|
| `space` | 4 · 8 · 12 · 16 · 24 · 32 · 48 (xs…xxxl) | `tokens.ts:48–56` |
| `HIT_SLOP_MIN` | 48 | `tokens.ts:78` |
| `radius` | **0 — „Never anything but 0.“** | `tokens.ts:81` |
| Screen-Rand | 16 links/rechts, 16 oben, 48 unten | `components/Screen.tsx` |
| Header-Höhe | 56 | `components/Header.tsx` |
| Tab-Höhe | 56, Abstand 24, Oberkante Haarlinie | `components/TabBar.tsx` |
| Primärknopf | `minHeight 56`, Rand 1 dp, `alignSelf: flex-start`, deaktiviert `opacity 0.5` | `components/PrimaryButton.tsx` |
| Haarlinie | 1 dp, `marginVertical 16`, **max. zwei pro Screen** | `components/Hairline.tsx` |
| Skala Eingabe | Spur 56 hoch, Rand 8, Ticks 10 dp (bei 0/25/50/75/100) bzw. 5 dp, Cursor 2 × 34 | `components/Scale.tsx:23–27,146–163` |
| Skala Verteilung | 96 hoch, Balken 6 dp breit, 21 Positionen, Mittelwert als Linie | `components/Scale.tsx:24,208–226` |
| Schritt-Knöpfe `−5`/`+5` | 64 × 48, Rand 1 dp | `components/Scale.tsx:64–71` |
| Satzfeld | `minHeight 44`, Unterstrich 1 dp | `components/SentenceField.tsx:42` |

Keine Radien, keine Schatten, keine Verläufe, keine Textur (`tokens.ts:8`). Keine Karten, eine
Spalte, linksbündig (`Screen.tsx`). Ein Banner ist zwei Linien und eine Zeile Plex Sans
(`SampleBanner.tsx`).

---

## 2. Copy — wörtlich

Quelle ist `docs/03-SCREEN-MAP.md` v2 (§11 freigegeben am 21.09., §1–§10 am selben Tag auf die
geltenden Regeln gezogen). **§12 ist Archiv und wird ignoriert.** Strings, die bereits im Code
liegen, stehen in `app/src/copy.ts` — dort sind sie die verbindliche Schreibweise.

Platzhalter sind markiert: `{n}` Anzahl, `{x}` Prozentwert mit einer Nachkommastelle,
`{weekday}` Wochentag.

### 2.1 Eingabe (§11.1, `copy.ts:6–17`)

- Seiten: `Up` · `Down`
- keine Seite gewählt: `Pick a side first.` · Seite gewählt, Regler unberührt: `How sure?`
  (freigegeben 22.09.2026)
- Wallet-Blatt offen: `Waiting for your wallet.`
- Reglerworte, symmetrisch:
  - 50: `Could go either way`
  - 55–65: `Leaning Up` / `Leaning Down`
  - 70–85: `Fairly sure: Up` / `Fairly sure: Down`
  - 90–100: `Very sure: Up` / `Very sure: Down`

### 2.2 Satzfeld (§11.2, `copy.ts:20–29`)

- Überschrift: `What tipped you toward Up?` / `What tipped you toward Down?`
- bei 50: `What makes this hard to call?`
- Hinweis / Platzhalter: `One sentence for tomorrow. Optional.`
- Schalter (Standard **aus**): `Share it after the reveal`
- Unterzeile: `Private until you reveal. If shared, it's public and permanent on Solana.`
- Zeichenzähler (erst ab 120 von 140 Bytes sichtbar): `{n} / 140`

### 2.3 Today (§2)

- Fensterzeile: `Seal by 04:00 UTC · 06:00 where you are`
- ab 03:50 UTC: `Network is busy — seal now`
- Kicker: `CALL 11 · 6 OCT`
- Eligibility: `Genesis · verified`
- Frage (Standard, Richtungsfrage): `Will SOL be higher at 16:00 than at 04:02 UTC?`
- Kontextzeile nur an Ereignistagen, klein, z. B.: `US jobs report at 12:30 UTC.`
- Primär: `Seal today` · Zeile darüber nur wenn nötig: `Yesterday reveals in this same signature`
- Kosten: `No app fees. Network ≈ 0.0001 SOL per day · ≈ 0.002 SOL deposit, refunded when the call
  closes.`
- versiegelt: `Sealed · 21:12 UTC` · `Hidden until you reveal.`
- pending: `reference 04:02 $150.00` · `pending · outcome at 16:00 UTC`
- Fenster zu: `Window closed · next question 16:00 UTC` (`copy.ts:68`)
- offene Aufdeckungen: `{n} calls still open to reveal` (Singular `1 call …`, `copy.ts:69`)
- kein Token: `No Genesis Token found in this wallet.` (`copy.ts:67`)
- zu wenig SOL: `Not enough SOL to seal · you need about {x} SOL` + `Your answer is saved on this
  phone. Add SOL and seal before 04:00 UTC.` (`copy.ts:63–66`)
- keine Runde: `No question today. Open calls can still be revealed.`

### 2.4 Result (§3 und §11.3/§11.4, `copy.ts:31–52`)

Reihenfolge von oben, so festgelegt:

1. Kicker `READING · 6 OCT`
2. Frage klein, darunter ggf. die Kontextzeile
3. Strich-Moment: `pending` durchgestrichen, `observed` darüber
4. `Yesterday you wrote:` + eigener Satz, Literata kursiv, ohne Anführungszeichen — sonst
   `No note yesterday.`
5. `You sealed: Up, 80% sure.` — mit der **genauen** Zahl; bei 50: `You sealed: 50/50.`
6. Ergebnis, eine Zeile:
   - `You called the side.`
   - `It went the other way.`
   - `Too close to call.` — Unterzeile: `SOL moved {x}% — inside the measurement band. A different
     reading could have flipped it, so it doesn't count for or against your side record.`
   - `You didn't pick a side.`
   - Bei knapp **und** ohne Seite gewinnt `Too close to call.`, `You didn't pick a side.` steht als
     Unterzeile darunter (`core/day.ts:126`).
7. Serie: `{n} evenings in a row.` — bei 1: `First evening.`
8. Verteilung, darunter `63 revealed · Crowd 64 · You 80`
9. `What others wrote` — leer: `Nobody shared a sentence this time.`
10. `One call added. No verdict on your skill.`
11. Evidenz klein: Feed, Referenz (04:02), Ergebnis (16:00), Explorer-Links auf die **Transaktionen**

Teilstand und NO_RESOLVE (§3): `63 of 71 revealed · open until Fri 18:00` ·
`No valid reading in the window. Nobody scored.` · `Reference 04:02–04:03 UTC · missing` ·
`Outcome 16:00–16:01 UTC · missing`.

Der Brier-Wert steht hier **nicht**.

### 2.5 Record (§4 und §11.5, `copy.ts:54–60`)

- Seiten-Record groß: `4 of 6 calls`
- Saisonwert: `0.313 · 9 scored`
- Der Satz: `Your side record counts calls. Your season score measures how sure you were.`
- Zähler: `Commits · Reveals · Missing` → `9 · 8 · 1`, Fußnote `missing counts as a full miss`
- Baselines: `Always 50%: 0.250 · Crowd: 0.211`
- gesperrt: `Unlocks after 20 revealed calls · you're at {n}` — **Schwelle 20** (`copy.ts:58–59`)
- Liste: Datum, Frage, `Up, 80%`, Ausgang, Status (`called / missed / too close / no side /
  missing / no resolve / open`)
- Demo: `Show sample record (36 calls)` + Banner `Sample data · not your phone`

### 2.6 Settings (§7 und §11.8, `copy.ts:78–93`)

- `Genesis · verified`, Mint, Autoritäten (calendar, pause, upgrade) mit Adressen
- dieselbe Kostenzeile wie Today
- `The answer belongs to the wallet that sealed it.`
- `Observed does not charge you.`
- Push-Zeiten in Ortszeit
- Backup-Code: Zeile `Backup code` · Unterzeile `Needed to reveal open calls after reinstalling.` ·
  Knopf `Copy backup code` · danach `Copied. Keep it private — with it, someone could see your
  sealed answers before you reveal them.`
- Wiederherstellen: Titel `Restore your open calls` · `Paste the backup code you copied from
  Observed.` · Warnung `This is not your wallet's recovery phrase. Never paste that here — or
  anywhere.` · Knopf `Restore` · `Skip — open calls will count as misses` · Fehler `This code
  doesn't match your sealed calls.`
- **Das Wort ist „backup code“ — nie „key“, nie „recovery“** (§11.8).

### 2.7 Onboarding (§1, drei Schritte)

1. `How sure is sure?`
2. `One Seed Vault approval a day. Seal today, reveal yesterday.`
3. `Keep this installation. Reinstalling can forfeit a pending answer. This is not your seed
   phrase.` + `Your answers and your device token are public on-chain once revealed.` +
   `You can copy a backup code in Settings.` (`copy.ts:92`)

Erststart außerhalb des Fensters: **Vorschau**, dauerhaft gekennzeichnet `Preview · simulated
call`, danach die nächste Öffnung in Ortszeit und `Remind me when the window opens`.
(Owner, 22.09.2026: vorher „simulated round“ — die Wortregel gilt jetzt ausnahmslos.)

### 2.8 Push (§8, `core/reminders.ts:26–34`)

- `Yesterday's call is in. See what you wrote.` (mit eigenem Satz)
- `Yesterday's call is in.` (ohne)
- `One hour to seal today's answer.`
- `Yesterday is in. 63 revealed.`
- `Last evening to reveal {weekday}'s call. After that it counts as a miss.`
- NO_RESOLVE: `No valid reading yesterday. Nobody scored.`

### 2.9 Widget (§Widget, 4×2, Android)

Je Zustand **eine** Information und **eine** Aktion. Wortmarke klein oben links, eine Haarlinie,
Aktion als Textlink mit Pfeil — kein Pill-Button, die Systemrundung des Widgets ist die einzige
Rundung.

| Zustand | Kicker | Zeile | Link |
|---|---|---|---|
| Open | `Today / open` | Frage in Serif (max. 2 Zeilen) + `Seal by 04:00 UTC · 06:00 where you are`, ab 03:50 `Seal by 04:00 UTC · closing soon` | `Pick a side →` |
| Sealed | `Sealed` | `pending · outcome at 16:00 UTC · 18:00 where you are` — **kein Wert auf dem Home-Screen** | `View seal →` |
| Yesterday in | `Yesterday` | Hero: `You called the side.` / `It went the other way.` / `Too close to call.`, darunter klein `Crowd 64 · You 80` **nur wenn in Settings erlaubt (Standard aus)** | `See reading →` |
| Offen | `Open` | `2 calls waiting · first closes Fri 18:00` (nur Ortszeit) | `Reveal →` |
| NO_RESOLVE | `Yesterday` | `No valid reading. Nobody scored.` | `See why →` |
| Kein Wallet / kein SGT | — | — | `Connect to seal today →` |

Technisch: Android-Widgets sind RemoteViews, **keine eigenen Schriften** — Serif entweder
System-Serif (Noto Serif) oder die Hero-Zeile als gerenderte Bitmap (§Widget, Entscheidung offen).

### 2.10 Beispielzahlen — überall identisch (§Beispielzahlen)

Call 11 · Di 6. Okt 2026 · SOL/USD · Referenz 04:02 **$150.00** · Ausgang 16:00 **$151.95** →
höher → Yes (+130 bps) · eigene Antwort `You sealed: Up, 80% sure.` → Brier 0.040 ·
`You called the side.` · `3 evenings in a row.` · Menge 64 % Ja · `63 revealed of 71` ·
Record `4 of 6 calls` · `0.313 · 9 scored` · Zähler `9 · 8 · 1`.

---

## 3. Zustände, die der Code wirklich hat

Nur gebaute Zustände, je eine Zeile mit dem Auslöser. Was in §2 steht, aber hier fehlt, ist nicht
gebaut und steht in §4.

### 3.1 Today — `core/day.ts:14–30`, gezeichnet in `screens/Today.tsx`

| Zustand | Auslöser (gemessen) | Was steht da |
|---|---|---|
| `open` | `now` liegt in `[commitOpen, commitClose)` und kein bestätigter Record | Kicker `CALL {n}`, Frage, Kontextzeile falls vorhanden, Seitenwahl, Regler, Satzfeld, `Seal today`, Kostenzeile |
| `open` + kein Token | `hasGenesisToken === false` | statt Knopf: `No Genesis Token found in this wallet.` |
| `open` + zu wenig SOL | `checkFunding` schlägt an, vor dem Wallet-Sheet | Titel + `Your answer is saved on this phone. …` |
| `open` + offene Aufdeckungen | `openReveals > 0` | Zeile `{n} calls still open to reveal — they go out with this signature` |
| `open`, Seite noch nicht berührt | `side === null` | Knopf deaktiviert, darunter `Pick a side first.` |
| `open`, läuft | Seal ausgelöst | Knopfbeschriftung `Sealing…` |
| `sealed` | Record-Status `confirmed` | Frage bleibt, `Sealed`, `Hidden until you reveal.` |
| `closed` | kein Fenster offen, aber ein späteres existiert | `Window closed · next question 16:00 UTC` |
| `no-call` | kein Fenster und keins mehr in der Zukunft | `No question today. Open calls can still be revealed.` |
| Fehlerzeile | Netz oder Wallet | eine Zeile Mono in Pencil, bei Netzfehlern `No connection. Your answer is saved on this phone.` (`useDay.ts:125`) |

Die Aufdeckung hat in `closed`, `no-call` und `sealed` einen eigenen Block mit `Reveal` bzw.
`Revealing…` (`Today.tsx:165–187`).

### 3.2 Result — `core/day.ts:75–133`, gezeichnet in `screens/Result.tsx`

| Zustand | Auslöser | Zeile |
|---|---|---|
| nichts | `view === null` | `Nothing revealed yet.` |
| getroffen | `outcomeFor` → `called` | `You called the side.` |
| verfehlt | → `missed-side` | `It went the other way.` |
| knapp | Betrag von `outcome_margin_bps` ≤ `band_bps` | `Too close to call.` + Detailzeile mit `{x}` |
| keine Seite | `p_bps === 5000` | `You didn't pick a side.` |
| knapp **und** ohne Seite | beides | `Too close to call.` als Hero, `You didn't pick a side.` darunter |
| mit Satz / ohne Satz | Record trägt `sentence` | `Yesterday you wrote:` … / `No note yesterday.` |
| Verteilung | `crowdMean` ≠ null | 21 Balken, eigener in Pencil, Zeile `{n} revealed · Crowd {x} · You {y}` |
| Sätze der anderen | immer | Überschrift, sonst `Nobody shared a sentence this time.` |

### 3.3 Versiegeln — `core/sealing.ts`, Status in `core/records.ts:6–20`

Sechs Zustände, jeder mit seinem Auslöser: `saved` (aufgeschrieben, Wallet **noch nicht** gefragt)
· `sent` (Signatur existiert) · `confirmed` (Entry liegt mit unserem Commitment auf der Kette) ·
`unknown` (gesendet, keine Antwort — nie erneut senden, erst die Kette fragen) · `failed` (Kette
sagt nein, Fenster noch offen) · `missed` (Fenster zu ohne Entry, oder ein fremder Entry, den
dieses Telefon nicht öffnen kann).

Die Regel dahinter, die der Entwurf nicht brechen darf: **der Record wird geschrieben, bevor die
Wallet gefragt wird** (`sealing.ts:68–71`). Es gibt genau **eine Genehmigung am Tag**: aufdecken
und versiegeln gehen in derselben Signatur (`Today.tsx:22`).

### 3.4 Backup — `components/Backup.tsx`

| Zustand | Auslöser | Was steht da |
|---|---|---|
| Ruhe (Settings) | Standard | `Backup code` + Unterzeile + `Copy backup code` |
| kopiert | Knopf gedrückt | Code sichtbar, darunter `Copied. Keep it private — …` |
| Einfügefeld | immer | Platzhalter `64 characters` |
| Wallet-Phrase erkannt | 12 oder 24 Wörter, **während des Tippens** | Unterstrich in Pencil, `This is not your wallet's recovery phrase. …`, `Restore` deaktiviert |
| falscher Code | Import schlägt fehl | `This code doesn't match your sealed calls.` |
| wiederhergestellt | Import ok | `{n} restored, {m} could not be opened.` |
| Restore-Modus | nach Neuinstallation | Titel, Text, Feld, `Skip — open calls will count as misses` |

### 3.5 Erinnerungen — `core/reminders.ts`

Drei geplante Sorten, nie weiter als sieben Tage voraus: Ausgang um 16:00 UTC · eine Stunde vor
Fensterschluss · vier Stunden vor Ablauf einer offenen Aufdeckung. **Lokal, ungenau geplant, die
Berechtigung wird nur aus einem Tipp heraus erfragt** (`reminders.ts:3–9`).

### 3.6 Record und Settings

Beide Screens zeichnen **noch aus `app/src/mock.ts`**, nicht aus der Kette und nicht aus
`copy.ts` (`screens/Record.tsx:8–17`, `screens/Settings.tsx:16–18`). Ihre sichtbaren Texte sind
die alte Fassung — siehe §4.

### 3.7 Navigation

Kopf: Wortmarke links, `Settings` rechts (`Header.tsx`). Drei Bereiche unten: **Today · Result ·
Record**, nie ein vierter (`TabBar.tsx:7–8`). Settings ist kein Tab, sondern ein Umschalter im
Kopf (`App.tsx:72,76`). Der Diagnose-Build zeigt **nur** den Diagnose-Screen (`App.tsx:49`).

---

## 4. Lücken — kein Text, kein Screen, nichts erfinden

**GAP — im Dokument freigegeben, im Code nicht vorhanden:**

1. **Onboarding** (§1, drei Schritte): kein Screen, keine Komponente. Nur der eine Satz
   `You can copy a backup code in Settings.` liegt in `copy.ts:92`.
2. **Vorschau / `Preview · simulated call`** (§1, D1): nicht gebaut. (Der String hieß bis zum 22.09.2026 „simulated round“; der Owner hat ihn auf die Wortregel gezogen.)
3. **Widget** (§Widget, sechs Zustände): kein Android-Widget im Repo.
4. **Today-Zustand `pending`** (§2, nach 04:00, vor 16:00, mit `reference 04:02 $150.00`):
   `TodayView` kennt nur `open`, `sealed`, `closed`, `no-call` (`core/day.ts:14–30`).
5. **Fensterzeile und Eile** (`Seal by 04:00 UTC · 06:00 where you are`, `Network is busy — seal
   now`): im Dokument, nicht in `copy.ts`, nicht auf dem Screen.
6. **Kicker mit Datum** (`CALL 11 · 6 OCT`, `READING · 6 OCT`): der Code zeichnet `CALL {n}` und
   `READING` ohne Datum (`Today.tsx:69,90`, `Result.tsx:41`).
7. **Genesis-Zeile auf Today** (`Genesis · verified`): nur in `mock.ts`.
8. **Evidenz-Block** (§3 Punkt 10, §5): `components/EvidenceRef.tsx` existiert, wird von **keinem**
   Screen verwendet.
9. **Teilstand und NO_RESOLVE im Result** (`63 of 71 revealed · open until Fri 18:00`, `No valid
   reading in the window. Nobody scored.`, die beiden `missing`-Fenster): `ResultView` hat dafür
   kein Feld.
10. **Call detail** (§5): kein Screen.
11. **Publication** (§6): bewusst ungebaut, offene Owner-Frage.
12. **Share-Karte** (§10): am 21.09. gestrichen, wird in Saison 1 nicht gebaut.
13. **Erinnerungen in der Oberfläche**: `reminders.ts` und `ExpoNotifier` sind fertig und getestet,
    aber **von keinem Screen aufgerufen** (grep über alle `.tsx`: keine Treffer). `Remind me when
    the window opens` hat also keinen Knopf.
14. **Erinnerungsschätzung vor dem Aufdecken (E12)**: ausdrücklich gesperrt (§11.7).

**GAP — Zustand im Code, kein freigegebener Text:**

15. `— they go out with this signature`,
    `Nothing revealed yet.`, `{n} restored, {m} could not be opened.`, Platzhalter
    `64 characters` — im Screen entstanden, **keiner steht in 03-SCREEN-MAP**.
    (`Sealing…`, `Revealing…` und die doppelte Zeile unter dem Knopf sind am 22.09.2026 durch
    die freigegebenen Texte ersetzt.)
16. Die Seal-Status `sent`, `unknown`, `failed` (§3.3) haben **keinen** Text: der Spieler sieht
    nur die rohe Fehlerzeile. Was „unbekannt“ dem Nutzer sagt, ist offen.
17. Netzfehler-Zeile `No connection. Your answer is saved on this phone.` (`useDay.ts:125`) —
    ebenfalls nicht im Dokument.

**Widerspruch — alte Fassung steht noch im Code:**

18. `screens/Record.tsx` zeigt als Hero den **Brier** mit `Cumulative Brier · includes missing`
    (`mock.ts:147–148`); freigegeben ist der **Seiten-Record** `4 of 6 calls` mit dem Satz aus
    §11.5. Der Satz selbst kommt auf dem Screen nicht vor.
19. `mock.ts:156` sagt `Unlocks after 21 revealed rounds · you're at 8` — freigegeben sind **20**
    und das Wort **calls** (`copy.ts:58`). Ebenso `Show sample record (36 rounds)` (`mock.ts:157`)
    und der Kicker `Rounds` (`Record.tsx:114`): Wortregel verletzt.
20. `mock.ts` rechnet ein Versäumnis mit **0.250**; die geltende Regel ist ein **voller
    Fehlschlag (1.000)**, und genau damit ist die Beispielzahl 0.313 gerechnet.
21. `mock.ts` trägt die alten Zeiten (12:00/00:00) und die alte Bewegungsfrage; §2 gilt mit
    16:00 / 04:02 / 16:00 und der Richtungsfrage.
22. `settings.backup` = `Export of the reveal backup · not in this version` (`mock.ts`) steht auf
    demselben Screen wie der echte, freigegebene Backup-Block — zwei Aussagen zur selben Sache.
23. Settings zeigt unter einer Haarlinie den **Mock-Schalter „Mock state · development only“**
    (`Settings.tsx:107–151`). Kein Produkttext, gehört nicht in den Entwurf.

---

## 5. Launcher-Icon und alles, was an der Skala vorbeigeht

### 5.1 Icon, Splash, Adaptive Icon — `app/app.json`

| Feld | Wert |
|---|---|
| `icon` | `./assets/icon.png` |
| `splash.image` | `./assets/splash-icon.png`, `resizeMode: "contain"`, `backgroundColor: "#1C1F1D"` |
| `android.adaptiveIcon.foregroundImage` | `./assets/adaptive-icon.png` |
| `android.adaptiveIcon.backgroundColor` | `#1C1F1D` |
| `backgroundColor` (App) | `#1C1F1D` |
| `web.favicon` | `./assets/favicon.png` |
| weiter | `userInterfaceStyle: "dark"`, `orientation: "portrait"`, `newArchEnabled: true`, `edgeToEdgeEnabled: true`, Paket `day.observed.app` |

Gemessene Dateien in `app/assets/`:

| Datei | Größe | Format | Dominante Farbe |
|---|---|---|---|
| `icon.png` | 1024 × 1024 | PNG, Palette | `#F5F5F7` auf 87 % der Fläche, dazu `#DDDDE1` / `#CFCFD5` |
| `adaptive-icon.png` | 1024 × 1024 | PNG, Palette mit Transparenz | 89 % transparent, Motiv in `#DDDDE1` / `#CFCFD5` |
| `splash-icon.png` | 1024 × 1024 | **byte-identisch mit `adaptive-icon.png`** (gleicher SHA-256) | |
| `favicon.png` | 48 × 48 | PNG mit Alpha | |

**Befund:** Das sind die **Vorlagen-Assets von Expo**, grau auf Weiß. Kein Observed-Motiv, keine
Token-Farbe — nur die Hintergründe wurden auf `#1C1F1D` gesetzt. Ein Icon zu entwerfen ist damit
offen; nichts im Repo gibt vor, wie es aussehen soll. `adaptive-icon.png` hat außerdem keine
eigene Sicherheitszone, weil es dasselbe Bild wie der Splash ist — Android beschneidet davon je
nach Maske bis zu 33 %.

### 5.2 Farbe hart verdrahtet

In `app/src` **keine einzige Stelle**: kein Hex, kein `rgba()` außerhalb von `tokens.ts` (grep über
alle `.ts`/`.tsx`, Ergebnis leer). Außerhalb der App-Quelle dreimal derselbe Wert:

- `app/app.json` → `backgroundColor: "#1C1F1D"`
- `app/app.json` → `splash.backgroundColor: "#1C1F1D"`
- `app/app.json` → `android.adaptiveIcon.backgroundColor: "#1C1F1D"`

Alle drei entsprechen `color.ground`, sind aber Kopien: Eine Änderung am Token zieht hier nicht
nach. (Eine Konfigurationsdatei kann das Token technisch nicht importieren — der Punkt ist, dass es
drei Stellen zum Nachziehen gibt.)

### 5.3 Schrift hart verdrahtet

Die **Familie** kommt überall aus `font`, die **Größe** aber sechsmal nicht aus `type`:

| Stelle | Was | Nicht in der Skala |
|---|---|---|
| `components/Header.tsx:28–34` | Wortmarke: `font.serif`, **17**, `letterSpacing 2`, uppercase | eigener Schnitt (`questionSmall` ist 17/24 ohne Sperrung) |
| `components/Header.tsx:44–48` | `Settings`: `font.sans`, **13** | entspricht `type.label`, inline gesetzt |
| `components/TabBar.tsx:40–44` | Tab-Beschriftung: `font.sans`, **14** | **14 existiert in der Skala nicht** |
| `components/SampleBanner.tsx:18–24` | Banner: `font.sans`, **12**, `letterSpacing 1`, uppercase | `type.kicker` wäre 12/16 mit `letterSpacing 1.2` |
| `components/StrikeMoment.tsx:22–27` | `observed`: `font.sansMedium`, **15 / 20** | `type.body` ist 15/**22** |
| `components/StrikeMoment.tsx:31–40` | `pending`: `font.sans`, **15 / 20** | dito |
| `components/PrimaryButton.tsx:36` | mischt `type.body` mit `type.label.fontFamily` | kein eigener Button-Token |

Für den Entwurf heißt das: Wortmarke, Tab-Leiste, Banner und Strich-Moment brauchen **eigene
Stile** — sie sind heute Ausnahmen, und es ist nicht entschieden, ob sie es bleiben sollen.
