# Security

**Program ID (mainnet):** _to be filled after deploy_
**Verifiable build:** `solana-verify verify-from-repo -um --program-id <ID> https://github.com/<org>/observed --commit-hash <sha>`
**Authorities** (hackathon setup, stated as it is — no multisig):
- calendar_authority: _address_ — a single key, kept offline; acts once per season, before the first round, to set the calendar root
- pause_authority: _address_ — a single key; can only block new commits, never reveal, resolve, score or close
- upgrade authority: _address_ — **a single key, held offline by the owner**, not a multisig. Any upgrade is announced here before it happens.

**Why no multisig (17.09.2026):** a Squads setup costs days we do not have before the submission and buys nothing a single offline key does not, at this size. This is a named trust assumption, not a claim of decentralisation: whoever holds that key can replace the program. Revisited after 9 Oct 2026.

**Trust assumptions, stated plainly:** the upgrade authority can replace program code (announced, never silent); round creation is permissionless and only possible inside the published calendar (Merkle root on-chain, see CALENDAR.md); the calendar authority sets that root once per season; the cron is a convenience, not an authority — anyone with Pyth access (API key) can post evidence and call `set_reference`/`resolve`, and the program verifies the evidence regardless of who posts it; if nobody posts in time, the round ends as NO_RESOLVE. Solana Mobile controls the Seeker Genesis Token (freeze authority, permanent delegate); Observed cannot change that.

**Threat model:** docs/01-PROGRAM.md §5b. **Tests:** `anchor test` with fixtures in `tests/fixtures/` (account snapshots, no keys).

**Report a vulnerability:** _contact_ — please do not open a public issue for exploitable findings.
