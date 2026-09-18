# Observed — Entscheidungen & offene Punkte (Stand 18.09.2026, 00:30 MESZ)

## Entschieden
- Frage-Mechanik: Referenzpreis = erstes Pyth-Update nach 12:00 UTC (permissionless set_reference), Ergebnis nach 00:00 UTC; relative Frage "more than x% above its noon price". Spike 1 bestätigt (713c919, docs/spikes/pyth.md).
- Gleichheit = Nein → Copy "above/more than", nie "at or above"/"at least".
- SKR raus aus der Rotation (Pyth-Plan sperrt Feed). Feeds SOL/BTC/ETH. SKR-Prize damit faktisch offen/verzichtet.
- max_conf_bps = 50.
- Evidenz: posten braucht Pyth-Zugang; App holt Daten über Proxy; Programm prüft unabhängig vom Poster (01 §5b, SECURITY.md nachgezogen).
- **KORRIGIERT 18.09. (Review K1): Missing wird mit 1,000 (10 000 bps) gescored, nicht 0,250.** Grund: Reveal liegt nach dem bekannten Ausgang; bei 0,250 war "nur Treffer aufdecken" die dominante Strategie (Simulation: Münzwerfer 0,098–0,122 gegen 0,238–0,250 ehrlich). Zeitwechsel (Reveal nach Ausgang) bleibt; Reveal-Fenster ggf. verlängern, damit ehrliche Versäumnisse selten bleiben. Copy überall: "missing counts as a full miss" statt "as 50%". "scored" = aufgedeckte + Missing-Runden. Beispielzahlen 9 commits · 8 reveals · 1 missing · 9 scored bleiben; Record-Wert im Beispiel neu rechnen.
- Tester: EINE Program-ID, Saison 1 startet 25.09. auf Mainnet mit den Testern als Kohorte (64 Blätter bis 27.11.). Kein Devnet-Hybrid. Mainnet-Deploy nur manuell (~2–3 SOL).
- SGT: Konten sind frozen (nicht NonTransferable), Mint bleibt bei Migration gleich. Spike 2: 15/15 Tests grün, 11 609 CU. Fixtures: fremdes SGT mit ersetztem Owner.
- SGT-Prüfung als Guard im Handler erlaubt (typisierte Konten, erster Aufruf vor jeder Zustandsänderung, Reviewer prüft) — in 01 §3 umgesetzt.
- Autoritäten: EIN Offline-Schlüssel für Upgrade, Kalender, Pause (kein Squads vor der Deadline). SECURITY.md sagt das; Spec §8.6 (Multisig) wird angepasst, Spec folgt der Realität.
- Betrieb: Cloudflare Worker `observed-resolver` (Workers Paid), stündlicher Lauf mit Zeitbudget, Priorität Referenz → Auflösung → cancel → score_entry. Hot Wallet 0,3 SOL, nur Gebührenzahler (keine Befugnis im Programm, am Code geprüft). Totmann-Schalter healthchecks.io (RUN 1 h / BACKLOG). Alarm bei Guthaben < 0,05 SOL. Reihenfolge: Dienst vor Kalender.
- Runden vorab anlegen: alle 64 (0,16 SOL Miete), Dinkelberg legt sie an, nachdem er die 64 Zeilen gelesen hat. Wortlaut-Änderung braucht keinen Chain-Eingriff (Text hängt nicht am Hash).
- Design-Grundrichtung "Nachtausgabe" (dunkel, schwere Literata, Wortmarke "Observed", Pencil #5B7CFA (4,5:1; 04 aktualisiert), keine gesperrten Mono-Versalien, Slider per Finger, Verteilung mit beschrifteten Crowd/You-Marken). Ziffernregel: Plex Sans ab ~40 px, Mono nur kleine Metazeilen (Plex Mono hat gepunktete Null).
- Kern-Moment "Zeitwechsel": eine Freigabe schließt heute und öffnet gestern. Animation erst nach bestätigtem Commit, nichts während des Wallet-Sheets; "gesendet" sichtbar unterscheidbar von "bestätigt". Erster Tag: Gestern-Seite leer beschriftet.
- Record-Screen mit ML-Sprache (Prototyp Observed-Record.html): Temperatur-Fit, Satz zu starken Calls, Loss-Kurve vs. Crowd, Vergleich bei Abweichung ≥15 Punkte, Kalibrierungskurve (Bänder <3 Runden ausgeblendet), Dropout = Missing. Early read ab 10 aufgedeckten Runden, voller Befund ab 21.
- Share-Feature kommt rein. Karten hell (Papier), 1200×675, ohne Wallet/Seeker-Nummer; Verify-Link opt-in mit Warnhinweis; kein Leaderboard; kein Blink. Kartentypen: Temperatur, Yesterday, Calibration, Today's seal (morgens versiegelt / nach 00:00 geöffnet), Against the crowd (nur an Tagen mit ≥15 Punkten Abweichung und niedrigerem Loss). Skia bestätigt (Schrift-Nachweis 0 % Layout-Abweichung; Font-Daten müssen über App-Lebensdauer gehalten werden). Share erst nach dem täglichen Kern.

## Review 18.09. (fünf Rollen, 929fcdc-Stand): 12 kritisch / 15 hoch / 16 mittel / 14 niedrig
- Vor Mainnet (25.09.): K1 Missing=10 000 bps + Copy; K2 Resolver vergisst Runden nach 7 Tagen nicht mehr, alle unscored Einträge aufgelöster Runden werden gescored; H1 decodeEntry-Offsets (176/179); H2 initialize nicht permissionless (Autorität fest oder atomar beim Deploy); H3 Spec §8.6 an SECURITY.md anpassen; K8 credentials.json raus.
- Vor der MWA-Schicht der App (Muster aus dem Spike-Client übernehmen): K3 Doppeltipp (useRef-Sperre), K4 Index vor Datensatz / atomar, K5 "Entry mit anderem Commitment" = missing statt failed-Schleife, K6 auth_token bei Ablauf löschen, H4 Datensatz kennt Wallet, H5 Abgleich beim Kaltstart, H6 Reveal-Fehler tötet Commit nicht, H7 neue Zahl bei Retry, H8 sealed-Zustand nicht im Screen.
- Vor der Deadline: K9–K12 (Copy "Window closed" nennt Missing-Folge, Reveal-only-Pfad, Skala ohne Vorbelegung + Seal erst nach Berührung, Result/Record-Zahlen konsistent), H9–H11 Android (Release-Signatur, Permissions raus, allowBackup=false im Gerüst), H12–H15, M-Liste (p aus Logpuffer/Zwischenablage).
- Akzeptiert und in SECURITY.md dokumentiert: K7 Salt ohne requireAuthentication (Prozesszugriff = kompromittiertes Gerät, Salt gibt nur die eigene Antwort frei, kein Geld; zweite Biometrie pro Tag nicht gewollt); Round/Player nie schließbar (0,218 SOL/Saison); Priority-Fee-Schätzung manipulierbar (gedeckelt).
- Gut gehalten: Commitment-Aufbau, SGT-Prüfung (Fake-Mint scheiterte), Oracle-Fenster (verkettete Pyth-Nachrichten), Seeds, Persistenz vor Wallet. Gemessen: reveal+commit 640 B / 42 882 CU; 10er-Score-Batch 1 072 B, Grenze 12.

## Prototypen (outputs dieser Session)
- Observed-Nachtausgabe.html, Observed-Seal-Konzepte(-2).html, Observed-Zeitwechsel.html, Observed-Solana-Seal-Momente.html (7 Konzepte), Observed-Record.html (inkl. Share-Vorschau, 5 Kartentypen). ACHTUNG: Record-Prototyp rechnet Missing noch als 0,250 → anpassen.
- Figma: https://www.figma.com/design/9mnJXjOEBU4N1ufTWHHNJl (überholt).

## Offen
- Seal-Moment final wählen (nach Spike 3 / T2; Astra- und ChatGPT-Varianten ausstehend). Oracle-Zeile "This phone posted the oracle reading" mit entscheiden (Spec-Vorschlag 12).
- Spike 3 manuell (T2 entscheidend: eine oder zwei Freigaben; Unterbrechungsdauer stoppen; Bildschirm sperren während Sheet).
- spec-changes-2026-09-17.md (12 Vorschläge) übernehmen — Dinkelberg.
- Worker-Einrichtung: Workers Paid, Secrets (PYTH_API_KEY neu, HOT_WALLET_KEY nur via wrangler secret put, RPC_URL Helius, HEALTHCHECK_RUN_URL/BACKLOG_URL), Devnet-Testlauf mit Messung der Tx-Größe → dann Kalender.
- Expo-Token und Pyth-Key erneuern (standen im Chat).
- Echo: GPS-Koordinaten mit Schlüssel aus öffentlichem APK entschlüsselbar; nach Deadline Konten schließen/Hinweis, expo-Link entfernen.
