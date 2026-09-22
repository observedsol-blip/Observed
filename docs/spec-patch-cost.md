# Änderungsvorschlag: 00-SPEC.md §11 (Kostenzeile)

**Nur ein Vorschlag.** `docs/00-SPEC.md` ist nicht angefasst — dafür braucht es `.spec-unlock`.
Geschrieben am 22.09.2026 von Claude Code, alle Zahlen gemessen, Quellen unten.

## Warum

Die heutige Zeile nennt die Netzgebühr **rund zwanzigmal zu hoch** und verschweigt den einen
Betrag, den ein Spieler wirklich ausgibt.

## Der Diff

```diff
--- a/docs/00-SPEC.md
+++ b/docs/00-SPEC.md
@@ -84 +84 @@
-Eine Zeile, zwei Zahlen, überall identisch: „No app fees. Network ≈ 0.0001 SOL per day · ≈ 0.002 SOL deposit, refunded when the round closes." (Beide Zahlen nach Spike 1 exakt einsetzen; dieselbe Zeile in Onboarding, Today und Settings.)
+Zwei Zeilen, überall identisch. Die erste immer, die zweite nur vor dem allerersten Siegel:
+
+„No stakes. A 0.0022 SOL deposit comes back to this wallet by 30 Dec."
+„Your first call also opens your record: 0.0013 SOL, once, not returned."
+
+Keine Zahl steht im Text: die Beträge kommen aus den Kontogrößen, das Datum aus dem Kalender
+(`app/src/core/funding.ts`, `lastDepositBack`). Die Netzgebühr wird nicht mehr genannt — sie
+ist mit 0,000005 SOL je Abend kleiner als jede Rundung, die sie lesbar machen würde.
```

## Die gemessenen Zahlen

| Posten | gemessen | die alte Zeile sagte |
|---|---|---|
| Netzgebühr je Abend | **5 000 Lamports = 0,000005 SOL** | „≈ 0.0001 SOL per day" — **20×** zu hoch |
| Kaution je Eintrag | **2 171 520 Lamports = 0,00217152 SOL** | „≈ 0.002 SOL" — richtig gerundet |
| `Player`-Konto, einmalig | **1 343 280 Lamports = 0,00134328 SOL** | **gar nicht genannt** |
| Kaution zurück | **frühestens 09.11.2026, spätestens 30.12.2026** | „when the round closes" |

### Woher die Zahlen kommen

- **Gebühr:** eine Signatur je Abend, 5 000 Lamports je Signatur, **kein Prioritätspreis**. Die
  App setzt keinen (`app/src/chain/ids.ts`), und die Gebühr hängt an der Signatur, nicht an den
  angeforderten Recheneinheiten. Der ganze Abend — drei Aufdeckungen, ein Siegel, zwei Memos —
  ist eine Transaktion mit einer Unterschrift (Matrixzeile R4, gemessen auf dem Validator).
- **Kaution:** `Entry` ist 184 Bytes; Mietbefreiung = `(184 + 128) × 6 960`. Die Formel ist
  gegen ein echtes, von der Kette geschriebenes Konto geprüft (`round-layout.json`: 498 Bytes,
  4 356 960 Lamports — exakt der Formelwert).
- **`Player`:** 65 Bytes, `(65 + 128) × 6 960`. **Kommt nicht zurück:** das Programm hat keine
  Instruktion, die ein `Player`-Konto schließt (genau ein `close =` in `lib.rs:1177`, und das
  gehört dem `Entry`).
- **Rückgabe:** `close_entry` verlangt `max(reveal_close + close_after_secs, earliest_close_unix)`
  (`programs/observed/src/lib.rs:445-450`). Im Saisonkalender ist `close_after_secs` für alle 64
  Runden 30 Tage und `earliest_close_unix` der 09.11.2026 00:00 UTC. Erste Rückzahlung also
  09.11., letzte 30.12.2026 16:00 UTC.

## Was außerdem noch die alte Zeile trägt

Die Spec ist nicht die einzige Stelle. Diese hier sagen dasselbe Falsche und gehören mit
geändert, sobald der Wortlaut steht:

| Datei:Zeile | |
|---|---|
| `app/src/core/settings.ts:32` | `COST_LINE`, im Settings-Schirm |
| `app/src/screens/Today.tsx:211` | fest im Schirm, nicht aus `copy.ts` |
| `docs/03-SCREEN-MAP.md:41` | §2, „identisch mit Spec §11" |
| `docs/03-SCREEN-MAP.md:441` | Altbestand im Abschnitt „Offen, unbeantwortet" |
| `docs/README-DRAFT.md:62` | Tabellenzeile |
| `docs/TESTER-GUIDE.md:25-26` | „about 0.002 SOL … roughly 0.0001 SOL" |
| `docs/figma-brief.md:162` | Vorlage für den Entwurf |

**Nicht betroffen:** `docs/operations-daily-job.md:97` — dort geht es um die Kosten des
**Resolvers**, der einen Prioritätspreis setzt. Die 0,0001 SOL je Tag stimmen dort.

**Schon richtig ist Today seit dem 22.09.:** die beiden neuen Zeilen stehen über dem
Siegel-Knopf und rechnen die Beträge aus den Konstanten (`app/src/core/day.ts`). Bis die Spec
nachzieht, sagt die App also an einer Stelle das Gemessene und an zwei Stellen das Alte.

## Empfehlung

Die Zeile in `settings.ts:32` und `Today.tsx:211` **vor dem Build am 26.09.** auf den neuen
Wortlaut ziehen, auch wenn 00-SPEC noch nicht entsperrt ist: eine zwanzigfach zu hohe
Gebührenangabe in der Oberfläche ist schlechter als eine Spec, die einen Tag hinterherhinkt.
Ein Wort von dir genügt, es ist eine Zeile je Stelle.
