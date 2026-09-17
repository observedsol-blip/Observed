# OBSERVED — Screen-Map v1

Gilt vorbehaltlich Spike 3 (eine Freigabe für `reveal + commit`). Copy ist Englisch; Zeiten immer UTC **und** lokal. Struktur folgt dem ChatGPT-Handoff, Regeln aus dem Grok-Review sind Pflicht.

## Navigation
Header: Wortmarke links, Settings rechts. Drei Bereiche: **Today · Result · Record**. Kein vierter Tab.

## 1. Onboarding (max. 3 Schritte, dann Frage)
1. „How sure is sure?“ — ein Satz, was Observed misst.
2. „One Seed Vault approval a day. Seal today, reveal yesterday.“
3. „Keep this installation. Reinstalling can forfeit a pending answer. This is not your seed phrase.“ + ein Satz: „Your answers and your device token are public on-chain once revealed.“
Wallet erst beim ersten Seal.

**After-hours-Erststart (nach 12:00 UTC):** kein „Window closed“. Stattdessen ein vollständiges Result einer Sample-Runde mit Banner „Sample round · completed“ und der Zeile „Yours starts 00:00 UTC · 02:00 where you are“. CTA: „Remind me when the window opens“.

## 2. Today
Zustände:
- **Offen, unbeantwortet:** Fensterzeile „Seal by 12:00 UTC · 14:00 where you are“ (ab 11:50 UTC: „Network is busy — seal now“); „ROUND 42 · 17 SEP“; „Genesis · verified“; Frage (Literata); große Zahl + „chance this is Yes“; horizontaler Maßstab mit 21 Ticks, Cursor, `−5` / `+5`; ein Primary „Seal today“ (Zeile darüber nur wenn nötig: „Yesterday reveals in this same signature“); Kostenzeile (identisch mit Spec §11): „No app fees. Network ≈ 0.0001 SOL per day · ≈ 0.002 SOL deposit, refunded when the round closes.“
- **Versiegelt (Vormittag):** Frage bleibt, Status „Sealed · 09:12 UTC“, kein zweites Hero. Hinweis „Hidden until you reveal tomorrow.“
- **Pending (Nachmittag, nach Schluss):** kein leeres Plakat. Frage klein, Status graphit „pending · observed at 00:00 UTC“, nächstes Fenster mit lokaler Zeit. Die eigene Zahl wird nicht wiederholt.
- **Verpasst (nicht versiegelt, Fenster zu):** „Window closed · next question 00:00 UTC“. Kein Vorwurf, kein Streak.
- **Nicht eligible:** „No Genesis Token found in this wallet.“ + Erklärung, was zählt (das Gerät), Link zu Settings.
- **Keine Runde heute** (Autorität hat nicht angelegt): „No question today. Yesterday still reveals.“ — Reveal-only-Pfad, kein leerer Fehler.

## 3. Result (Kern)
Kicker: „READING · 16 SEP“ (nie „Yesterday / 16 Sep“). Reihenfolge von oben:
1. Frage klein.
2. Strich-Moment: „pending“ durchgestrichen, „observed“ in Pencil-Blau darüber (einzige Animation der App).
3. Hero in Literata: **„No happened.“** (Beispielrunde; sonst „Yes happened.“) — nicht die Zahl.
4. „You gave Yes a 40% chance.“ (Beispiel: 40 % Ja, Ausgang Nein → Brier (0,40 − 0)² = 0,160; die Menge lag mit 64 daneben.)
5. Maßstab wird Verteilung: dieselben 21 Positionen, Menge in Graphit, dein Bucket in Blau, Mean als Linie. „63 revealed“.
6. Fakten-Zeile: „Crowd 64 · You 40“ (kein „closer“).
7. Protokollzeile: „Brier 0.160 · Record 0.229 · 9 scored · 1 missing (scored as 50%)“ (Brier = score_bps / 10 000; Record immer inklusive Missing; kein Pfeil).
8. „One round added. No verdict on your skill.“
9. Evidence-Referenz klein: Feed, Zeitstempel, Resolver („This phone posted the oracle reading.“ wenn zutreffend), Explorer-Link.
Zustände: **Resolved** (oben; ab ≈ 00:05 mit Teilmenge „63 of 71 revealed · closes 12:00 UTC“, ab 12:00 final) · **NO_RESOLVE** (Programmstatus `Cancelled`: „No valid reading in the window. Nobody scored.“, Evidenz-Fenster genannt) · **Sample** (Banner).

## 4. Record
- Kumulativer Brier groß (inklusive Missing, so beschriftet); darunter die drei ehrlichen Zahlen: **Commits · Reveals · Missing** mit Fußnote „missing counts as 50%“.
- Baselines: „Always 50%: 0.250 · Crowd: 0.211“.
- Kalibrierungskurve: gesperrt bis 21 aufgedeckte Runden — Text „Unlocks after 21 revealed rounds · you're at 9“, kein leeres Chart. (Missing zählt im Record, nicht in der Kurve.)
- Liste vergangener Runden: Datum, Frage, dein P(Yes), Ausgang, Brier, Status (scored / missing / no resolve). Missing wird im Client abgeleitet: Commits − Reveals − offene; „open“ ist ein eigener Status, nie Missing vor Fensterschluss.
- Demo-Toggle „Show sample record (36 rounds)“ mit Banner „Sample data · not your phone“.

## 5. Round Detail
Frage · dein P(Yes) · Ausgang · Verteilung · Brier · Evidence (Feed-ID, `publish_time`, `prev_publish_time`, Preis, Konfidenz, Resolver, Tx) · NO_RESOLVE-Grund falls zutreffend.

## 6. Publication (nur wenn dieses Gerät aufgelöst hat)
Kleiner, würdiger Zustand, kein Preis-Screen: „This phone posted the oracle reading for round 41 · 63 entries.“ Erst nach bestätigtem `Round.resolver`.

## 7. Settings
Wallet · „Genesis · verified“ mit Mint · Autoritäten: question und pause (aus Config), upgrade (Programm-Autorität) mit Adressen · Kosten in Klartext (dieselbe Zeile wie Today) · „The answer belongs to the wallet that sealed it.“ · Push-Zeiten (lokal) · „Observed does not charge you.“ · Export des Reveal-Backups (optional, v1 nur Hinweis) · Sample-Toggle.

## 8. Push (Texte)
- 00:00 UTC: „Outcome is in. Reveal window open until 12:00 UTC.“
- lokal −1 h: „One hour to seal today's answer.“
- 12:00 UTC: „Yesterday is in. 63 revealed.“
- NO_RESOLVE: „No valid reading yesterday. Nobody scored.“

## 9. Fehlerzustände
Kein Wallet · kein SGT · Commit fehlgeschlagen (unknown ≠ failed: erst `Entry` prüfen) · Salt fehlt („This answer can't be revealed. It will count as missing.“) · Fenster während Wallet-Dialog geschlossen · offline.

## 10. Share-Karte
Gedruckter Abzug auf Papier (einziges helles Objekt): Frage, Ausgang „No“, „I gave Yes a 40% chance.“, Verteilung als Reihe, „Brier 0.160 · 9 scored · 1 missing“, „One round. Not a skill rating.“, .skr-Name optional, kein Wallet, kein Sponsor.

## Widget (Pflicht, 4×2, Android)
Je Zustand eine Information und eine Aktion; Wortmarke klein oben links; eine Haarlinie; Aktion als Textlink mit Pfeil (kein Pill-Button — die Systemrundung des Widgets ist die einzige Rundung).
- **Open:** Kicker „Today / open“; Frage in Serif (max. zwei Zeilen); Zeile mit der **Seal-Frist**, nicht der Ereigniszeit: „Seal by 12:00 UTC · 14:00 where you are“; Link „Set probability →“ (öffnet Today). Ab 11:50 UTC: „Seal by 12:00 UTC · closing soon“.
- **Sealed:** Kicker „Sealed“; **kein Wert auf dem Home-Screen** (Shoulder-Surfing; der versiegelte Wert bleibt in der App) — stattdessen „pending · observed at 00:00 UTC · 02:00 where you are“; Link „View seal →“.
- **Yesterday in:** Kicker „Yesterday“; Hero „No happened.“ (Beispiel) / „Yes happened.“; darunter klein „Crowd 64 · You 40“ erst, wenn der Nutzer das in Settings erlaubt (Standard aus); Link „See reading →“.
- **NO_RESOLVE:** Kicker „Yesterday“; „No valid reading. Nobody scored.“; Link „See why →“.
- **Kein Wallet / kein SGT:** „Connect to seal today →“.
Aktualisierung: bei App-Öffnen, per Push (Mitternacht, Mittag) und alle 30 Min über WorkManager; Zustand aus lokalem Cache, kein RPC-Aufruf im Widget selbst.
Technik (02): Android-Widgets sind RemoteViews — keine eigenen Schriftarten. Serif entweder als System-Serif (Noto Serif) oder Hero-Zeile als gerenderte Bitmap; Entscheidung nach Sichtprüfung auf dem Seeker.

## Beispielzahlen (überall identisch)
Runde 41 · 16 SEP · Frage „Will SOL close at or above $150 at 00:00 UTC?“ · Ausgang **No** (SOL $149.82) · du 40 % Ja · Brier 0.160 · Menge 64 (63 revealed of 71) · Record 0.229 · 9 scored · 1 missing.
