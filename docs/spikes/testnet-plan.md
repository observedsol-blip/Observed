# Tester-Plan (17.09.2026) — Bewertung, kein Deploy

## Problem
Seeker Genesis Tokens existieren nur auf Mainnet. Das Programm prüft fest `GT22…` (Gruppe) und `GT2z…` (Mint-Authority) als Konstanten. Auf Devnet besitzt niemand ein solches Token → auf Devnet kann niemand `commit` ausführen. Build-Features mit eigener Gruppe pro Netzwerk sind wegen des Echo-Vorfalls (falsche Gruppen-Konstante im falschen Build) ausgeschlossen bzw. nur unter harten Absicherungen denkbar.

## Entscheidung (Owner, 17.09.)
**Eine Program-ID auf Mainnet. Saison 1 beginnt am 25.09.2026 mit den Testern. Die Tester sind die Kohorte; die Jury spielt in derselben Saison.** Kein zweiter Kalender, kein Saisonwechsel vor der Deadline.

- 64 Blätter ab 25.09. → letzte Runde 27.11.2026, also über den 11.11. hinaus (Spec §12).
- `publish_calendar(season = 1, root, leaf_count = 64)` einmal vor dem 25.09.; es greift der Erste-Saison-Pfad (`calendar_root == [0;32]`, 01 §3).
- `Player` (Seeds `["player", config, sgt_mint]`) läuft ohne Bruch durch: Tester-Record = Kohorten-Record.

## Was bis 25.09. fertig sein muss (Gate)
| Bereich | Umfang | Schätzung |
|---|---|---|
| Programm | `initialize`, `publish_calendar`, `create_round`, `commit` (SGT), `reveal`, `set_reference`, `resolve`, `score_entry`, `cancel_round`, `close_entry`, `pause` | 3–4 Tage |
| Tests | alle §6-Fälle grün (LiteSVM, echte Konstanten, Mainnet-Fixtures für SGT und Pyth), clippy `-D warnings`, Reviewer ohne Befund | in obigen Tagen enthalten, +0,5 Tag Reviewer-Runden |
| Cron + Proxy | 12:05 `set_reference`, 00:05 `resolve`, `create_round` Folgetag, `score_entry` Missing; Pyth-Key serverseitig | 1 Tag |
| Build/Deploy-Hygiene | `solana-verify build` aus Tag, Build-Hash in SECURITY.md; Squads-Multisig für calendar/pause/upgrade | 0,5 Tag |
| App-Minimum | Today (Seal), Result, Record, Settings-Autoritäten, Salt-Persistenz vor Wallet-Prompt, MWA | parallel, 3–4 Tage |
| Kalender | 64 Blätter erzeugen, Merkle-Root, CALENDAR.md | 0,5 Tag |

Mainnet-Deploy und `publish_calendar` führt der Owner selbst aus (CLAUDE.md).
**Belastbarer Tag: 25.09.2026.** Abweichung zu Spec §12 („Tester ab Tag 4–5, Devnet“) — als datierter Vorschlag in `docs/spec-changes-2026-09-17.md` §8.

## Was technisch gegen Mainnet ab Tag 1 spricht (und wie wir damit umgehen)
- **Echte Kosten:** Tester zahlen Fees (Spike 1: ≈ 21 000 Lamports pro Oracle-Posting trägt der Cron; Spieler-Tx-Kosten und Entry-Pfand kommen mit dem Programm, Spec §11). Deploy-Miete skaliert mit Programmgröße (Spike: 95 KB ≈ 0,48 SOL; erwartet 300–400 KB ≈ 2–3 SOL).
- **Fehler sind öffentlich und nicht rücksetzbar.** Gegenmittel: `pause` (blockiert nur Commits), Upgrade über Multisig mit Ankündigung, NO_RESOLVE statt Improvisation.
- **Keine Wiederholung der Saison:** Ein früher Fehler steht in der Kohortengeschichte. Deshalb das harte Test-Gate oben.
- **Pyth-Key-Kosten** laufen ab dem 25.09. ohne Pause bis 27.11.

## Verworfene Alternativen
| Variante | Grund |
|---|---|
| **Season 0 für Tester, danach Season 1** | `publish_calendar` für Saison 1 geht erst, wenn Saison 0 abgelaufen ist (`next_round_id > max_round_id`); zwei Kalender vor der Deadline; `Player` hat keine Saison in den Seeds → Tester-Scores würden in die Jury-Saison hineinlaufen (oder ein zweites Player-Schema wäre nötig). Mehr Betrieb, kein Gewinn. |
| **Separate Beta-Program-ID** | Owner-Entscheidung: eine Program-ID. Zweite ID verdoppelt Deploy, Verify, Autoritäten und Settings-Anzeige. |
| **`sgt_group` als Config-Feld** | Abweichung von 01 („Konstanten, nie Account“); verschiebt die Vertrauensannahme auf `initialize`. Ausgeschlossen. |
| **Devnet ohne SGT-Gating** | testet genau das wichtigste Risiko (SGT) nicht und bräuchte trotzdem einen zweiten Build. |

## Hybrid: Devnet mit Fake-Gruppe für 2–3 interne Tester ab ~20.09.
**Idee:** Devnet-Build mit selbst geminteter Gruppe/Mint-Authority, nur für UX, Push, Widget, Tagesablauf. Daten zählen nicht. Echte Kohorte ab 25.09. auf Mainnet.

**Pflicht-Absicherungen (Owner-Vorgabe) und ihr Aufwand:**
| Absicherung | Aufwand |
|---|---|
| Konstanten-Umschaltung per Cargo-Feature `devnet-fake-sgt`, eigene `declare_id!` für Devnet | 0,25 Tag |
| Mainnet-Artefakt nur via `solana-verify build` aus Tag, ohne Features (brauchen wir ohnehin) | 0 zusätzlich |
| CI-Test: im Mainnet-`.so` müssen die 32 Bytes von `GT22…` und `GT2z…` vorkommen und die Fake-Gruppe darf **nicht** vorkommen; umgekehrt für den Devnet-Build | 0,5 Tag |
| Devnet-Build nie Mainnet-deploybar: eigener Program-Keypair, `Anchor.toml`-Cluster, CI verweigert Mainnet-Deploy eines Artefakts, dessen Program-ID ≠ Mainnet-ID | 0,25 Tag |
| Skript: Fake-Gruppe + Member-Mints + Mint an Tester-Wallets (Echo `tests/07-seeker.ts` als Vorlage) | 0,5 Tag |
| App-Build-Profil Devnet (Cluster, Program-ID, RPC), Cron/Proxy zweite Instanz auf Devnet | 0,5 Tag |
| **Summe** | **≈ 2 Tage** |

**Ab wann real nutzbar?** Der Engpass ist nicht die Devnet-Konfiguration, sondern die Schleife selbst: `commit/reveal/set_reference/resolve` + App Today/Result + Cron. Die steht realistisch **frühestens 22.–23.09.** Der Devnet-Pfad wäre also ab ~23.09. nutzbar, zwei Tage vor Mainnet.

**Offen/ungeprüft:** Ob Seed Vault Wallet auf dem Seeker Devnet-Transaktionen per MWA sauber signiert (Echo lief laut seinem CLAUDE.md mit MWA-Cluster `devnet`, das spricht dafür; nicht selbst verifiziert).

**Nutzen gegenüber „nur Mainnet ab 25.09.“:** 2 Tage Vorlauf für UX/Push/Widget mit 2–3 Personen — erkauft mit ≈ 2 Arbeitstagen in der kritischsten Woche und einem zweiten Build genau der Art, die den Echo-Vorfall verursacht hat.

## Empfehlung
**Kein Devnet-Hybrid. Nur Mainnet ab 25.09.**
Stattdessen vor dem 25.09., ohne zweiten Build:
1. Programm-Tests in LiteSVM mit echten Mainnet-Fixtures (SGT, Pyth) — deckt die Logik vollständig ab.
2. UX/Push/Widget intern mit dem **Sample-Modus** der App (Spec §9: Sample-Runde, Sample-Record) — braucht keine Chain.
3. Ab ~23.09. ein **lokaler Mainnet-Fork** (Surfpool o. ä., lädt Mainnet-Konten bei Bedarf): Programm lokal deployen, Config/Kalender/Runde lokal anlegen, `commit` mit dem echten SGT des Owners per `simulateTransaction` (ohne Signaturprüfung) durchspielen, dazu `set_reference`/`resolve` mit echten Pyth-Updates. Kein Mainnet-Effekt, kein zweiter Build, echte Konstanten. Der Wallet-Sheet-Test auf dem Gerät bleibt Spike 3 bzw. der erste echte Seal am 25.09.
   Die ersten echten Runden am 25.09. sind zugleich der Tester-Start.
