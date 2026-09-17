# Security

**Program ID (mainnet):** _to be filled after deploy_
**Verifiable build:** `solana-verify verify-from-repo -um --program-id <ID> https://github.com/<org>/observed --commit-hash <sha>`
**Authorities** (all Squads multisig, hardware-backed):
- question_authority: _multisig address_
- pause_authority: _multisig address_ (can only block new commits)
- upgrade authority: _multisig address_ — any upgrade is announced here before it happens

**Trust assumptions, stated plainly:** the upgrade authority can replace program code (announced, never silent); the question authority can create rounds only inside the published calendar (Merkle root on-chain, see CALENDAR.md); the resolver cron is a convenience — anyone can post evidence and resolve.

**Threat model:** docs/01-PROGRAM.md §5b. **Tests:** `anchor test` with fixtures in `tests/fixtures/` (account snapshots, no keys).

**Report a vulnerability:** _contact_ — please do not open a public issue for exploitable findings.
