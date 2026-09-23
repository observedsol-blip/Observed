# Security

**Program ID (mainnet):** _to be filled after deploy_
**Verifiable build:** `solana-verify verify-from-repo -um --program-id <ID> https://github.com/<org>/observed --commit-hash <sha>`
**Authorities** (hackathon setup, stated as it is — no multisig):
- calendar_authority: _address_ — a single key, kept offline; acts once per season, before the first round, to set the calendar root
- pause_authority: _address_ — a single key; can only block new commits, never reveal, resolve, score or close
- upgrade authority: _address_ — **a single key, held offline by the owner**, not a multisig. Any upgrade is announced here before it happens.

**Why no multisig (17.09.2026):** a Squads setup costs days we do not have before the submission and buys nothing a single offline key does not, at this size. This is a named trust assumption, not a claim of decentralisation: whoever holds that key can replace the program. Revisited after 9 Oct 2026.

**Trust assumptions, stated plainly:** the upgrade authority can replace program code (announced, never silent); round creation is permissionless and only possible inside the published calendar (Merkle root on-chain, see CALENDAR.md); the calendar authority sets that root once per season; the cron is a convenience, not an authority — anyone with Pyth access (API key) can post evidence and call `set_reference`/`resolve`, and the program verifies the evidence regardless of who posts it; if nobody posts in time, the round ends as NO_RESOLVE. Solana Mobile controls the Seeker Genesis Token (freeze authority, permanent delegate); Observed cannot change that.

**Bekannt und akzeptiert (Review 18.09.2026, Owner-Entscheidung):**
- **Geheimnis ohne Biometrie-Bindung.** Das Saison-Geheimnis, aus dem jeder Reveal-Salt abgeleitet wird, liegt in `expo-secure-store`: auf Android in SharedPreferences, verschlüsselt mit einem Schlüssel aus dem Android-Keystore, aber **ohne** `requireAuthentication`. Wer Zugriff auf den entsperrten App-Prozess hat, kann es lesen. Begründung: Prozesszugriff heißt kompromittiertes Gerät; das Geheimnis gibt nur die eigene, noch nicht aufgedeckte Antwort frei, kein Geld; eine zweite biometrische Abfrage pro Tag widerspricht „eine Geste am Tag".
- **Backup und Gerätetransfer — der Mechanismus, genau benannt.** Zwei Dinge wirken: `android:allowBackup="false"` (seit 21.09.2026 in `app/app.json`) und die Backup-Regeln von `expo-secure-store`, die `sharedpref/SecureStore` sowohl aus `cloud-backup` als auch aus `device-transfer` ausschließen (`node_modules/expo-secure-store/android/src/main/res/xml/`). **Noch nicht am Artefakt geprüft:** Es gibt bis heute kein Release-APK. Vor der Einreichung wird das Manifest des echten Release-APK mit `aapt dump badging` bzw. entpackt geprüft und das Ergebnis hier eingetragen; bis dahin ist das eine Aussage über die Konfiguration, keine Messung. *(Hier stand bis zum 21.09.2026, dies sei „im Release-APK verifiziert", und `allowBackup=false` sei gesetzt. Beides stimmte nicht — gefunden im eigenen Audit, korrigiert statt stillschweigend repariert.)*
- **Der Backup-Code ist ein exportierbares Geheimnis (E2, 21.09.2026).** Weil Seed Vault keine Nachrichten signieren kann, ist das Saison-Geheimnis zufällig und lokal; damit eine Neuinstallation offene Antworten nicht verfallen lässt, kann der Spieler es als 64 Hex-Zeichen herauskopieren. Wer diesen Code **und** die zugehörige Wallet-Adresse hat, kann die versiegelten Antworten dieses Geräts vor dem Aufdecken nachrechnen — 21 Kandidaten pro Runde. Genau das sagt die Oberfläche beim Kopieren: „Copied. Keep it private — with it, someone could see your sealed answers before you reveal them." Es hängt kein Geld daran, und ohne die Wallet öffnet der Code nichts.
- **Der erste Einreicher wählt den Messzeitpunkt (Regel O1, Owner-Entscheidung 19.09.2026).** Innerhalb von 60 s nach Referenz- und Ergebniszeit fixiert die erste gültige Einreichung, was im benannten Pyth-Konto steht (höchstens 60 s alt). Das ist nicht verhindert, sondern gespeichert (Wert, Update-Slot, Einreichungs-Slot, Zeit, Einreicher) und aus dem Ledger nachprüfbar. Gemessen: An 11–30 von 90 Tagen hätte diese Wahl das Ergebnis drehen können (docs/HANDOFF.md). Kleinere Fenster wurden verworfen, weil der schnelle 5-s-Takt der Konten nicht dokumentiert ist und ein ausbleibender Takt sonst ganze Runden kostet.
- **`Round` und `Player` sind nie schließbar.** Rund 0,273 SOL pro Saison bleiben als Miete gebunden (64 × 486 B seit Terms v3; vorher 0,218), dazu 0,0013 SOL pro Gerät für `Player`. Eine `close_round`-Instruktion wäre neue Angriffsfläche für eine Ersparnis unterhalb der Reviewkosten.
- **Priority-Fee-Schätzung ist beeinflussbar.** Der Resolver liest die jüngsten Fees der betroffenen Konten; wer dorthin schreibt, kann sie anheben. Gedeckelt auf 1 000 000 µLamports pro Transaktion, Schaden also auf wenige Lamports begrenzt.
- **Keine Rotation der Autoritäten.** `calendar_authority` und `pause_authority` lassen sich nicht umsetzen; ein Schlüsselverlust ist nur über ein Programm-Upgrade heilbar.

**npm audit, aufgeteilt (23.09.2026, `app/`):** 23 Befunde — 14 moderate, 9 high. Dahinter
stecken **vier** echte Advisories; die übrigen 19 Pakete sind nur betroffen, weil sie auf eines
davon zeigen. Nichts ist aktualisiert worden; das hier ist der Befund, keine Maßnahme.

| Advisory | Paket | wo es sitzt | landet im APK? |
|---|---|---|---|
| ICNS/JXL/HEIF-Parser, Endlosschleife (high, ×2) | `image-size` | nur unter `metro` | **nein** |
| `sourceMappingURL`: Pfad-Traversal und XSS (high ×2, moderate ×2) | `postcss` | nur unter `@expo/metro-config` | **nein** |
| Filter sind O(Tiefe²), DoS (moderate) | `stream-json` | nur `jayson/lib/utils.js` — die **Server**-Hälfte | **nein** |
| fehlende Puffergrenze in v3/v5/v6, wenn `buf` übergeben wird (moderate) | `uuid` | `jayson/node_modules/uuid@8.3.2` und `xcode` | **ja**, über `jayson` |

**Nur Build und Werkzeug, 13 Pakete:** `@expo/cli`, `@expo/config`, `@expo/config-plugins`,
`@expo/metro`, `@expo/metro-config`, `@expo/prebuild-config`, `metro`, `metro-config`,
`metro-transform-worker`, `postcss`, `image-size`, `xcode`, `stream-json`. Sie laufen auf dem
Rechner, der baut, und sind in keinem Bundle. Das schließt `stream-json` ein — siehe unten.

**Im APK, 10 Pakete:** `expo`, `expo-constants`, `expo-asset`, `expo-notifications`,
`expo-updates`, `expo-manifests`, `@solana/web3.js`, `@solana-mobile/mobile-wallet-adapter-protocol-web3js`,
`jayson`, `uuid`. **Von diesen zehn hat keines ein eigenes Advisory.** Die sechs Expo-Pakete
sind ausschließlich über `@expo/config` → `@expo/config-plugins` → `xcode` → `uuid` markiert,
also über eine Kette, die nur beim Bauen läuft. `@solana/web3.js` und das Wallet-Adapter-Paket
sind über `jayson` markiert.

**Der eine Pfad, der wirklich mitfliegt — und was daran gemessen ist:**
`app/node_modules/@solana/web3.js/lib/index.native.js` importiert genau
`jayson/lib/client/browser`. Von dort aus sind — durch die `require`-Kette verfolgt — exakt zwei
Dateien erreichbar (`client/browser/index.js`, `generateRequest.js`) und genau ein fremdes
Paket: `uuid`. **`stream-json` ist von dort aus nicht erreichbar**, es hängt allein an
`jayson/lib/utils.js`, das der Browser-Client nicht anfasst.

`uuid` liegt also wirklich im Bundle. Benutzt wird es an allen drei Stellen als `require('uuid').v4`
und **ohne Argument** aufgerufen. Das Advisory betrifft `v3`, `v5` und `v6`, und auch dort nur,
wenn ein `buf` übergeben wird. **Der verwundbare Pfad wird nicht benutzt.**

**Ist ein Update ohne Bruch möglich?** Nein, in beide Richtungen nicht:
- Für `uuid` meldet npm `fixAvailable: false`. `jayson@4.3.0` verlangt `uuid: ^8.3.2`, die
  behobene Fassung ist `≥ 11.1.1` — das geht nur, wenn `jayson` seine Abhängigkeit ändert oder
  `@solana/web3.js` `jayson` ablegt. Ein `override` wäre möglich, hieße aber, eine
  Hauptversion unter eine Bibliothek zu schieben, die nicht darauf getestet ist, für eine
  Funktion, die wir nicht aufrufen.
- Für alles Expo-seitige lautet der Vorschlag `expo@57.0.24`, also **zwei Hauptversionen** über
  dem aktuellen `expo@54.0.37`, `isSemVerMajor: true`. Nicht drei Tage vor einem Tester-Build.

**Empfehlung:** nichts vor dem 9. Oktober anfassen. Danach der Reihe nach prüfen, ob
`@solana/web3.js` inzwischen ohne `jayson` auskommt — das würde `uuid` und `stream-json` in
einem Zug aus dem Baum nehmen.

**Threat model:** docs/01-PROGRAM.md §5b. **Tests:** `anchor test` with fixtures in `tests/fixtures/` (account snapshots, no keys).

**Report a vulnerability:** _contact_ — please do not open a public issue for exploitable findings.
