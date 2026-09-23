# Calendar season 1 — generated, review before publishing

Generator: `node services/calendar/generate.mjs --season 1 --start 2026-09-26 --leaves 64 --rotation v3b`
Rules: terms v3; standard question "direction" (threshold 0, strict, equality is No); source: sponsored Pyth account (upgraded stack), W = 60 s, A = 60 s, max_conf_bps 50, measurement band 25 bps.
v3b CANDIDATE — one question kind per weekday: Mon BTC direction, Tue SOL direction, Wed SOL movement > 1.5 %, Thu ETH direction, Fri SOL more than +1 %, Sat/Sun SOL direction. Nothing here is published.
Event days (movement, 1.7 %): 2026-10-02 ETH, 2026-10-14 BTC, 2026-10-29 BTC, 2026-11-06 BTC, 2026-11-10 ETH. The context line is display only and not part of the hash.
Times (UTC): commit 16:00–04:00, reference 04:02 (two minutes after sealing closes), outcome 16:00, reveal for 72 h after the outcome.
Unused leaves: sha256(0x00 || [0;32]) = 7f9c9e31ac8256ca2f258583df262dbc7d6f68f2a03043d5c99a4ae5a7396ce9

**Merkle root (= Config.calendar_root):** `1e95c80370fc64f18791cdd70c938a6d16402a0e66b0fc9019a1c16074736ce5`
**Last outcome:** 2026-11-29T16:00:00.000Z

| round | measured on (UTC) | feed | question | price account | terms_hash |
|---|---|---|---|---|---|
| 0 | Sun 2026-09-27 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `409d20ae93770a67adcc4a26294f435220f9dd3f95e7eef11cea229b093033c4` |
| 1 | Mon 2026-09-28 | BTC/USD | higher? | `APgzQGGdv2qCgBkX6aHVkrGePtBVDDg68GiqaM7rmtf5` | `98e454649bc52c625429e6e6db19c8c201077e81a23875ad38f100d1c7f82999` |
| 2 | Tue 2026-09-29 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `82b1f32ca79ed15981088cfe57317a89a7a47d76c9758cfa6b5cef59154156d1` |
| 3 | Wed 2026-09-30 | SOL/USD | more than ±1.5 % — null | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `ccc053411cac444862c6bad6deb65668b8b0967c2864050347d39b8bc8ab4d4d` |
| 4 | Thu 2026-10-01 | ETH/USD | higher? | `7odryi4WfoMFHtv2eubdMgP1pqQMmdiXSK1N2tqZ2nRH` | `f47ec51f2df2422182f60759167a21d1177289d9336e1db2113e4f809e05b41d` |
| 5 | Fri 2026-10-02 | ETH/USD | more than ±1.7 % — US jobs report at 12:30 UTC. | `7odryi4WfoMFHtv2eubdMgP1pqQMmdiXSK1N2tqZ2nRH` | `d1fdc08ddc052b295f3d84dfc5cf1046dbe20c2d9922b853b4572f7e61bec3ae` |
| 6 | Sat 2026-10-03 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `2722263141ceeacf3707d8772f5c45ecb5caeab38c08d732c885dcaa42cf3b58` |
| 7 | Sun 2026-10-04 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `c8375be4fc75de1306b99b44fd08c3687db07dacdc15b000ea92c0d12d824752` |
| 8 | Mon 2026-10-05 | BTC/USD | higher? | `APgzQGGdv2qCgBkX6aHVkrGePtBVDDg68GiqaM7rmtf5` | `84eba12038bb341988d15710faf1b3a481a78ea5b159e7d7f036ee9a32a01cf1` |
| 9 | Tue 2026-10-06 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `cea1e9dc45fb8cc6a64fb49d62b6d65a04f14a69cda09e78c564c6b4e7023b3a` |
| 10 | Wed 2026-10-07 | SOL/USD | more than ±1.5 % — null | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `f02e7d8fd8b827de0485e648cd54ca91f9b9fb5168fc1a303eba63a69cefa471` |
| 11 | Thu 2026-10-08 | ETH/USD | higher? | `7odryi4WfoMFHtv2eubdMgP1pqQMmdiXSK1N2tqZ2nRH` | `7e7b86b495dcab61260c4f29c573ef2df0fef225a851c453320e25c66ffd8972` |
| 12 | Fri 2026-10-09 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `141ee7995d0653ba0f50dbee051edaef24bdd21a9085bd929dc88025e6441e89` |
| 13 | Sat 2026-10-10 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `d47dd61d4dcaedbed9dee1f2e1d634d83b34092d244ffce1e490d585bbf45a0a` |
| 14 | Sun 2026-10-11 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `484f729d0e40f7ca435940aefabe01717caec94f31492db92ab4452be66a16f2` |
| 15 | Mon 2026-10-12 | BTC/USD | higher? | `APgzQGGdv2qCgBkX6aHVkrGePtBVDDg68GiqaM7rmtf5` | `b9232574321a9df0359b389a015f72df377042a72c8e7c848de5faed3ffd621b` |
| 16 | Tue 2026-10-13 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `cef29c80c0b8e0658232ee0afe7d794985a795256c5da56f97c8abc83aa6f23d` |
| 17 | Wed 2026-10-14 | BTC/USD | more than ±1.7 % — US inflation data at 12:30 UTC. | `APgzQGGdv2qCgBkX6aHVkrGePtBVDDg68GiqaM7rmtf5` | `1233204d5a0cd9219019ab6bf1eba09049d6dc192d08848a54baf88cbc78a3c7` |
| 18 | Thu 2026-10-15 | ETH/USD | higher? | `7odryi4WfoMFHtv2eubdMgP1pqQMmdiXSK1N2tqZ2nRH` | `67cec3b815bfccd1095bcdf1ce1e612ba712851d9bd663cf7e95dfd19593436b` |
| 19 | Fri 2026-10-16 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `916d34ef11b30657a22a041477e9741b32dedc616f06e821590fa93540863054` |
| 20 | Sat 2026-10-17 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `021efb66ef28eabd4dccd329484097f07d765585a618e7ced5b1c473033ee761` |
| 21 | Sun 2026-10-18 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `3bd93b629e04814fe4668f4f1eb4009e586d19d55e662631aba16251af2c7f5f` |
| 22 | Mon 2026-10-19 | BTC/USD | higher? | `APgzQGGdv2qCgBkX6aHVkrGePtBVDDg68GiqaM7rmtf5` | `54cb82023529c396bf04afec909dd84e96f76cc52644ad2cb8793dd191dc930d` |
| 23 | Tue 2026-10-20 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `f8ffdce6c455f249473e69ad1292a3e3fcf633f5feb0a477bf805cc8aa77e6d4` |
| 24 | Wed 2026-10-21 | SOL/USD | more than ±1.5 % — null | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `f5f4372c81bc75ae80418f77bf5d54565b4fde679cc9ea8eacd5320f4f82f49f` |
| 25 | Thu 2026-10-22 | ETH/USD | higher? | `7odryi4WfoMFHtv2eubdMgP1pqQMmdiXSK1N2tqZ2nRH` | `b7963b50bdc1d0b90be9bb50d2f9476c50877d1c3a5224ef5900ca8a47c7caa3` |
| 26 | Fri 2026-10-23 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `e4b0ef49e915e961255724bf2b2ce164c093977c34ebe1c461be7fdd52b9da6b` |
| 27 | Sat 2026-10-24 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `a44c59095ba553c03caea059e273517d0bf4c65c35489032b4bed8b423e6525e` |
| 28 | Sun 2026-10-25 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `67a9354773341b34b45c91483f0b0a44a90918f20843cc8eca17fb146cf763f3` |
| 29 | Mon 2026-10-26 | BTC/USD | higher? | `APgzQGGdv2qCgBkX6aHVkrGePtBVDDg68GiqaM7rmtf5` | `79cf3e368171e0ba807bea1459a6fe916aa83c3b32b2f0019373597489fdfb0e` |
| 30 | Tue 2026-10-27 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `d0734fcb647d14a37187b5dd9d3621cfdef8eeac02f5a74c8ffe4b0a3cf4e2a6` |
| 31 | Wed 2026-10-28 | SOL/USD | more than ±1.5 % — null | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `cd931ac5c3fd5984fcfceb6b685e4fd77a342c0e5c301bd9072ca7c31f35ac9a` |
| 32 | Thu 2026-10-29 | BTC/USD | more than ±1.7 % — The Fed decided yesterday at 18:00 UTC. | `APgzQGGdv2qCgBkX6aHVkrGePtBVDDg68GiqaM7rmtf5` | `e739e7d75da10703efe8749eab95b6800befd051ce9afa5d48bca118b978c03a` |
| 33 | Fri 2026-10-30 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `44ecdd4e919f31a12b7c6ddde372704fa7ad85f7b3abef565c0ef57d790dfffe` |
| 34 | Sat 2026-10-31 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `74a4bb9921c15b0c6b602c25eb7b761b09bb3e5de1a4e886938eafcf87e9dcf6` |
| 35 | Sun 2026-11-01 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `90e2649be3d905acca01dfb87d1b9fcbb6a401c7853dda7e09ff84e3ffcb48f6` |
| 36 | Mon 2026-11-02 | BTC/USD | higher? | `APgzQGGdv2qCgBkX6aHVkrGePtBVDDg68GiqaM7rmtf5` | `9c4346db1d01f748d2f251adf1c5a85c3a5a71a69cf0d0320afb0dfba21ea351` |
| 37 | Tue 2026-11-03 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `368f2afafe90e048b3a02b5556befbc1c3bd5ddb6f6f1a0b71a72081e52187b1` |
| 38 | Wed 2026-11-04 | SOL/USD | more than ±1.5 % — null | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `e7ba29b0a41bb6057dafc3a3d03ac03277fe3c1c073df6580e00c309e0ef72c0` |
| 39 | Thu 2026-11-05 | ETH/USD | higher? | `7odryi4WfoMFHtv2eubdMgP1pqQMmdiXSK1N2tqZ2nRH` | `8e071e328ba297327e942bd083747a62fee7fbcec8682ba8312b57c9f0c6975c` |
| 40 | Fri 2026-11-06 | BTC/USD | more than ±1.7 % — US jobs report at 13:30 UTC. | `APgzQGGdv2qCgBkX6aHVkrGePtBVDDg68GiqaM7rmtf5` | `521857ca9dbe32715d523c9c48dda6a6a5f4fe79458cf1c5dacecca63facf5b0` |
| 41 | Sat 2026-11-07 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `7c7632600d5fb8eef5eeefbae2c38290c88d4cca55b337699ec68dc0d40d15a3` |
| 42 | Sun 2026-11-08 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `83eeeb5e3f515fe1391b6e331d04999713c2f3ccb41709d610af696ff0028895` |
| 43 | Mon 2026-11-09 | BTC/USD | higher? | `APgzQGGdv2qCgBkX6aHVkrGePtBVDDg68GiqaM7rmtf5` | `860f6e1f0bd96ee7b746b0a6400f76b986c8347b3734c9aa0325766421a19ea6` |
| 44 | Tue 2026-11-10 | ETH/USD | more than ±1.7 % — US inflation data at 13:30 UTC. | `7odryi4WfoMFHtv2eubdMgP1pqQMmdiXSK1N2tqZ2nRH` | `f0a5f16ff0bfcbad29daf0ae7b1541043478c7e8268531288dac2bb6f56838c9` |
| 45 | Wed 2026-11-11 | SOL/USD | more than ±1.5 % — null | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `b88e0bfa12505834c5be27f771e4d19849271d4893fc38df880b301039d09049` |
| 46 | Thu 2026-11-12 | ETH/USD | higher? | `7odryi4WfoMFHtv2eubdMgP1pqQMmdiXSK1N2tqZ2nRH` | `ca3da38cc9a6e4d7bd4be863b06a976c91cf2492250333b5dc4249a47c24554c` |
| 47 | Fri 2026-11-13 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `2afba6aa64b68cf81c79885b075c45ef14439132600b4aa587d0266e3528af1a` |
| 48 | Sat 2026-11-14 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `a2766366eb1a25e4d20f7960b5f97c5596402858c24e96c5d4586b0dc8030ea8` |
| 49 | Sun 2026-11-15 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `eb2b95248b44ba7712f2a576ab9dd6b6e70728c35c87bff3bd17f3072202e69f` |
| 50 | Mon 2026-11-16 | BTC/USD | higher? | `APgzQGGdv2qCgBkX6aHVkrGePtBVDDg68GiqaM7rmtf5` | `957c440988b53e04aee88b420f9e7b436e806d367b910e21c62969f665830160` |
| 51 | Tue 2026-11-17 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `9fa667d767047cf6da7a3ee5bfadc6d456a0e43f9b2674ec32ac2d00957c3f9c` |
| 52 | Wed 2026-11-18 | SOL/USD | more than ±1.5 % — null | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `d4a6a1f4be4f0273310c415db70e4644a1770e70e8eb338b114f957a24d0919d` |
| 53 | Thu 2026-11-19 | ETH/USD | higher? | `7odryi4WfoMFHtv2eubdMgP1pqQMmdiXSK1N2tqZ2nRH` | `469d687f1ae59bab3db878057ee3d22419ba59e4f450ba3ee4374d51633606f6` |
| 54 | Fri 2026-11-20 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `1443c7f2edf30a05b74538e9f1b017aea67282b867b17e53a88f1e9de6258fbd` |
| 55 | Sat 2026-11-21 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `fa0f2e60981746a99572c6319e79288097de6ccb8a79e073fc1ffc28c8f3c2fb` |
| 56 | Sun 2026-11-22 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `e0094ad8f6cb0538e09084bd4aa348288834e912d956633f6f09587fa1997ff0` |
| 57 | Mon 2026-11-23 | BTC/USD | higher? | `APgzQGGdv2qCgBkX6aHVkrGePtBVDDg68GiqaM7rmtf5` | `8359f31c6492dce21e119af6c3e4e845bbf4ea58da535390c3e4dd757ef2030e` |
| 58 | Tue 2026-11-24 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `01ee412bf577138a2ec00f8891c6107b5d14bbefa036facf485d9a2eba5bb5d8` |
| 59 | Wed 2026-11-25 | SOL/USD | more than ±1.5 % — null | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `25a29f10df483ecffe01c3692655f5c80ce2c43b9527a1887b553fe918378d5b` |
| 60 | Thu 2026-11-26 | ETH/USD | higher? | `7odryi4WfoMFHtv2eubdMgP1pqQMmdiXSK1N2tqZ2nRH` | `ee17fc1248be9c42d39efc5dd8aed2900b98474022a81260e20b4d298fcb8c3e` |
| 61 | Fri 2026-11-27 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `23af7b777ecee14d2ef44e44f80266dacbbae8b72458ad07a5b781daceba1ff4` |
| 62 | Sat 2026-11-28 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `8a189dcd1186b1b6b2303bb46099ef3b564d45e445b54d2d98cfa17243614ff7` |
| 63 | Sun 2026-11-29 | SOL/USD | higher? | `7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE` | `0408e1d75ab9aa862fedd79633d888ec6e1ccb69a360009546be9d7bb79de0f8` |
