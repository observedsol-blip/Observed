# OBSERVED — Screen-Map v2 (Sweep 21.09.2026)

**Wortregel (Owner, 21.09.2026):** Nutzerseitig heißt es **„call“**, nicht „round“ — in Push,
Widget und App. „Round“ bleibt in Explorer-Links, README und Belegtexten, also überall dort, wo
es die Kette benennt.

§1–§10 sind am 21.09.2026 auf die geltenden Regeln gezogen: Siegeln 16:00–04:00 UTC, Referenz
04:02, Ausgang 16:00, Aufdecken 72 h, Richtungsfrage als Standard, Bewegung an fünf
Ereignistagen. Die freigegebenen Texte stehen in §11, die ersetzten Fassungen wörtlich in §12.

Gilt vorbehaltlich Spike 3 (eine Freigabe für `reveal + commit`). Copy ist Englisch; Zeiten immer UTC **und** lokal. Struktur folgt dem ChatGPT-Handoff, Regeln aus dem Grok-Review sind Pflicht.

## Navigation
Header: Wortmarke links, Settings rechts. Drei Bereiche: **Today · Result · Record**. Kein vierter Tab.

## 1. Onboarding (max. 3 Schritte, dann Frage)
1. „How sure is sure?“ — ein Satz, was Observed misst.
2. „One Seed Vault approval a day. Seal today, reveal yesterday.“
3. „Keep this installation. Reinstalling can forfeit a pending answer. This is not your seed phrase.“ + ein Satz: „Your answers and your device token are public on-chain once revealed.“
Wallet erst beim ersten Seal.

**Erststart außerhalb des Fensters (zwischen 04:00 und 16:00 UTC):** kein „Window closed“.
Stattdessen die **Vorschau** (D1/E4, bis 02.10.): eine simulierte Runde in etwa 20 Sekunden, mit
echtem Regler, ohne Wallet, dauerhaft gekennzeichnet `Preview · simulated call`
(Owner, 22.09.2026: vorher „simulated round“ — die Wortregel gilt ohne Ausnahme). Danach die
echte nächste Öffnung in Ortszeit und `Remind me when the window opens`.

## 2. Today
Eingabe und Texte: **§11**. Zeiten: Siegeln 16:00–04:00 UTC, Referenz 04:02, Ausgang 16:00,
Aufdecken 72 h ab dem Ausgang.

Zustände:
- **Offen, unbeantwortet:** Fensterzeile „Seal by 04:00 UTC · 06:00 where you are“ (ab 03:50 UTC:
  „Network is busy — seal now“); „CALL 11 · 6 OCT“; „Genesis · verified“; Frage (Literata),
  Standard die Richtungsfrage: „Will SOL be higher at 16:00 than at 04:02 UTC?“; an den fünf
  Ereignistagen stattdessen die Bewegungsfrage plus **Kontextzeile** darunter, klein
  (z. B. „US jobs report at 12:30 UTC.“); Seitenwahl `Up`/`Down`, darunter der Sicherheitsregler
  mit **11 Positionen (50…100 in Fünferschritten, Beschriftung 50 · 75 · 100)** und den
  Reglerworten aus §11.1; darunter das Satzfeld (§11.2); ein Primary
  „Seal today“ (Zeile darüber nur wenn nötig: „Yesterday reveals in this same signature“);
  Kostenzeile (identisch mit Spec §11): „No app fees. Network ≈ 0.0001 SOL per day · ≈ 0.002 SOL
  deposit, refunded when the call closes.“
- **Versiegelt (Abend/Nacht):** Frage bleibt, Status „Sealed · 21:12 UTC“, kein zweites Hero.
  Hinweis „Hidden until you reveal.“
- **Pending (nach 04:00, vor 16:00):** kein leeres Plakat. Frage klein, jetzt mit der Referenz
  („reference 04:02 $150.00“), Status graphit „pending · outcome at 16:00 UTC“, nächstes Fenster
  mit lokaler Zeit. Die eigene Zahl wird nicht wiederholt.
- **Verpasst (nicht versiegelt, Fenster zu):** „Window closed · next question 16:00 UTC“. Kein
  Vorwurf, kein Streak. **Offene Aufdeckungen aus den letzten drei Tagen bleiben trotzdem
  möglich** und stehen hier als eigener Punkt („2 calls still open to reveal“).
- **Nicht eligible:** „No Genesis Token found in this wallet.“ + Erklärung, was zählt (das Gerät),
  Link zu Settings.
- **Zu wenig SOL (vor dem Wallet-Sheet geprüft):** „Not enough SOL to seal · you need about
  0.003 SOL“ + „Your answer is saved on this phone. Add SOL and seal before 04:00 UTC.“
- **Keine Runde heute** (niemand hat sie angelegt — `create_round` ist permissionless):
  „No question today. Open calls can still be revealed.“ — Reveal-only-Pfad, kein leerer Fehler.

## 3. Result (Kern)
Kicker: „READING · 6 OCT“ (nie „Yesterday / 6 Oct“). Reihenfolge von oben — **Punkt 3–7 sind die
Fassung vom 21.09. (E11/E13), sie ersetzen die alte Brier-Zeile**:
1. Frage klein; an Ereignistagen die Kontextzeile darunter.
2. Strich-Moment: „pending“ durchgestrichen, „observed“ in Pencil-Blau darüber (einzige Animation
   der App).
3. `Yesterday you wrote:` + der eigene Satz in Literata, kursiv, ohne Anführungszeichen — nur
   wenn einer existiert. Sonst `No note yesterday.` (grau, klein, keine Aufforderung).
4. `You sealed: Up, 80% sure.` — die versiegelte Antwort wörtlich zurück, mit der **genauen Zahl**
   (bei 50: `You sealed: 50/50.`). Nicht das Bandwort: die Erinnerungsprobe (E12) braucht die Zahl.
5. Das Ergebnis, eine Zeile aus §11.3: `You called the side.` / `It went the other way.` /
   `Too close to call.` / `You didn't pick a side.` Bei **knapp und keine Seite gewinnt
   „Too close to call.“**, `You didn't pick a side.` steht als Unterzeile darunter.
6. Serie: `3 evenings in a row.` (bei 1: `First evening.`)
7. Maßstab wird Verteilung: **21 Positionen, 0…100** — nicht dieselbe Geometrie wie die Eingabe
   (die ist 50…100, Owner 22.09.2026), weil die Wahrscheinlichkeiten der Menge wirklich den
   ganzen Bereich abdecken. Menge in Graphit, dein Bucket in Blau, Mean
   als Linie. „63 revealed“. Darunter die Faktenzeile „Crowd 64 · You 80“ (kein „closer“).
8. `What others wrote` — die geteilten Sätze der anderen (§11.4), sonst
   `Nobody shared a sentence this time.`
9. „One call added. No verdict on your skill.“
10. Evidence-Referenz klein: Feed, Referenz (04:02) und Ergebnis (16:00) mit Zeitstempeln,
    Explorer-Links auf die **Transaktionen**, nicht auf die Konten.

Der Brier-Wert steht hier **nicht**. Er lebt im Record (§4).

Zustände: **Resolved** (ab ≈ 16:05 mit Teilmenge „63 of 71 revealed · open until Fri 18:00“ (Ortszeit, wie im Widget),
danach final) · **NO_RESOLVE** (Programmstatus `Cancelled`: „No valid reading in the window. Nobody
scored.“; das Evidenz-Fenster nennt, welches Update fehlte: „Reference 04:02–04:03 UTC · missing“
bzw. „Outcome 16:00–16:01 UTC · missing“ — beide Fenster 60 s) · **Sample** (Banner).

## 4. Record
Zwei Zahlen und ein Satz (§11.5):
- **Seiten-Record** groß: „4 of 6 calls“ — gezählt werden nur Runden mit einer Seite, ohne die
  knappen. Darunter die Serie.
- **Saisonwert** (Brier, inklusive Versäumnissen, so beschriftet): „0.313 · 9 scored“.
- Der Satz, der beide erklärt: `Your side record counts calls. Your season score measures how sure
  you were.`
- Die drei ehrlichen Zahlen bleiben: **Commits · Reveals · Missing** (Beispiel „9 · 8 · 1“) mit
  Fußnote „missing counts as a full miss“.
- Baselines: „Always 50%: 0.250 · Crowd: 0.211“.
- Kalibrierungskurve **und** jede Aussage über Übersicherheit: gesperrt bis **20 aufgedeckte
  Runden** — Text „Unlocks after 20 revealed calls · you're at 8“, kein leeres Chart. (Missing
  zählt im Saisonwert, nicht in der Kurve.)
- Liste vergangener Runden: Datum, Frage, deine versiegelte Antwort („Up, 80%“), Ausgang, Status
  (called / missed / too close / no side / missing / no resolve). Missing wird im Client
  abgeleitet: Commits − Reveals − offene; „open“ ist ein eigener Status, nie Missing vor
  Fensterschluss — und offen heißt seit dem 21.09. **bis zu drei Tage**.
- Demo-Toggle „Show sample record (36 calls)“ mit Banner „Sample data · not your phone“.

## 5. Round Detail (im UI: „Call detail“)
Frage (mit Kontextzeile, falls Ereignistag) · deine versiegelte Antwort · Ausgang · Verteilung ·
Brier dieser Runde · „Too close to call“, falls `|outcome_margin_bps| ≤ band_bps`, mit der
gemessenen Bewegung · Evidence (Feed-ID; Referenz und Ergebnis je `publish_time`,
`prev_publish_time`, Preis, Konfidenz, Update-Slot, Einreichungs-Slot und Einreicher; Tx-Links) ·
NO_RESOLVE-Grund falls zutreffend: „No valid reading in the window. Nobody scored.“ plus das
fehlende Fenster („Reference 04:02–04:03 UTC · missing“ bzw. „Outcome 16:00–16:01 UTC · missing“;
je 60 s).

## 6. Publication (nur wenn dieses Gerät gepostet hat)
> Bleibt ungebaut (siehe unten). Falls doch: „call“ statt „round“, wie überall im UI.
> **Offene Frage (Owner entscheidet, 18.09.):** Solange der Resolver-Dienst jede Runde postet, trifft „This phone posted the oracle reading." nie zu. Entweder die Zeile wird ehrlich umformuliert (Poster benennen), oder die App postet selbst, wenn sie kann, und der Dienst springt nur ein — Letzteres braucht Pyth-Zugang auf dem Gerät. Wird zusammen mit dem Seal-Moment entschieden; bis dahin bleibt der Zustand ungebaut.
Kleiner, würdiger Zustand, kein Preis-Screen: „This phone posted the oracle reading for round 41 · 63 entries.“ Erst nach bestätigtem `Round.resolver` bzw. `referencer`. Der Knopf dafür ist optional („Post the reading · needs several approvals“) und nie Teil der täglichen Geste.

## 7. Settings
Wallet · „Genesis · verified“ mit Mint · Autoritäten: calendar und pause (aus Config), upgrade (Programm-Autorität) mit Adressen · Kosten in Klartext (dieselbe Zeile wie Today) · „The answer belongs to the wallet that sealed it.“ · Push-Zeiten (lokal) · „Observed does not charge you.“ · Export des Reveal-Backups (optional, v1 nur Hinweis) · Sample-Toggle.

## 8. Push (Texte)
Rein mechanisch auf die neuen Zeiten gezogen; der Wortlaut ist unverändert, wo er passte.
- 16:00 UTC, **mit** eigenem Satz: „Yesterday's call is in. See what you wrote.“
- 16:00 UTC, **ohne** eigenen Satz: „Yesterday's call is in.“
  (Der Push lockt mit dem eigenen Satz, nicht mit dem Fenster. Wie lange offen ist, steht in
  der App.)
- lokal −1 h vor 04:00: „One hour to seal today's answer.“
- 16:00 UTC (Vortagesrunde vollständig): „Yesterday is in. 63 revealed.“
- **Letzter Abend einer offenen Runde:** „Last evening to reveal Tuesday's call. After that it
  counts as a miss.“ (Die Folge muss drinstehen, sonst ist der Fehlschlag am nächsten Tag eine
  Überraschung.)
- NO_RESOLVE: „No valid reading yesterday. Nobody scored.“

## 9. Fehlerzustände
Kein Wallet · kein SGT · **zu wenig SOL** (vor dem Wallet-Sheet geprüft, Text in §2) · Commit fehlgeschlagen (unknown ≠ failed: erst `Entry` prüfen) · Fenster während Wallet-Dialog geschlossen · offline.

**Salt fehlt** („This answer can't be revealed. It will count as missing.“): bleibt als letzter Zustand stehen, wird aber selten. Seit E2 (Build 26.09.) lässt sich das Saison-Geheimnis über `signMessage` wiederherstellen; der Text erscheint erst, wenn auch das fehlschlägt — davor steht `Restore from your wallet` als Weg.

## 10. Share-Karte
> **Gestrichen am 21.09.2026 (E4).** Wird in Saison 1 nicht gebaut. Die alte Fassung steht in §12.

## Widget (Pflicht, 4×2, Android)
Je Zustand eine Information und eine Aktion; Wortmarke klein oben links; eine Haarlinie; Aktion als
Textlink mit Pfeil (kein Pill-Button — die Systemrundung des Widgets ist die einzige Rundung).
- **Open:** Kicker „Today / open“; Frage in Serif (max. zwei Zeilen); Zeile mit der **Seal-Frist**,
  nicht der Ereigniszeit: „Seal by 04:00 UTC · 06:00 where you are“; Link „Pick a side →“
  (öffnet Today). Ab 03:50 UTC: „Seal by 04:00 UTC · closing soon“.
- **Sealed:** Kicker „Sealed“; **kein Wert auf dem Home-Screen** (Shoulder-Surfing; die versiegelte
  Antwort bleibt in der App) — stattdessen „pending · outcome at 16:00 UTC · 18:00 where you are“;
  Link „View seal →“.
- **Yesterday in:** Kicker „Yesterday“; Hero `You called the side.` / `It went the other way.` /
  `Too close to call.`; darunter klein „Crowd 64 · You 80“ erst, wenn der Nutzer das in Settings
  erlaubt (Standard aus); Link „See reading →“.
- **Offen zum Aufdecken:** Kicker „Open“; „2 calls waiting · first closes Fri 18:00“ — Zeit in
  **Ortszeit**, im Widget ist kein Platz für UTC und lokal; Link „Reveal →“.
- **NO_RESOLVE:** Kicker „Yesterday“; „No valid reading. Nobody scored.“; Link „See why →“.
- **Kein Wallet / kein SGT:** „Connect to seal today →“.
Aktualisierung: bei App-Öffnen, per Push (16:00, 04:00) und alle 30 Min über WorkManager; Zustand
aus lokalem Cache, kein RPC-Aufruf im Widget selbst.
Technik (02): Android-Widgets sind RemoteViews — keine eigenen Schriftarten. Serif entweder als
System-Serif (Noto Serif) oder Hero-Zeile als gerenderte Bitmap; Entscheidung nach Sichtprüfung auf
dem Seeker.

## Beispielzahlen (überall identisch)
Eine **echte** Runde des Kalenders, damit die Zahlen im Video und im Deck nachprüfbar sind:

| | |
|---|---|
| Runde | **11 · Di 6. Okt 2026 · SOL/USD** (Richtungsfrage) |
| Frage | „Will SOL be higher at 16:00 than at 04:02 UTC?“ |
| Siegeln | 5. Okt 16:00 – 6. Okt 04:00 UTC |
| Referenz | 6. Okt 04:02 UTC · **$150.00** |
| Ausgang | 6. Okt 16:00 UTC · **$151.95** → höher → **Yes** (+130 bps, also nicht knapp) |
| Aufdecken | bis 9. Okt 16:00 UTC (72 h) |
| Deine Antwort | `You sealed: Up, 80% sure.` → Brier dieser Runde **0.040** |
| Ergebnis-Zeile | `You called the side.` |
| Serie | `3 evenings in a row.` |
| Menge | 64 % Ja · 63 revealed of 71 |
| Record | Seiten-Record **4 of 6 calls** · Saisonwert **0.313 · 9 scored** (8 aufgedeckt + 1 missing als 1,000) |
| Zähler | 9 commits · 8 reveals · 1 missing · Kalibrierung „you're at 8“ (Freischaltung bei 20) |

Der Seiten-Record zählt 6 statt 8, weil von den acht aufgedeckten Runden eine ohne Seite (50) und
eine knapp war.

### Ton (Owner, 22.09.2026)
**Die App macht keinen Ton.** Kein Siegel-Klang, kein Ton beim Strich-Moment, keine Audiodatei im
Bündel. Haptik bleibt erlaubt (D2 wird haptisch, nicht hörbar). Gemessen am 22.09.: Im Repo gibt
es weder Audiocode noch eine Audiodatei — die Regel hält also fest, was ohnehin gilt, und
verhindert, dass es später hineinrutscht.

## 11. Eingabe, Ergebnis und Record — Texte vom 21.09.2026

Vom Owner freigegeben (E8, E11, E13). **Wörtlich so in den Code**, App-Sprache Englisch.
Ersetzt die widersprechenden Stellen in §2, §3 und §4.

### 11.1 Eingabe (E11)
Erst die Seite, dann die Sicherheit — dieselben Daten wie vorher, andere Reihenfolge.

- Seitenwahl: `Up` / `Down`
- Darunter die Sicherheit, Reglerworte symmetrisch:
  - 50: `Could go either way`
  - 55–65: `Leaning Up` / `Leaning Down`
  - 70–85: `Fairly sure: Up` / `Fairly sure: Down`
  - 90–100: `Very sure: Up` / `Very sure: Down`

`p = 50` heißt „keine Seite“: kein Treffer, kein Fehlschlag. Im Saisonwert zählt die Runde normal.

**Siegeln ist gesperrt, bis beide Hälften entschieden sind (Owner, 22.09.2026):** eine Seite
**und** eine Sicherheit, die jemand gesetzt hat. Solange `How sure?` steht, ist `Seal today`
inaktiv. Den Regler anzufassen und auf 50 stehen zu lassen genügt — das ist eine Entscheidung;
ein unberührter Regler ist keine.

**Die drei Zustände der Eingabe (Owner, 22.09.2026, freigegeben):**
- keine Seite gewählt: `Pick a side first.` (steht unter der Zahl, nicht unter dem Knopf)
- Seite gewählt, Regler noch nicht bewegt: `How sure?`
- Regler bewegt: die Reglerworte oben

Der Unterschied zwischen den letzten beiden ist der Punkt: „Could go either way“ ist eine
Antwort, kein leeres Feld. Ein Regler, den niemand angefasst hat, darf nicht aussehen wie eine
Entscheidung für 50.

**Während das Wallet-Blatt offen ist:** `Waiting for your wallet.` — der eine Moment, in dem die
App nichts tun kann außer das zu sagen. Ersetzt die erfundenen Zwischenstände „Sealing…“ und
„Revealing…“.

### 11.2 Satzfeld (E13)
- Überschrift: `What tipped you toward Up?` / `What tipped you toward Down?`
- bei 50: `What makes this hard to call?`
- Darunter: `One sentence for tomorrow. Optional.`
- Freigabe-Schalter (E8), **Standard AUS**:
  - `Share it after the reveal`
  - Unterzeile: `Private until you reveal. If shared, it's public and permanent on Solana.`
- Nur wenn AN: Hash-Memo beim Siegeln, Klartext-Memo beim Aufdecken.
  Wenn AUS: keine Memos, der Satz bleibt auf dem Gerät.
- Wird das Satzfeld ausgelassen, sagt die App dazu nichts.

### 11.3 Ergebnis, täglich (E11)
- Seite getroffen: `You called the side.`
- Seite verfehlt: `It went the other way.`
- Knapp (im Messband): `Too close to call.`
  - Unterzeile: `SOL moved {x}% — inside the measurement band. A different reading could have
    flipped it, so it doesn't count for or against your side record.`
- Keine Seite (50): `You didn't pick a side.`
- Serie: `{n} evenings in a row.` — bei 1: `First evening.`

Der Brier-Wert steht **nicht** im täglichen Ergebnis, nur im Saison-Record.

### 11.4 Sätze der anderen (E8)
- Überschrift: `What others wrote`
- Leer: `Nobody shared a sentence this time.`

### 11.5 Record — zwei Zahlen, ein Satz (E11)
- Seiten-Record (getroffene Seiten) **und** Saisonwert (Brier, inklusive Versäumnissen).
- Der Satz, der beide erklärt: `Your side record counts calls. Your season score measures how
  sure you were.`
- Aussage über Übersicherheit erst ab **20 aufgedeckten Runden**.

### 11.6 Regeln hinter den Texten
- **Knappe Runden zählen im Saison-Brier normal, aber nicht in „Seite getroffen“.** Beides ist aus
  der Kette ableitbar: `|outcome_margin_bps| ≤ band_bps` ist „knapp“, `outcome` die Seite,
  `p_bps` die eigene. Die App rechnet, das Programm speichert.
- `{x}` in „Too close to call“ ist `outcome_margin_bps / 100`, auf eine Nachkommastelle.
- Die Serie zählt **aufgedeckte Abende**, nicht Treffer — eine knappe Runde bricht sie nicht.

### 11.8 Backup-Code (E2) — freigegeben 21.09.2026
Das Wort ist **„backup code“**, nie „key“ und nie „recovery“: Ein Feld, das nach einem
„Schlüssel“ fragt, ist das Muster, mit dem Leute um ihre Wallet-Phrase gebracht werden.

**Einstellungen**
- Zeile: `Backup code`
- Unterzeile: `Needed to reveal open calls after reinstalling.`
- Knopf: `Copy backup code`
- Nach dem Kopieren: `Copied. Keep it private — with it, someone could see your sealed answers
  before you reveal them.`

**Neuinstallation mit offenen Calls**
- Titel: `Restore your open calls`
- Text: `Paste the backup code you copied from Observed.`
- Warnung: `This is not your wallet's recovery phrase. Never paste that here — or anywhere.`
- Knopf: `Restore`
- Überspringen: `Skip — open calls will count as misses`
- Fehler: `This code doesn't match your sealed calls.`

**Onboarding**, unter `Reinstalling can forfeit a pending answer.`:
`You can copy a backup code in Settings.`

**Technisch:** Das Einfügefeld lehnt alles ab, was nach einer Wallet-Phrase aussieht (12 oder 24
Wörter), und zeigt genau die Warnung oben — keinen Formatfehler. Die Regel steht in
`app/src/core/secret.ts`, nicht im Bildschirm, damit sie einen Umbau überlebt.

### 11.7 Noch gesperrt
Die Erinnerungsschätzung vor dem Aufdecken (E12) wird **nicht** gebaut. Erst mündlich mit den
Testern, dann Freigabe des Owners.

## 12. Ersetzte Fassungen (Stand 17.–19.09.2026)

Hier steht wörtlich, was der Sweep vom 21.09.2026 ersetzt hat — nichts wurde gelöscht.
Grund für den Sweep: Fenster 16:00–04:00 UTC statt 00:00–12:00, Referenz 04:02, Ausgang
16:00, Aufdecken 72 h, Richtungsfrage als Standard, Bewegung nur an fünf Ereignistagen.

### §1 After-hours-Erststart (Fassung 17.09.)

```text
**After-hours-Erststart (nach 12:00 UTC):** kein „Window closed“. Stattdessen ein vollständiges Result einer Sample-Runde mit Banner „Sample round · completed“ und der Zeile „Yours starts 00:00 UTC · 02:00 where you are“. CTA: „Remind me when the window opens“.
```

### §2 Today (Fassung 17.09., Zeiten 12:00/00:00)

```text
## 2. Today
> **Eingabe und Ergebnisanzeige sind am 21.09.2026 ersetzt — siehe §11.** Die Zustände unten gelten weiter, aber: die Frage ist die Richtungsfrage, die Eingabe ist erst Seite, dann Sicherheit, und die Zeiten sind 16:00–04:00 UTC (Referenz 04:02, Ausgang 16:00). Die alten Uhrzeiten in diesem Abschnitt sind **veraltet** (siehe HANDOFF, Offen 14).

Zustände:
- **Offen, unbeantwortet:** Fensterzeile „Seal by 12:00 UTC · 14:00 where you are“ (ab 11:50 UTC: „Network is busy — seal now“); „ROUND 42 · 17 SEP“; „Genesis · verified“; Frage (Literata; vor 12:00 relativ: „Will SOL be more than 1% above its 12:00 UTC price at 00:00 UTC?“); große Zahl + „chance this is Yes“; horizontaler Maßstab mit 21 Ticks, Cursor, `−5` / `+5`; ein Primary „Seal today“ (Zeile darüber nur wenn nötig: „Yesterday reveals in this same signature“); Kostenzeile (identisch mit Spec §11): „No app fees. Network ≈ 0.0001 SOL per day · ≈ 0.002 SOL deposit, refunded when the round closes.“
- **Versiegelt (Vormittag):** Frage bleibt, Status „Sealed · 09:12 UTC“, kein zweites Hero. Hinweis „Hidden until you reveal tomorrow.“
- **Pending (Nachmittag, nach Schluss):** kein leeres Plakat. Frage klein, jetzt mit Zahl („above $151.50 · 12:00 reference $150.00“), Status graphit „pending · observed at 00:00 UTC“, nächstes Fenster mit lokaler Zeit. Die eigene Zahl wird nicht wiederholt.
- **Verpasst (nicht versiegelt, Fenster zu):** „Window closed · next question 00:00 UTC“. Kein Vorwurf, kein Streak.
- **Nicht eligible:** „No Genesis Token found in this wallet.“ + Erklärung, was zählt (das Gerät), Link zu Settings.
- **Keine Runde heute** (niemand hat sie angelegt — `create_round` ist permissionless, der Cron hat gefehlt): „No question today. Yesterday still reveals.“ — Reveal-only-Pfad, kein leerer Fehler.
```

### §3 Result (Fassung 17.09., täglicher Brier)

```text
## 3. Result (Kern)
> **Punkt 7 (tägliche Brier-Zeile) ist am 21.09.2026 ersetzt — siehe §11.** Täglich steht die Seite, nicht der Wert.

Kicker: „READING · 16 SEP“ (nie „Yesterday / 16 Sep“). Reihenfolge von oben:
1. Frage klein.
2. Strich-Moment: „pending“ durchgestrichen, „observed“ in Pencil-Blau darüber (einzige Animation der App).
3. Hero in Literata: **„It did not happen.“** (Beispielrunde; sonst „It happened.“) — nicht die Zahl. Kleine Meta-Zeile „Outcome · No“ erlaubt.
4. „You gave Yes a 40% chance.“ (Beispiel: 40 % Ja, Ausgang Nein → Brier (0,40 − 0)² = 0,160; die Menge lag mit 64 daneben.)
5. Maßstab wird Verteilung: dieselben 21 Positionen, Menge in Graphit, dein Bucket in Blau, Mean als Linie. „63 revealed“.
6. Fakten-Zeile: „Crowd 64 · You 40“ (kein „closer“).
7. Protokollzeile: „Brier 0.160 · Record 0.313 · 9 scored · 1 missing (counts as a full miss)“ (Brier = score_bps / 10 000; Record immer inklusive Missing; „scored“ zählt aufgedeckte **und** Missing-Runden; kein Pfeil).
8. „One round added. No verdict on your skill.“
9. Evidence-Referenz klein: Feed, Referenz (12:00) und Ergebnis (00:00) mit Zeitstempeln, Poster („This phone posted the oracle reading.“ wenn zutreffend), Explorer-Links.
Zustände: **Resolved** (oben; ab ≈ 00:05 mit Teilmenge „63 of 71 revealed · closes 12:00 UTC“, ab 12:00 final) · **NO_RESOLVE** (Programmstatus `Cancelled`: „No valid reading in the window. Nobody scored.“; das Evidenz-Fenster nennt, welches Update fehlte: „Reference 12:00–12:01 UTC · missing“ bzw. „Outcome 00:00–00:01 UTC · missing“ — beide Fenster 60 s) · **Sample** (Banner).
```

### §4 Record (Fassung 17.09., eine Zahl)

```text
## 4. Record
> **Am 21.09.2026 erweitert — siehe §11:** zwei Zahlen (Seiten-Record und Saisonwert) mit einem Satz, der sagt, warum es beide gibt.
- Kumulativer Brier groß (inklusive Missing, so beschriftet); darunter die drei ehrlichen Zahlen: **Commits · Reveals · Missing** (Beispiel „9 · 8 · 1“) mit Fußnote „missing counts as a full miss“.
- Baselines: „Always 50%: 0.250 · Crowd: 0.211“.
- Kalibrierungskurve: gesperrt bis 21 aufgedeckte Runden — Text „Unlocks after 21 revealed rounds · you're at 8“, kein leeres Chart. (Missing zählt im Record, nicht in der Kurve.)
- Liste vergangener Runden: Datum, Frage, dein P(Yes), Ausgang, Brier, Status (scored / missing / no resolve). Missing wird im Client abgeleitet: Commits − Reveals − offene; „open“ ist ein eigener Status, nie Missing vor Fensterschluss.
- Demo-Toggle „Show sample record (36 rounds)“ mit Banner „Sample data · not your phone“.
```

### §5 Round Detail (Fassung 17.09.)

```text
## 5. Round Detail
Frage · dein P(Yes) · Ausgang · Verteilung · Brier · Evidence (Feed-ID; Referenz und Ergebnis je `publish_time`, `prev_publish_time`, Preis, Konfidenz; Poster; Tx) · NO_RESOLVE-Grund falls zutreffend: „No valid reading in the window. Nobody scored.“ plus das fehlende Fenster („Reference 12:00–12:01 UTC · missing“ bzw. „Outcome 00:00–00:01 UTC · missing“; je 60 s).
```

### §8 Push (Fassung 17.09., Zeiten 00:00/12:00)

```text
## 8. Push (Texte)
- 00:00 UTC: „Outcome is in. Reveal window open until 12:00 UTC.“
- lokal −1 h: „One hour to seal today's answer.“
- 12:00 UTC: „Yesterday is in. 63 revealed.“
- NO_RESOLVE: „No valid reading yesterday. Nobody scored.“
```

### §10 Share-Karte (Fassung 17.09.)

```text
## 10. Share-Karte
Gedruckter Abzug auf Papier (einziges helles Objekt): Frage, Ausgang „No“, „I gave Yes a 40% chance.“, Verteilung als Reihe, „Brier 0.160 · 9 scored · 8 revealed · 1 missing“, „One round. Not a skill rating.“, .skr-Name optional, kein Wallet, kein Sponsor.
```

### Widget (Fassung 17.09., Zeiten 12:00/00:00)

```text
## Widget (Pflicht, 4×2, Android)
Je Zustand eine Information und eine Aktion; Wortmarke klein oben links; eine Haarlinie; Aktion als Textlink mit Pfeil (kein Pill-Button — die Systemrundung des Widgets ist die einzige Rundung).
- **Open:** Kicker „Today / open“; Frage in Serif (max. zwei Zeilen); Zeile mit der **Seal-Frist**, nicht der Ereigniszeit: „Seal by 12:00 UTC · 14:00 where you are“; Link „Set probability →“ (öffnet Today). Ab 11:50 UTC: „Seal by 12:00 UTC · closing soon“.
- **Sealed:** Kicker „Sealed“; **kein Wert auf dem Home-Screen** (Shoulder-Surfing; der versiegelte Wert bleibt in der App) — stattdessen „pending · observed at 00:00 UTC · 02:00 where you are“; Link „View seal →“.
- **Yesterday in:** Kicker „Yesterday“; Hero „It did not happen.“ (Beispiel) / „It happened.“; darunter klein „Crowd 64 · You 40“ erst, wenn der Nutzer das in Settings erlaubt (Standard aus); Link „See reading →“.
- **NO_RESOLVE:** Kicker „Yesterday“; „No valid reading. Nobody scored.“; Link „See why →“.
- **Kein Wallet / kein SGT:** „Connect to seal today →“.
Aktualisierung: bei App-Öffnen, per Push (Mitternacht, Mittag) und alle 30 Min über WorkManager; Zustand aus lokalem Cache, kein RPC-Aufruf im Widget selbst.
Technik (02): Android-Widgets sind RemoteViews — keine eigenen Schriftarten. Serif entweder als System-Serif (Noto Serif) oder Hero-Zeile als gerenderte Bitmap; Entscheidung nach Sichtprüfung auf dem Seeker.
```

### Beispielzahlen (Fassung 17.09., Bewegungsfrage)

```text
## Beispielzahlen (überall identisch)
Runde 41 · 16 SEP · Regel SOL/USD +1 % · Frage vor 12:00 „Will SOL be more than 1% above its 12:00 UTC price at 00:00 UTC?“ · Referenz 12:00 $150.00 → Schwelle $151.50 · Ausgang **No** — Hero „It did not happen.“ (SOL $149.82 at 00:00) · du 40 % Ja · Brier 0.160 · Menge 64 (63 revealed of 71) · Record 0.313 · 9 commits · 8 reveals · 1 missing · 9 scored (8 aufgedeckt + 1 missing als 1,000) · Kalibrierung „you're at 8“.
```
