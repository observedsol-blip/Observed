# Spike 1 — Pyth (17.09.2026, Devnet)

Frage: Lässt sich „erstes Pyth-Update ab Zeitpunkt T“ (Referenz 12:00, Ergebnis 00:00) historisch holen, mit `VerificationLevel::Full` auf Solana posten und on-chain nach der Regel `prev_publish_time < T ≤ publish_time ≤ T + 60 s` prüfen — und was kostet das?

Code: `spikes/pyth/` (Anchor-Programm `pyth_spike` mit einer Instruktion `check_first_after`, Client `client/post.ts`, `client/density.ts`). Rohdaten: `spikes/pyth/results/*.json`. Account-Snapshots für die §6-Tests: `spikes/pyth/fixtures/*.json`.

## Setup (gemessen, nicht geschätzt)
| | |
|---|---|
| Programm | `CvygcyyJavsRaVGGMg4trsWFTADVhcwrJsYuSboHzsEw` (Devnet, 95 088 Bytes) |
| Deploy | 0,485249 SOL (davon 0,48392588 SOL Programm-Miete) |
| Toolchain | anchor-cli 1.2.0, anchor-lang 1.2.0, pyth-solana-receiver-sdk 2.0.0, Agave 4.1.2, rustc 1.98.1 |
| Client | @pythnetwork/pyth-solana-receiver 0.16.0, @solana/web3.js 1.99.0 |
| Pyth Receiver | `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ` |
| Hermes | `GET /v2/updates/price/{T}` mit `Authorization: Bearer <key>`; liefert das erste Update mit `publish_time ≥ T` inkl. `metadata.prev_publish_time` |
| Priority Fee | 1 000 µLamports/CU (Builder-Default-Budget) |

## Posten mit voller Verifikation
| Lauf | Tx | Bytes | Signaturen | Fee (Lamports) | CU | Bemerkung |
|---|---|---|---|---|---|---|
| SOL 17.09 00:00, Konten behalten | 0 | 770 | 2 | 10 606 | 84 592 | Encoded VAA anlegen + Teil 1 |
| | 1 | 875 | 2 | 10 403 | 34 023 | VAA Rest + verify + post + `check_first_after` |
| SOL 16.09 12:00, Konten schließen | 0 | 770 | 2 | 10 606 | 84 592 | |
| | 1 | 933 | 2 | 10 803 | 37 678 | + Close beider Konten |
| BTC 17.09 00:00, schließen | 0 / 1 | 770 / 933 | 2 / 2 | 10 606 / 10 803 | 84 592 / 39 213 | |
| ETH 17.09 00:00, schließen | 0 / 1 | 770 / 933 | 2 / 2 | 10 606 / 10 803 | 84 592 / 46 685 | |

- **Pro Posting: 2 Transaktionen**, je 2 Signaturen (Payer + ephemerer Account-Key, lokal signiert). Hermes-Update-Daten: 631 Bytes.
- **Gebühren pro Posting (mit Close): 21 409 Lamports**; pro Tag (Referenz + Ergebnis): **42 818 Lamports ≈ 0,0000428 SOL** pro Runde, unabhängig von der Spielerzahl.
- **Miete:** Ohne Close bleiben 3 698 240 Lamports gebunden (Price-Update-Konto 134 Bytes = 1 330 960, Encoded-VAA-Konto 2 367 280). Mit Close: **0** netto.
- Die prüfende Instruktion läuft in derselben Tx-Folge **vor** dem Close (`addPriceConsumerInstructions`). Das ist das Muster für `set_reference` und `resolve`: Werte werden in `Round` kopiert, das Oracle-Konto wird danach geschlossen (01 §3, Fehlermatrix „Oracle-Konto später überschrieben“).
- `check_first_after` selbst: 3 403 CU (Simulation).

## Partial-Verifikation (Negativfall)
1 Tx, 1 085 Bytes, 2 Signaturen, 10 203 Lamports, 116 026 CU. Das Programm lehnt das Konto mit `NotFullyVerified` (6000) ab — wie gefordert.

## Ablehnfälle (Simulation gegen das echte Konto `5PWm21YN…V5q8`)
| Fall | Ergebnis | Fehler |
|---|---|---|
| gültig (T = 00:00:00) | angenommen | Log: `price=9857775490 expo=-8 conf=1822971 conf_bps=1 publish_time=T prev_publish_time=T−1` |
| falscher Feed | abgelehnt | `WrongFeed` 6001 |
| T = publish_time + 1 | abgelehnt | `BeforeT` 6003 |
| T = prev_publish_time | abgelehnt | `NotFirstAfter` 6002 |
| Konfidenzgrenze 0 bps | abgelehnt | `ConfidenceTooWide` 6006 |
| fremder Owner (Wallet statt Price-Update) | abgelehnt | `AccountOwnedByWrongProgram` 3007 |
| Partial-verifiziertes Konto | abgelehnt | `NotFullyVerified` 6000 |

Mit echten Daten **nicht** herstellbar (brauchen synthetische Fixtures in den §6-Tests): Update außerhalb 60 s (`OutsideWindow`), Preis ≤ 0, abweichender Exponent.

## Feeds und Zugang
- SOL/USD, BTC/USD, ETH/USD: mit dem aktuellen Key abrufbar.
- **SKR/USD: HTTP 403 „Not entitled … no grant accepts this feed“.** Der Feed existiert, der Plan schaltet ihn nicht frei.
- **Rate-Limit:** Bei 4 Anfragen/s kam nach ~15 Anfragen HTTP 429.

## Fenster-Dichte (30 Tage, 12:00 und 00:00)
Zeitraum 18.08.2026 12:00 – 17.09.2026 00:00 UTC, 60 Zeitpunkte je Feed, eine Hermes-Anfrage pro Zeitpunkt für alle drei Feeds, 4 s Abstand, 0 × HTTP 429.

| Feed | Zeitpunkte | im Fenster | max. Verzögerung `publish_time − T` | Konfidenz Median / Max |
|---|---|---|---|---|
| SOL/USD | 60 | **60** | 0 s | 1 / 2 bps |
| BTC/USD | 60 | **60** | 0 s | 1 / 6 bps |
| ETH/USD | 60 | **60** | 0 s | 1 / 8 bps |

In allen 180 Fällen war das erste Update exakt auf der Sekunde T, mit `prev_publish_time < T`. Hermes lieferte die Historie über den gesamten Zeitraum (≥ 30 Tage).

## Was das für die Spec heißt
1. **Mechanik bestätigt.** Referenz- und Ergebnis-Update sind eindeutig bestimmbar, voll verifiziert postbar und on-chain prüfbar. Kein Grund, 01 §3 `set_reference`/`resolve` zu ändern.
2. **SKR/USD fällt aus der Rotation** (Spec §7: „sonst aus der Rotation“) — Grund ist hier der Zugang (403), nicht die Nacht. CALENDAR.md-Feedzeile entsprechend anpassen, solange kein Plan SKR freischaltet.
3. **Konfidenzgrenze:** beobachtet max. 8 bps. Vorschlag für `max_conf_bps` im Kalender: 50 bps (≥ 6-facher Abstand zum beobachteten Maximum, verwirft aber echte Ausreißer). Entscheidung beim Befüllen von CALENDAR.md.
4. **Oracle-Kosten trägt der Cron:** 42 818 Lamports pro Runde, 0 Miete. Die Spieler-Kostenzeile (Spec §11) ist davon unberührt; deren Zahlen (Commit-Fee, Entry-Miete) kommen erst mit dem Programm.
5. **Offener Spec-Satz (Spec §5, erster Punkt):** „Proxy ist keine exklusive Voraussetzung — jeder kann Evidenz posten.“ Stimmt on-chain weiterhin, praktisch braucht aber jeder Poster seit 26.08.2026 einen **eigenen Pyth-API-Key** (Hermes/Benchmarks antworten sonst 401). Der optionale „Post the reading“-Knopf in der App kann den Key nicht mitliefern (Key gehört nicht auf Geräte) — er müsste die signierten Update-Daten über unseren Proxy holen. Vorschlag: Satz präzisieren („jeder mit Pyth-Zugang kann posten; die App holt die Daten über den Proxy“).
6. **Spieler, der selbst postet:** 2 Transaktionen pro Update (Referenz oder Ergebnis). Ob MWA daraus eine oder zwei Freigaben macht, klärt Spike 3.
7. **Betrieb:** Rate-Limit greift bei Stoßlast (≈ 15 Anfragen in 4 s → 429). Cron braucht 2 Anfragen pro Tag; Proxy muss cachen (steht in 02).
