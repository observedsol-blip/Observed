# OBSERVED — Tech Stack v1 (festgeschrieben)

Nichts Neues. Alles hier ist entweder aus Echo bekannt oder Standard im Solana-Mobile-Ökosystem.

## On-chain
- **Anchor** (Rust), ein Programm, Devnet → Mainnet in Woche 2. Upgrade-Autorität bleibt (Beta), Autoritäten werden in App-Settings und README veröffentlicht.
- **Token-2022 / spl-token-2022** für SGT-Prüfung (`StateWithExtensions`, `TokenGroupMember`). Versionen pinnen.
- **pyth-solana-receiver-sdk** (`PriceUpdateV2`, `VerificationLevel::Full`) im Programm; **@pythnetwork/pyth-solana-receiver** im Resolver-Client; **Pyth Benchmarks** für historische Updates, hinter eigenem Proxy (API-Key, Rate-Limit).
- Keine Tuktuk-Integration in v1; Cron als Fallback-Resolver (siehe Betrieb).

## App
- **React Native + Expo** (wie Echo), Android-only, Target Seeker (Android 15/16 nach MR7 prüfen).
- **Mobile Wallet Adapter** (`@solana-mobile/mobile-wallet-adapter-protocol-web3js`), lokaler Flow gegen das Seed Vault Wallet; kein Seed-Vault-SDK (das ist für Wallets).
- **@solana/web3.js** (Versioned Tx, Address Lookup Tables nur falls Pyth-Posting sie braucht), Anchor-Client-IDL.
- Lokale Daten: Reveal-Datensatz (Runde, p, Salt, Commitment, Tx-Status) verschlüsselt mit AES-GCM, Schlüssel im Android Keystore; `android:allowBackup="false"` bzw. Backup-Regeln, die diese Datei ausschließen. Vor der Wallet-Anfrage schreiben.
- **Push:** Firebase Cloud Messaging; drei Nachrichten (Mitternacht, eine lokale Stunde vor Schluss, Mittag). Kein Backend-Zustand über Push-Tokens hinaus.
- **Telemetrie:** Sentry für Fehler; ein Ereignis „result screen viewed“ (der einzige Beleg, dass jemand das Ergebnis gesehen hat). Keine Wallet-Adressen in Events.
- Schriften: Literata (Frage, Ablese-Satz), IBM Plex Mono (Ziffern), IBM Plex Sans (UI) — als Assets gebündelt, nicht nachgeladen.
- **Widget:** `react-native-android-widget` (Expo-Config-Plugin) oder ein kleines natives Modul; Inhalt aus einem lokalen JSON-Cache, den die App bei Öffnen, Push und per WorkManager (30 Min) schreibt. RemoteViews können keine gebündelten Schriften laden: Hero-Zeile als Bitmap rendern (Literata) oder System-Serif; Sichtprüfung auf dem Seeker entscheidet. Kein RPC aus dem Widget.

## MWA-Lebenszyklus (App)
- `authorize` einmal; `auth_token` verschlüsselt cachen; jede Session mit `reauthorize`, bei Fehler frisch `authorize` (kein stiller Absturz).
- Wallet-Wechsel oder anderes Konto: Genesis-Prüfung neu, Player wird über die Mint gefunden, nicht über die Wallet.
- App-Kill zwischen Authorize und Sign: Reveal-Datensatz ist bereits persistiert (Client-Reihenfolge in 01 §4); beim Neustart `Entry` lesen, nie doppelt versiegeln.
- `deauthorize` in Settings; Deep-Link-/Remote-MWA nicht benutzt (nur lokaler Flow).
- Demovideo zeigt den Wallet-Sheet ungeschnitten.

## Transaktions-Landing im Fenster
- Priority Fee über Helius Priority-Fee-API pro Sendung; Compute-Budget aus Simulation + 20 %.
- Retry-Schleife bis Fensterschluss: neue Blockhash, gleiche Instruktionen, exponentielles Backoff; Status `unknown` → `Entry` prüfen, nie neu versiegeln.
- Ab 11:50 UTC warnt der Client („Network is busy — seal now“); nach Schluss ist es „Window closed“, kein Retry.
- Betriebszahlen ab Devnet-Tag 1 loggen: Runden aufgelöst / NO_RESOLVE, Median-Verzögerung der Auflösung, Anteil Commits mit Retry. Diese drei Zahlen kommen ins Deck.

## Backend (minimal, dokumentiert als Vertrauensannahme)
- **Cron** (12:05 UTC: Benchmarks-Update für die Referenz posten, `set_reference`; 00:05 UTC: Ergebnis-Update posten, `resolve`; außerdem `create_round` für den Folgetag und nach `reveal_close` `score_entry` für Missing). Fällt er aus, kann jeder es tun; die App bietet es als optionalen Knopf an (mehrere Freigaben, im UI so gesagt).
- **Benchmarks-Proxy**: eine Route, API-Key serverseitig, Cache pro Runde.
- **Push-Sender**: FCM-Topics pro Zeitzone-Bucket für die lokale Erinnerung.
- Hosting: ein kleiner Node-Service (Fly/Railway/Cloud Run), Secrets nicht im Repo.
- Cron ruft nach `reveal_close` außerdem `score_entry` für alle nicht aufgedeckten Einträge der Runde (Missing = 2 500), damit der Verlauf ohne Zutun des Spielers vollständig wird.

## RPC / Infra
- **Helius** RPC (Mainnet + Devnet), Webhooks optional für Monitoring von `resolve`/`cancel`.
- Explorer-Links in der App (Evidence-Referenz pro Runde: Tx, Feed, Zeitstempel, Resolver).

## Reihenfolge Bau
Schleife (Commit/Reveal/Resolve) → Result und Record → Widget → Push → Mainnet. Das Widget kommt vor Mainnet, weil es Teil dessen ist, was die Jury auf dem Gerät sieht.

## Wiederverwendbare Module (eigene READMEs)
- `crates/sgt-verify`: Token-2022-Gruppenprüfung für Seeker Genesis Tokens, nutzbar in jedem Anchor-Programm.
- `crates/pyth-first-after`: „erstes Pyth-Update nach Zeitpunkt T“-Prädikat mit Full-Verifikation, nutzbar für jede zeitpunktbasierte Auflösung.

## Öffentliche Seiten (statisch, GitHub Pages, kein Backend)
- `calendar`: die versiegelte Sequenz — pro Tag Hash, nach Auflösung Frage + Beweis gegen `Config.calendar_root`, ein „verify“-Knopf, der den Merkle-Beweis im Browser nachrechnet (reine Client-Logik, liest RPC).
- `status`: Betriebszahlen und Kohorten-Trichter aus einem JSON, das der Cron stündlich schreibt (Runden, aufgelöst / NO_RESOLVE, Median-Verzögerung, Retry-Anteil; N erster Commit, M erster Reveal, K an drei Tagen zurück, D7). Keine Wallet-Adressen.
- Beide Seiten sind die Belege, auf die das Deck verlinkt.

## Repo
```
observed/
  programs/observed/        Anchor-Programm
  crates/sgt-verify/        wiederverwendbar
  crates/pyth-first-after/  wiederverwendbar
  tests/                    Anchor-Tests + Fixtures (SGT, Pyth)
  app/                      Expo-App
  services/resolver/        Cron + Benchmarks-Proxy + Push
  docs/                     00-SPEC … 05-LAUNCH-PLAN
  site/                     calendar + status (statisch)
  CALENDAR.md               Erzeugungsregeln, die kanonischen Terms-Blobs der Saison (bis 64), Merkle-Wurzel (= Config.calendar_root)
  SECURITY.md               Autoritäten, Vertrauensannahmen, Kontakt
```
- GitHub von Tag 1, PR-Reviews wie bei Echo, CI: Anchor-Tests + `cargo clippy -D warnings` + App-Build + gitleaks (Secret-Scan). Reproduzierbarer Build mit `solana-verify`; SECURITY.md mit Program-ID, Autoritäten (Multisig-Adressen), Bedrohungsmodell-Link, Kontakt.
- Schlüssel: Autoritäten in Squads-Multisig (Hardware-Wallet + Seeker + Backup); Cron-Key als Hot Wallet mit Kleinstbetrag, rotierbar; nichts davon im Repo oder im Arbeitsverzeichnis von Claude Code.
- Umgebungen: `devnet` (Woche 1, Tester), `mainnet` (ab Woche 2, Kohorte separat ausgewiesen).

## Betrieb
- Sentry-Alerts; ein Dashboard mit Commits/Reveals/Resolves/Cancels pro Tag.
- Runbook: Cron ausgefallen → manuell `resolve`; Benchmarks down → Runde läuft in `cancel` (NO_RESOLVE), nie improvisieren; Pyth-Ausreißer → Regel ist Regel, Screenshot des Updates in der Evidence-Ansicht.

## Bewusst nicht
Kein Tuktuk-Worker, kein Hintergrund-Worker für Chain-Arbeit (WorkManager nur für den Widget-Cache), kein Fee-Payer-Relay, kein Token, kein Off-chain-Indexer für Histogramme (liegen on-chain).
