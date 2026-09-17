# Spike 2 — Seeker Genesis Token (17.09.2026)

Frage: Lässt sich „ein Eintrag pro physischem Seeker“ (Spec §4, 01 §3 `commit` Punkte 2–4) mit den festen Mainnet-Konstanten sauber prüfen — ohne `UncheckedAccount`, ohne Build-Features pro Netzwerk — und hält die Bedrohungsmodell-Zeile „Mehrfachstimme durch Migration“?

Code: `spikes/sgt/program` (Anchor 1.2, Instruktion `commit_probe` = SGT-Prüfung + Entry-PDA `["entry", round_id, sgt_mint]`), Tests `spikes/sgt/program/programs/sgt_spike/tests/sgt.rs` (LiteSVM), Fixture-Skript `spikes/sgt/scripts/fetch-fixtures.ts`, Fixtures `tests/fixtures/sgt/`.

## Konstanten gegen echte Daten geprüft
Owner-Seeker (nur gelesen, nichts gespeichert, keine Kennung in diesem Repo):
| Prüfung | Ergebnis |
|---|---|
| Mint gehört Token-2022 | ja |
| `TokenGroupMember.group` = `GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te` | ja |
| `TokenGroupMember.mint` = Mint selbst | ja |
| Mint-Authority = `GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4` | ja |
| supply / decimals | 1 / 0 |
| Token-Konto: Owner = Wallet, amount | ja / 1 |
| Token-Konto `state` | **`frozen`** |

Gruppen-Konto `GT22…` (Mainnet, 17.09.): Token-2022-Mint mit `TokenGroup` (size 120 903, maxSize 1 000 000), `GroupPointer`/`MetadataPointer` auf sich selbst, Name „Seeker Genesis Token“. Mint-, Freeze- und Close-Authority sowie Update-Authority = `GT2z…`.

## Befund: SGTs sind „frozen“, nicht „non-transferable“
- Die SGT-Mint hat **keine** `NonTransferable`-Extension. Extensions der Mint: `MetadataPointer`, `PermanentDelegate` (`GT2z…`), `MintCloseAuthority` (`GT2z…`), `GroupMemberPointer`, `TokenGroupMember`. Freeze-Authority `GT2z…`.
- Das Token-Konto ist `frozen`. Bewegt wird der Token über den Permanent Delegate von Solana Mobile.
- **Folge:** Die Prüfung darf `state == Initialized` **nicht** verlangen — sonst wird jeder echte SGT abgelehnt. 01 §3 `commit` Punkt 3 ist entsprechend korrigiert (Commit `6ee4bc1`). Test `fixture_is_a_frozen_real_sgt` + `real_sgt_is_accepted_and_entry_is_created`.
- **Vertrauensannahme:** Solana Mobile kann SGTs einfrieren, verschieben und (bei supply 0) die Mint schließen. Außerhalb unserer Kontrolle; in 01 §5b und SECURITY.md benannt.

## Migration
- Quelle: Solana Mobile Docs, „Seeker Genesis Token“ — https://docs.solanamobile.com/marketing/engaging-seeker-users : „The mint address of the SGT remains the same when it is transferred.“ Transfer nur „on a permissioned basis within the Seed Vault Wallet“ beim Wechsel des Primärkontos.
- Beobachtung passt dazu: Permanent Delegate + Freeze-Authority = `GT2z…`.
- **Bedrohungsmodell-Zeile „Mehrfachstimme durch SGT-Migration“ hält**: Entry-PDA hängt an der Mint. Test `migrated_sgt_cannot_vote_twice_in_same_round`: gleiche Mint, Token-Konto auf neue Wallet umgeschrieben → zweiter Commit in derselben Runde scheitert (`already in use`), nächste Runde geht. Das alte Konto mit amount 0 scheitert an `WrongAmount`.

## Fixtures (`tests/fixtures/sgt/`)
Ein **fremdes** SGT, gewählt aus den letzten Transaktionen am Gruppen-Konto (Mitglied #120 905), read-only von Mainnet am 17.09.2026:
| Datei | Inhalt |
|---|---|
| `sgt-group.json` | Gruppen-Konto `GT22…`, byte-genau (592 Bytes) |
| `sgt-mint.json` | SGT-Mint, byte-genau (450 Bytes) |
| `sgt-token-account.json` | Token-Konto (170 Bytes), byte-genau **außer**: Owner (Bytes 32–64) ersetzt durch den Test-Key `ed25519-seed = sha256("observed/test/sgt-owner")` → `GicWFwQPee2WvrbqxRoK4yjoGCpaDUnSt5sdSAejvzjN`; Konto-Adresse ersetzt durch `sha256("observed/test/sgt-token-account")` → `Ngvup8HSSNEiJ4pD22tCuGQaZMZKK4wu8y7rE67M9Bp`. `state` = `frozen` wie auf Mainnet. |

Keine fremde oder eigene Wallet-Adresse im Repo. Die Ersetzungen stehen auch im `note`-Feld jeder Datei und im Skript.

## Programm (Spike)
- Konten: `InterfaceAccount<Mint>` mit `mint::token_program = token_program`, `InterfaceAccount<TokenAccount>` mit `token::mint`, `token::authority = player`, `token::token_program`; `Program<Token2022>`; Entry mit `init` + Seeds. Keine `UncheckedAccount`, keine `remaining_accounts`, kein `unwrap`/`expect` im Programm.
- `verify_sgt`: Mint-Authority, supply, decimals, amount; dann `StateWithExtensions::<Mint>::unpack` + `get_extension::<TokenGroupMember>()`: `group == GT22…`, `member.mint == mint`.
- Abhängigkeiten: anchor-lang/anchor-spl 1.2.0 → `spl-token-2022-interface` 2.1.0 (über `anchor_spl::token_2022::spl_token_2022`), `spl-token-group-interface` =0.7.2 (dieselbe Version, die anchor-spl zieht) — je **eine** Version im Lockfile (Echo hatte zwei).
- `.so` 143 136 Bytes; `cargo clippy --all-targets -- -D warnings` leer.

## Tests (LiteSVM 0.16, echte Konstanten, Konten an echten Adressen)
| Test | Erwartung | Ergebnis |
|---|---|---|
| echtes SGT (frozen) | angenommen, Entry angelegt | ok, **11 609 CU** |
| zweiter Entry, gleiche Mint, gleiche Runde | `already in use` | ok |
| Migration: gleiche Mint, neue Wallet, gleiche Runde | `already in use`; nächste Runde ok | ok |
| falsche Gruppe (`TokenGroupMember.group`) | `WrongGroup` | ok |
| `member.mint ≠ mint` | `MemberMintMismatch` | ok |
| falsche Mint-Authority | `WrongMintAuthority` | ok |
| supply 2 | `WrongSupply` | ok |
| decimals 1 | `WrongDecimals` | ok |
| amount 0 (Altkonto nach Migration) | `WrongAmount` | ok |
| fremder Signer (nicht Token-Owner) | `ConstraintTokenOwner` | ok |
| Token-Konto einer anderen Mint | `ConstraintTokenMint` | ok |
| Mint ohne Extensions (gleiche Basis-Daten) | `NotAGroupMember` | ok |
| Mint/Token-Konto im Besitz des Classic-Token-Programms | `ConstraintMintTokenProgram` (2022) | ok |
| Classic-Token-Programm als `token_program` übergeben | `InvalidProgramId` | ok |
| Fixture-Plausibilität (frozen, amount 1) | — | ok |

15/15 grün (`cargo test --test sgt`).

## Offen / für das echte Programm
- Die Extension-Prüfung läuft im Handler (`verify_sgt`), nicht als `#[account(constraint = …)]`. 01 §3 sagt „alle als Anchor-Constraints“ — umsetzbar als `constraint = verify_sgt(...).is_ok()`, verliert dann aber den spezifischen Fehlercode. Vorschlag: Handler-Guard mit eigenen Fehlercodes beibehalten und 01 §3 entsprechend präzisieren. **Abweichung, zu entscheiden.**
- Rent/Größe des echten `Entry` (hier nur 73 Bytes) kommt mit dem Programm; Spec §11 Kostenzeile bleibt offen.
- „Fake-Mint mit kopierten Pointern ohne Gruppenmitgliedschaft“ ist durch `NotAGroupMember` + `WrongGroup` abgedeckt; ein Konto mit `GroupMemberPointer` auf eine fremde Adresse, aber ohne `TokenGroupMember`-Extension, fällt ebenfalls unter `NotAGroupMember` (Pointer werden bewusst ignoriert).
