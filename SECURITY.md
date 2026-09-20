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
- **Salt ohne Biometrie-Bindung.** Der Reveal-Salt liegt AES-256-GCM-verschlüsselt im Android-Keystore, aber ohne `requireAuthentication`. Wer Zugriff auf den entsperrten App-Prozess hat, kann ihn lesen. Begründung: Prozesszugriff heißt kompromittiertes Gerät; der Salt gibt nur die eigene, noch nicht aufgedeckte Antwort frei, kein Geld; eine zweite biometrische Abfrage pro Tag widerspricht „eine Geste am Tag". Backup und Gerätetransfer sind ausgeschlossen (`allowBackup=false` plus Backup-Regeln, im Release-APK verifiziert).
- **Der erste Einreicher wählt den Messzeitpunkt (Regel O1, Owner-Entscheidung 19.09.2026).** Innerhalb von 60 s nach Referenz- und Ergebniszeit fixiert die erste gültige Einreichung, was im benannten Pyth-Konto steht (höchstens 60 s alt). Das ist nicht verhindert, sondern gespeichert (Wert, Update-Slot, Einreichungs-Slot, Zeit, Einreicher) und aus dem Ledger nachprüfbar. Gemessen: An 11–30 von 90 Tagen hätte diese Wahl das Ergebnis drehen können (docs/HANDOFF.md). Kleinere Fenster wurden verworfen, weil der schnelle 5-s-Takt der Konten nicht dokumentiert ist und ein ausbleibender Takt sonst ganze Runden kostet.
- **`Round` und `Player` sind nie schließbar.** Rund 0,273 SOL pro Saison bleiben als Miete gebunden (64 × 486 B seit Terms v3; vorher 0,218), dazu 0,0013 SOL pro Gerät für `Player`. Eine `close_round`-Instruktion wäre neue Angriffsfläche für eine Ersparnis unterhalb der Reviewkosten.
- **Priority-Fee-Schätzung ist beeinflussbar.** Der Resolver liest die jüngsten Fees der betroffenen Konten; wer dorthin schreibt, kann sie anheben. Gedeckelt auf 1 000 000 µLamports pro Transaktion, Schaden also auf wenige Lamports begrenzt.
- **Keine Rotation der Autoritäten.** `calendar_authority` und `pause_authority` lassen sich nicht umsetzen; ein Schlüsselverlust ist nur über ein Programm-Upgrade heilbar.

**Threat model:** docs/01-PROGRAM.md §5b. **Tests:** `anchor test` with fixtures in `tests/fixtures/` (account snapshots, no keys).

**Report a vulnerability:** _contact_ — please do not open a public issue for exploitable findings.
