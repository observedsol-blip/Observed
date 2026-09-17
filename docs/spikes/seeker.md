# Spike 3 — Seeker / MWA (Vorbereitung 17.09.2026, Durchführung: Owner am Gerät)

Fragen (Spec §3 „Aufdecken“, 01 §4, 02 MWA-Lebenszyklus):
1. Zeigt Seed Vault Wallet für **eine** Transaktion mit `reveal(R−1) + commit(R)` **eine** Freigabe?
2. Liegt der verschlüsselte Reveal-Datensatz **vor** der Wallet-Anfrage im Speicher?
3. App nach dem Absenden gekillt → wird beim Neustart über den `Entry` korrekt „committed“ erkannt, **ohne** neu zu versiegeln?
4. `unknown`/`failed` → `Entry` lesen; Retry nutzt **dasselbe** Commitment.

## Aufbau (nur Spike, getrennt vom Produkt)
| Teil | Ort | Hinweis |
|---|---|---|
| Programm `seal_spike` | `spikes/seeker/program`, **Devnet** `2yoZYJMfBkBhtB6cdRJQQKrX3Me5zFZyT7y4P9kDkRxQ` | kein SGT-Gating, keine Runden/Fenster; Commitment-Layout wie Spec §4 mit Platzhaltern (`terms_hash = 0`, `sgt_mint = beneficiary`). Nie auf Mainnet. |
| App | `spikes/seeker/app` (Expo SDK 54, RN 0.81.5, MWA 2.2.5, web3.js 1.98.4) | Package `xyz.observed.spike3`, Devnet, `allowBackup=false`, SecureStore (Android-Keystore-AES) vom Backup ausgeschlossen |
| APK | `C:\Users\Admin\Downloads\observed-spike3.apk` | Release-Build, Debug-Signatur (nur Test) |

Programm-Tests (LiteSVM): `reveal(1) + commit(2)` in einer Tx = **16 499 CU**; falscher Salt → `CommitmentMismatch`; Testvektor Rust = App-Selbsttest.
Deploy-Kosten Devnet: 0,676 SOL (132 640 Bytes).

## Anleitung am Seeker

### Vorbereitung (einmal, ~10 Min)
1. **APK aufs Gerät:** `C:\Users\Admin\Downloads\observed-spike3.apk` per USB-Kabel (Dateiübertragung) oder Quick Share/Drive auf den Seeker kopieren, in „Dateien“ antippen, „Installation aus unbekannten Quellen“ für die Dateien-App erlauben, installieren.
2. **Seed Vault Wallet auf Devnet:** In der Wallet unter Einstellungen nach „Netzwerk / Network / Developer“ suchen und Devnet wählen, falls vorhanden. **Notieren:** Gibt es eine Devnet-Einstellung? (ja / nein / wo)
3. App „Observed Spike 3“ öffnen. Oben im Log muss stehen: `APP START — self-test commitment: PASS`. **Notieren:** PASS/FAIL.
4. **Connect wallet** tippen → Wallet-Sheet → freigeben. **Notieren:** Wie viele Sheets? Zeigt das Sheet ein Netzwerk an (Devnet/Mainnet)? Adresse erscheint oben.
5. **Devnet-SOL holen:** Adresse aus der App (lange antippen/abschreiben) auf https://faucet.solana.com (Devnet, 1 SOL) eintragen. „balance“ in der App aktualisiert sich nach der nächsten Aktion.
   *Falls die Wallet kein Devnet kann:* nur Test T8 („Sign only“) ist dann aussagekräftig — trotzdem durchführen und notieren.

### Tests (Reihenfolge einhalten; nach jedem Test „Copy log“ nicht nötig — am Ende reicht einmal)
| # | Was tun | Was notieren |
|---|---|---|
| **T1** | Runde wie vorgeschlagen lassen, p mit −5/+5 auf 40 %, **SEAL** tippen, freigeben. | Anzahl Freigaben/Sheets; Text im Sheet (steht dort „1 transaction“, Programmname, Netzwerk?); Record-Zeile: Status (soll `committed`), „persisted→wallet … ms“ (muss > 0 sein). |
| **T2 — Kernfrage** | **round +1**, p beliebig, **SEAL**, freigeben. Die Tx enthält jetzt `reveal(vorige) + commit(neue)` (Log: `tx = reveal(…) + commit(…)`). | **Anzahl Freigaben: 1 oder 2?** Sheet-Text wörtlich (Screenshot ideal). Danach **Reconcile** → vorige Runde soll `revealed` zeigen. |
| **T3 — Kill nach Absenden** | **round +1**, **SEAL**, freigeben und **sofort** (≤ 1 s) die App aus den „Zuletzt verwendet“ wegwischen. App neu öffnen → **Connect wallet**. | Status der Runde vor dem Reconnect (sichtbar nach Öffnen) und nach Connect (Log `reconcile … → committed (Entry matches commitment)`). Musste neu freigegeben werden? Wurde **nicht** neu versiegelt (kein zweites `PERSISTED` für die Runde)? |
| **T4 — Kill vor Freigabe** | **round +1**, **SEAL**, wenn das Wallet-Sheet erscheint: **nicht** freigeben, Home-Taste, App wegwischen. Neu öffnen → **Connect wallet**. | Log soll `pending → failed (no Entry on chain)` zeigen. Dann **SEAL** für **dieselbe** Runde erneut → Record-Notiz „retry of same commitment“ → freigeben → `committed`. Notieren: Commitment gleich geblieben? (Log/Record zeigt keinen neuen Salt) |
| **T5 — unknown manuell** | Eine `committed`-Runde wählen (round −/+), **Mark round … unknown**, dann **Reconcile**. | Log `unknown → committed (Entry matches commitment)`. |
| **T6 — Ablehnen** | **round +1**, **SEAL**, im Sheet **ablehnen**. | Fehlermeldung im Log (Text), Status danach (`failed` nach Reconcile). Keine automatische Neuversiegelung. |
| **T7 — Offline** | Flugmodus an, **round +1**, **SEAL**. Danach Flugmodus aus, **Reconcile**, dann **SEAL** dieselbe Runde erneut. | Kommt das Wallet-Sheet überhaupt? Log-Text; Status vor/nach Reconcile; Retry-Ergebnis. |
| **T8 — Sign only** | **round +1**, **Sign only (count sheets)**, freigeben. | Anzahl Freigaben für reines Signieren (Referenz, falls Devnet-Senden nicht geht). |
| **T9 — optional: Neuinstallation** | App deinstallieren, APK neu installieren, öffnen, **Connect**. | Sind Records weg? (erwartet: ja → offene Antwort würde „missing“; bestätigt Onboarding-Satz „Reinstalling can forfeit a pending answer“) |

### Am Ende
1. **Copy log** tippen und den Inhalt hier in den Chat einfügen (enthält Zeiten, Status, Tx-Signaturen gekürzt; keine Schlüssel).
2. Die Notizen aus der Tabelle dazu (vor allem T2: 1 oder 2 Freigaben, Sheet-Text).
3. Screenshots vom Wallet-Sheet bei T1 und T2, falls möglich.

Ich trage die Ergebnisse dann unten ein und leite die Folgen für Spec §3 und 03 ab („zeigt das Wallet zwei Sheets, wird die Copy zweizeilig, nicht das Produkt zweiteilig“).

## Ergebnisse
_wird nach der Durchführung eingetragen_
