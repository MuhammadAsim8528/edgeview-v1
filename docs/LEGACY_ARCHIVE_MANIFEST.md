# EdgeView pre-V1 legacy archive manifest

This archive intentionally removes retired pre-V1 architecture from active source paths so future coding agents do not mistake it for current EdgeView V1 architecture.

- Baseline Git commit before extraction: `fa7fcda`
- Local archive: `.archive/edgeview-pre-v1-legacy-2026-10-19.zip`
- Archive SHA-256: `16df37792decac386c420334440c64b4fc385de300b804e006c98bd94fec3fc6`
- Archived source/test/utility files: **148**
- ZIP entries including archive README: **149**

> THIS IS HISTORICAL PRE-V1 ARCHITECTURE. DO NOT IMPORT FROM IT. DO NOT RESTORE IT INTO THE ACTIVE BUILD. CURRENT ARCHITECTURE IS EDGEVIEW V1.

## Classification

- Retired product modules: 49
- Tests coupled to retired modules: 69
- Additional orphaned legacy test: 1
- Historical root diagnostic scripts: 29

## File inventory

| Original path | Category | Bytes | SHA-256 | Reason |
|---|---|---:|---|---|
| `backend/app.py` | Retired Python backend | 2643 | `283b150130cfc3009d46b29b0001b4185663e4149c7a1f6088c9a7a6eb6f60a3` | Not used by the Node/Express V1 entrypoint or launcher. |
| `backend/database.py` | Retired Python backend | 22742 | `499f34c6460677005dbb02ed1b43253068e3150694fab3942c6d4fa5b8178db3` | Not used by the Node/Express V1 entrypoint or launcher. |
| `backend/parsers/csv_parser.py` | Retired Python backend | 965 | `122b7e9d7a8c4914f35750713ae694b0ff0ec1a68bd43e61d160feb70da45b50` | Not used by the Node/Express V1 entrypoint or launcher. |
| `backend/parsers/dbf_parser.py` | Retired Python backend | 2251 | `d286851ea43514c6f94a46f7897dece994f74f4628a9a5e08cfa2571cfed0bfa` | Not used by the Node/Express V1 entrypoint or launcher. |
| `backend/parsers/docx_parser.py` | Retired Python backend | 2024 | `63c6293d792cd98bb770d9a1b68c4f91e223545951a26a81c15163d88d48f650` | Not used by the Node/Express V1 entrypoint or launcher. |
| `backend/parsers/excel_parser.py` | Retired Python backend | 368 | `59303d992ba6caa09ce69da2ce8cdd980bb932f098fa20b5b6bbc0b7e3bc70d1` | Not used by the Node/Express V1 entrypoint or launcher. |
| `backend/parsers/nvl_parser.py` | Retired Python backend | 12255 | `33bf251fcee610d03d545a2c709366e69f9f2f3fabb9107942822e11037c341f` | Not used by the Node/Express V1 entrypoint or launcher. |
| `backend/routes/country.py` | Retired Python backend | 11887 | `1dfff552005c8527fe4918556ae09fbc07c6150ebe554ae4a63cc743bc8fd100` | Not used by the Node/Express V1 entrypoint or launcher. |
| `backend/routes/files.py` | Retired Python backend | 11463 | `df462750ac26f1604496b213858fc80b44b83442c320b408ab145e799bd59ed0` | Not used by the Node/Express V1 entrypoint or launcher. |
| `backend/routes/stats.py` | Retired Python backend | 17542 | `db6684e036b7c2beb2bd15ac7642dabd52c7fa54bdadeeaa35d30d1eec5d424f` | Not used by the Node/Express V1 entrypoint or launcher. |
| `check_actions.mjs` | Historical diagnostic utility | 2195 | `4fa78670bc9114f329e3c2d49bdf92e4740f418255d609e53da8ebd24b4c0975` | Top-level debug/forensic utility not referenced by current release scripts. |
| `check_db_state.mjs` | Historical diagnostic utility | 459 | `a68857e1d5b58471287f7dbe1b7eec496538da1edf457547d3a4f7a4a250771e` | Top-level debug/forensic utility not referenced by current release scripts. |
| `check_schema.mjs` | Historical diagnostic utility | 381 | `76490c6419c1f07ed6d2ba7d3e2cb3f25c51209d74da395db34b82cd60191996` | Top-level debug/forensic utility not referenced by current release scripts. |
| `check_settings.mjs` | Historical diagnostic utility | 773 | `3bc45d9d9baa891339787230105801eb88000fbb686b2b3dd7a75d52af960d5a` | Top-level debug/forensic utility not referenced by current release scripts. |
| `check_slim.mjs` | Historical diagnostic utility | 1905 | `6496aa5508c0b4b5bc4b24e61548ffc90d5dcc53fd6e171bd27c254771388ae8` | Top-level debug/forensic utility not referenced by current release scripts. |
| `check_slim2.mjs` | Historical diagnostic utility | 1657 | `f1991997a1c31d1d673c11722dc53fb12afdcea0786f5fcaf830690b27d2b988` | Top-level debug/forensic utility not referenced by current release scripts. |
| `check_slim3.mjs` | Historical diagnostic utility | 820 | `84a0837462a975a7a214afbb72d3cef37e8da8231f1c50f4057a3c3fda4d8850` | Top-level debug/forensic utility not referenced by current release scripts. |
| `check_slim4.mjs` | Historical diagnostic utility | 1373 | `66ab43fef5ca7f547f2bcfc0f5f4625ab61458b26159b84e3f6d83b5208d5f68` | Top-level debug/forensic utility not referenced by current release scripts. |
| `check_slim5.mjs` | Historical diagnostic utility | 1485 | `3e4b9b92e94158db37cb140506e12254c87ab26028bd817978267b510345bbb4` | Top-level debug/forensic utility not referenced by current release scripts. |
| `check_slim6.mjs` | Historical diagnostic utility | 1411 | `855349387441b95d21e72205ee2ce2055a874c7b288b45122214da3c2ebe54c3` | Top-level debug/forensic utility not referenced by current release scripts. |
| `extract_completed.py` | Historical diagnostic utility | 305 | `dc49cdd1979dab78ff3a0f8662fe1c892b6b9e3a68a8d84f20e2e51dfdb9aa04` | Top-level debug/forensic utility not referenced by current release scripts. |
| `fix_resource_governor.mjs` | Historical diagnostic utility | 116 | `a5e51342c173add2e3d8f2d090d474210c92354c2172567502561c8d41c48f07` | Top-level debug/forensic utility not referenced by current release scripts. |
| `force_stop.mjs` | Historical diagnostic utility | 1658 | `35b5086cfb56c5083ac780dc7faedc2cdedd00aad2ef80fe1ea896f8a37c6f63` | Top-level debug/forensic utility not referenced by current release scripts. |
| `full_report.mjs` | Historical diagnostic utility | 19047 | `41db140d376b7eaa22de8a3c3d0dcdb7b0ba78544288dba6d5b48e1af380f493` | Top-level debug/forensic utility not referenced by current release scripts. |
| `inspect_db.cjs` | Historical diagnostic utility | 1687 | `ee3d40c79ca1475e870c1364d3927b872d3a30291040a46a90088b5ac12849db` | Top-level debug/forensic utility not referenced by current release scripts. |
| `inspect_db.js` | Historical diagnostic utility | 1687 | `ee3d40c79ca1475e870c1364d3927b872d3a30291040a46a90088b5ac12849db` | Top-level debug/forensic utility not referenced by current release scripts. |
| `inspect_db.mjs` | Historical diagnostic utility | 2974 | `68f260a95806cf1030e4a2e7478abe7f254ec6e62a43ecd09e284e71b83b70f8` | Top-level debug/forensic utility not referenced by current release scripts. |
| `inspect_db2.mjs` | Historical diagnostic utility | 3414 | `28a080af87ec50fa01d4cd4c22cce759c8b17c120c9317517c4e6893b231d845` | Top-level debug/forensic utility not referenced by current release scripts. |
| `memory_soak_full.mjs` | Historical diagnostic utility | 4950 | `7e2abc1c965344f8f4a09493ed993f5892ac09110522211a9bbd9c7bff7e027c` | Top-level debug/forensic utility not referenced by current release scripts. |
| `memory_soak_test.mjs` | Historical diagnostic utility | 2920 | `a02de079c239265cbdc3be3c0705b04861a5fda1f9491ecc3dfdd15b5db463ee` | Top-level debug/forensic utility not referenced by current release scripts. |
| `memory_soak_v2.mjs` | Historical diagnostic utility | 3558 | `fe503dcc472216863a024778622353be8a4869172e5222f915a2b6610dc609c5` | Top-level debug/forensic utility not referenced by current release scripts. |
| `replay_admission.mjs` | Historical diagnostic utility | 4863 | `12133e57f8d9cc7c836e98dd5e424e2a35e77883e4b70f2c43cd8f8cb58d6f2d` | Top-level debug/forensic utility not referenced by current release scripts. |
| `replay_all.mjs` | Historical diagnostic utility | 10979 | `3480915bbfb138aeb274c4f8d23a8b53959848125b3caf38650f047327028413` | Top-level debug/forensic utility not referenced by current release scripts. |
| `server/ai_execution_plan.ts` | Retired backend module | 13942 | `a95766e5bc3043e82c0fcc1a6b5b4df5e1bd65e5a4d9ce37ed55dd9f7bcb2082` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/benchmark_evaluation.ts` | Retired backend module | 1960 | `30f56c56447178aad1c1447d29de38dd1623dd10b8148b5c930cc5ee98826747` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/campaign_manager.ts` | Retired backend module | 4330 | `e7d9c30b351d90c16b3d503c0cbc2734cebf48d1f4834aee64d3918948d193f0` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/campaign_workers.ts` | Retired backend module | 38297 | `a912326f860a24b8679f7915de7dfe71843f5f4f1d77f01354415edcab760e80` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/canonical_research.ts` | Retired backend module | 2378 | `016af218e3a81310d14ab6352283d7c4f2f4eca2e2bd9cf7bd8cd31a61491c2f` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/contact_recovery_benchmark.ts` | Retired backend module | 4542 | `02f00cf786211328aa3b20e612fe6c957cbc8595594a85b0570769f3a4598291` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/control_room_server.ts` | Retired backend module | 27573 | `c3e4fb573965287cecc0bb9fa9ae37f997339dd40e531f7a21420b73508442f5` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/data_provenance.ts` | Retired backend module | 2596 | `de8429d4898831271444e4f5a45a6ed4e423987b48346f2f39d57349aef70302` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/dual_agent_coordinator.ts` | Retired backend module | 8687 | `eb4a402812050ab1481ca00c42eaf31c1e54220a91ddb51aecc34d7339d22fa2` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/enrichment.ts` | Retired backend module | 72351 | `c4c3fdd01a6c75e0f2c1d1f79ac423301d439827d56c2e401c7045797bf4ba4c` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/entity_proof_search.ts` | Retired backend module | 31046 | `cab61b97fd6d00f4c84744ab0773d524587b22b850179b34913c29a91c4738ad` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/evidence_neighborhood.ts` | Retired backend module | 9770 | `7c3b39134c26784bd69a89b73bc08c8620ae83a484a0764abdf853e97fedb486` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/evidence_packaging.ts` | Retired backend module | 16491 | `5ac737488eae58e1e82bba3179b4ae4d959a1e829891b5dbb6bec148106422dd` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/models.ts` | Retired backend module | 1443 | `c638fbf789d842cdd532bb8acf07cd0ef532f5a38aef37b88d9f8d9441a7bdc8` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/nvidia_diagnostics.ts` | Retired backend module | 5131 | `2f2efb7c1c7385b716e74f7315f1d7c5059c8fba4da6bfa798a8724cebf1a513` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/official_website.ts` | Retired backend module | 5135 | `07a690b9a42ba9b13b9149b01411d32c7b6bf873c840df2654f416b8b94dda7a` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/orchestrator.ts` | Retired backend module | 16057 | `4ec20cda83adc3ccdd92cb2f2a9673a72a72011884f1ac82bc174b840a562da3` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/page_content.ts` | Retired backend module | 10133 | `6822b30df6df7f06f3230de7c983707e2e41454328a514f02dd8f501ba3401cd` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/provider_failure_memory.ts` | Retired backend module | 7063 | `ee10a444ef525e7d3de62e1c368eec43fc7a620242d14243010c7ad605edf171` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/public_research_identity.ts` | Retired backend module | 1035 | `281a891adb5c068be47f2d4f786c07f2642029d5d6c0278fbc2e3e34e360efc0` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/research_director.ts` | Retired backend module | 111141 | `c10f55ad8f15f8c59b82cdeeb7070ac9c1a45481a2e8ee6022995ba0750e2485` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/research_fabric.ts` | Retired backend module | 28392 | `a9073baa17ec21dd3cc0e134343369695e4b4d05736a90270970a528ffc20b69` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/research_ledger.ts` | Retired backend module | 4055 | `1c1f8ad12f1fc3eea772c18c9feead06095358e333362a102630227f9016f347` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/research_runtime.ts` | Retired backend module | 84859 | `5d40cff90495410fee92ad7a3880fd64792e44cf9988207b01b20a1885d6b75e` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/research_workspace.ts` | Retired backend module | 19067 | `f1d4d3e0741c31864fc76d1831422974852111ff8d9bfd9b36012feb48dd4200` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/resource_governor.ts` | Retired backend module | 16104 | `923440834d2f1d9e3f58ed4777b7e693dd37f7849403790393e19bb7fe82bcd4` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/source_authority.ts` | Retired backend module | 1724 | `77c9a37181d41dab54df9a775713f02796162b262f9e3de68f66b4b4a860d650` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/tests/academic_contamination_pipeline.test.ts` | Legacy-coupled test | 3706 | `a4d5ef836bee60706ab37f4b8d8fe580b61dc3c437844fa732140b133cebcba9` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/adversarial_email_host_admission.test.ts` | Legacy-coupled test | 883 | `aeb091887bc58cc93ca81436a47d998c786cb8fdc23e4902e78cd6f7c75bb7bd` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/adversarial_evidence_correctness.test.ts` | Legacy-coupled test | 4925 | `a5fb5957eed6df39da76ce76ddf71e8352ee263a9b0bc196761fc69b24d4f6f9` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/authoritative_document_planner.test.ts` | Legacy-coupled test | 1877 | `90397fbcde5b33ec26b38192fa8d98ee47021e5632ac90e412dfa5293338568a` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/canonical_multi_country_entity_isolation.test.ts` | Legacy-coupled test | 10056 | `362df504e61c63ea700a50e1c76a0b8d0023ef165c671854caa9fe0dd7142048` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/cold_benchmark_runner.test.ts` | Legacy-coupled test | 1793 | `26aaff66933df4d4f508a2cf10a7a0671925eeb33797047e2bdb10187e0c56e5` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/cold_benchmark_runner.ts` | Legacy-coupled test | 21974 | `003d6a1fd56cfcf93f5c8488418ebdc792c660058d0061b0dc3efa3d4c0fa00e` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/contact_extraction_loss_boundaries.test.ts` | Legacy-coupled test | 8933 | `8600aaca73e0d357430f3bd8d65e46329d1c5ed3bd657edf657942e9ada37ae3` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/contact_recovery_breakthrough_v2_1.test.ts` | Legacy-coupled test | 6558 | `beb5ef52bb7fd29df2854db673683174d1175ba05f69a42819e69fcd3a3e865e` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/country_alias_boundary_regression.test.ts` | Legacy-coupled test | 848 | `10e01eed57893a0771535cb09f40dcaeadcc8b584f4ec4be476bdf7ca3c17602` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/country_specific_importer_targeting.test.ts` | Legacy-coupled test | 8772 | `56fd30ee1d100f5ea3690a192b2b195aca0a39cbcd48b963fdb85a714cc3c9e9` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/debug_enrichment.ts` | Legacy-coupled test | 1064 | `2733de87eae0910b46beec61c989aab810b461c0eac2296b58cfd10e333de4c6` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/disabled_search_provider.test.ts` | Legacy-coupled test | 1043 | `452f936549dd9df74774c7f4717a0e1e81988903976565ff4b8ffed432f12efa` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/dtf_recurrence_verification.ts` | Legacy-coupled test | 5654 | `73ca3ccb4e0947b9ce300c5ec70129a62cd9e520306bf6b57a6d5fdc60758970` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/dual_agent_campaign.test.ts` | Legacy-coupled test | 3276 | `10d6799529928fab331da1875215c9316685e353886ea25f1c20f61bd20a0430` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/edgeview_v3_contact_intelligence.test.ts` | Legacy-coupled test | 14331 | `aea16320258ee8f1d26d1efb1677b3e197827da79f73d51bd7489254c1ce74f7` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/email_attribution_regression.test.ts` | Legacy-coupled test | 6288 | `e4e7314c5376b5a0d3c814dbbf121b1245c535669527a969484660d4977ed328` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/emerchemie_scenario.test.ts` | Legacy-coupled test | 5489 | `e21b8a4956471a6aaaa26024328d0f7121dc04a8a4ac2f7e3f7b9b302b72b536` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/enrichment_cache.test.ts` | Legacy-coupled test | 2110 | `5971783efaa71dad6d678cf7cabbd425464dcc2f4b109b14de4d834058d8f972` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/enrichment_end_to_end.test.ts` | Legacy-coupled test | 3695 | `f7601d558df26867ad8ff9434d5e2508c55938c725a23fa7e10dc5f8f76b85c2` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/enrichment_stress_test.ts` | Legacy-coupled test | 4739 | `b49b8026dbcaf72011df1c9a9269d5dc604d14fb1e73b541c9e5120b326718d2` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/enrichment_uncached_coalesce.test.ts` | Legacy-coupled test | 2883 | `4a699a95159612d15e198b5b0c2765ffb4a30c13e01a39664e6945a16e4d78f6` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/entity_proof_hamar_live_experiment.ts` | Legacy-coupled test | 3545 | `80e672cab4bbd0f595aab51a7401fa1527301d8e2a04e7c584442c778fa4266b` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/entity_proof_search.test.ts` | Legacy-coupled test | 6150 | `4f306717550f3a196f54feea063cd1e01c9897237df8368ea86d354586a202cf` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/force_fetch_regression.test.ts` | Legacy-coupled test | 10143 | `77b865ef9a0450ca88fa8e9137e1e012d32d938afa4b7d245ea9614a875dd043` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/full_list_contact_extraction_e2e.test.ts` | Legacy-coupled test | 9389 | `da2cfb054e6802b0181d9933427ecaea03fc61ff8c0c495398ac3dd0623ccdf4` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/hamar_entity_contamination_regression.test.ts` | Legacy-coupled test | 4121 | `db4f8d6708c0dd17ad47ebf86eba95213948aa3e413b26eec713191c7522e298` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/hamar_entity_substitution_guard.test.ts` | Legacy-coupled test | 1286 | `454eebc4586a4bbb06ac7e847a20849b11f4162d92d9ac407abbe2b6b2e136dc` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/header_encoder.test.ts` | Legacy-coupled test | 3306 | `69c598b6b4f8e487a03cfeb8768e98b7666facf84275b82db6b4b76fcb9c416f` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/importer_intelligence_recovery_v1.test.ts` | Legacy-coupled test | 6576 | `ac5f8a74911bf69fd0273c8ba18513a3622d8b0b0c7fd5a19fa2ab0329adfacd` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/information_loss_fix.test.ts` | Legacy-coupled test | 23069 | `8a36b77f0bb97a61c9d3098ad7cc38c18f9976235c759e0da168e9ad1cab0d4b` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/live_benchmark_replay.ts` | Legacy-coupled test | 7904 | `23c5d3d489905db8f5ec00c47dc51cefce3d52c5e80ce0695dea77e437e24ff6` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/live_benchmark_replay_v2.ts` | Legacy-coupled test | 7080 | `56649f1b10c557033bcc569bcaa162bcd9573998477117fc64723a99de1e50b4` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/master_importer_intelligence_hardening.test.ts` | Legacy-coupled test | 5429 | `f2b0a903fbe3261fb0d5b7c7a4787695ee2bd0361cad204626608776e6099374` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/nvidia_execution_plan.test.ts` | Legacy-coupled test | 3880 | `e69e9d2cb6c98272909ec2652d5134782c1a8c387960841f2084696e801aedd1` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/official_host_locality.test.ts` | Legacy-coupled test | 854 | `67f32db987eec4effc48be34623c3e9edce0cb5f787ae3b46eb49bbe561ebcaf` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/official_internal_page_discovery.test.ts` | Legacy-coupled test | 4878 | `cd849c532f64a681bda7e24d6cac6adf15fc2923f59fb017635d6adf9bd8280b` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/paginated_loading_e2e.test.ts` | Legacy-coupled test | 5254 | `b48712bc0f7ef7c18f22d0f37345a614feef73e87a2d6eaa2e63a76d0f2c91d0` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/parallel_discovery_campaign.test.ts` | Legacy-coupled test | 1758 | `f3a006d4d24beca97a644c92f2ddf18bb59375a6b41b272558e32919bc5078a0` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/partial_cache_narrowing.test.ts` | Legacy-coupled test | 4504 | `8fb1232ca5ad10a4d8f2bf5dab12427543fa75d3998c1bc1721e6aaefb937951` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/phase2_reproduction.test.ts` | Legacy-coupled test | 10724 | `685e6c988f35d7bda2a1afdabb84d0f98551d80aa16bcf974611194676490d61` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/production_data_integrity.test.ts` | Legacy-coupled test | 6699 | `820cdc3bf1adb37b8b7b87aa3578a1b06e23f6a2e1c43aaaf483851786a69ea5` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/prompt_injection_defense.test.ts` | Legacy-coupled test | 6276 | `9be9ff7b9e4ff5fd16304b136d10dcff91ef93c5369c8debd0cf6b544a7b80db` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/provider_allocation_policy.test.ts` | Legacy-coupled test | 724 | `bf27cf66b64e4a97143f6c8c54d1358c1d3417c83b5c35ab2c3b1bbfd96f3852` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/provider_failure_memory_persistence.test.ts` | Legacy-coupled test | 1841 | `a3fd96e053873f83ee1505b63f8d260c32de386b194f63fe336e9d0280682d8d` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/provider_failure_stress_test.ts` | Legacy-coupled test | 3852 | `ba62f54b9ddc794b3bd94b23c05e7c4250a82e28016508a9054fe4743fe07981` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/provider_ranked_fallback.test.ts` | Legacy-coupled test | 1510 | `3a362d786a10656a945b9191bdbde8508fe89454cae0bb7d4993189d50c34c46` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/public_research_identity_guard.test.ts` | Legacy-coupled test | 896 | `6071c2e4510901955aeec102238ec9fe7cf14a928ce382a1378b8253f9265e9f` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/red_team_mission1.ts` | Legacy-coupled test | 4000 | `d152eb942deb0d8e9dc8fbd30e054f597ef1d32f82a04d6f940c3a134d7cfdac` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/red_team_mission11.ts` | Legacy-coupled test | 5852 | `0aee101e2812dc05fb7f46b864424ca9a17db2783c9ea1d4d12415764211473c` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/red_team_mission2.ts` | Legacy-coupled test | 5968 | `4278353fc0b83b54c1d66b32b86c1cf00511c7555482862d27b5585b19f46b39` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/red_team_mission4.ts` | Legacy-coupled test | 6227 | `8504dddf812324982a526584a862fed22cbf27717508d94aaf7ecfcd11be1ac6` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/red_team_mission6.ts` | Legacy-coupled test | 6304 | `73f15bf6db3de95eb58d975b82ad50676963722a5f3e992a31645ae93bcbe8a2` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/red_team_missions12_14.ts` | Legacy-coupled test | 9725 | `991714be90d43d71e2810f6b79aa70c0c764099f9b393970a2533c5921f4e793` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/red_team_missions15_16.ts` | Legacy-coupled test | 8393 | `e8e0abb24d7212a055962abd8d36f77c78e34682e630d0ca02edfc83f9aebb81` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/red_team_missions5_8_10.ts` | Legacy-coupled test | 6344 | `b03fbc9b29fa3c6dddd090e93a7e6ab362db099a6857fca7a140444b945e94c5` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/red_team_nvidia.ts` | Legacy-coupled test | 4378 | `81f2ec2e85c69d7559b03869dcb578eb39024b13764b1b86f841650809261d92` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/research_engine_rebuild.test.ts` | Legacy-coupled test | 6248 | `5d5ef015b54b563517a2e6ef11947f8d43c3e9fe45b9c717e95de90126bb1dd6` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/research_workspace_persistence.test.ts` | Legacy-coupled test | 2353 | `efecc1b798d252ccc29abdf8e599e994494c3f4f8c1206dda980d5f8efda33d2` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/slim_campaign_debug.test.ts` | Legacy-coupled test | 7781 | `5ebeb934a8f16e09de91767572b4712b5222b08bf8fe9e1865ed666da5004af2` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/slim_campaign_lifecycle.test.ts` | Legacy-coupled test | 8503 | `1d2c7772a5a1d81333a508cd653c97e836bb087f55fcee2e7dc92364b53bd10b` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/slim_deterministic_evidence_regression.test.ts` | Legacy-coupled test | 1909 | `4dc255eed677611eb9e39e6b96bc26de15d24af7836506e4ca496253ee9b50e8` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/slim_email_survival_regression.test.ts` | Legacy-coupled test | 1346 | `9ba0a7f172c4311e466ae0a1da910b523fd0bda0cb6a464d7f833adf1b3d581b` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/snippet_metadata_regression.test.ts` | Legacy-coupled test | 2419 | `1daaa684f485dd54d536ae419a0dcf28e872fc3de1d917cd2721279b42bac991` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/source_independence_dedup.test.ts` | Legacy-coupled test | 1163 | `d305c63a90ea5ed53677d56b193f685bf8dc6ffc9a399bcbcec72e8fe884de15` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/trusted_evidence_admission.test.ts` | Legacy-coupled test | 2199 | `98dd2201286d1820b1dcae7e4787463dd3b08ad3065edaa6c07b60aa205c4a2b` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/trusted_intelligence_claims.test.ts` | Legacy-coupled test | 1180 | `1fa97ad0cc163a00e70b7fc916818b59f5816bf9d62d88554275dbbae494f440` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/trusted_objectives_regression.test.ts` | Legacy-coupled test | 1966 | `0e41e2eaafc66bfa96142148d70704d350b4fcc957bcfa3ff4bc76542f42118d` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/tests/truthset_expansion_search.ts` | Legacy-coupled test | 2762 | `41eabf4ff1183905c21dec55be9d027080bf3bda49c32382332619d9d46dbb0c` | Dependency closure reaches at least one retired pre-V1 module. |
| `server/trade_fingerprint.ts` | Retired backend module | 9489 | `ab2361014bb570ec8b0eb949ea10302a41ad3928d097a4d35f097b6473e40ec1` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `server/trusted_intelligence.ts` | Retired backend module | 6659 | `784ad9b3e177203656659034b7d9c04e3b069642a74b7d5784a563982b1254df` | Outside the current EdgeView V1 source graph after the dead compatibility bridge was cut. |
| `src/components/ActivityLogModal.tsx` | Retired frontend module | 5141 | `c57e2ab2c83ec99a828057792c05c7afdde7100a4a853e32fb6ecc8efbd22bb7` | Outside the current App/main V1 source graph. |
| `src/components/Settings.tsx` | Retired frontend module | 138 | `494547db05ad34d7fc1f625806a69f16971b2833b85068711dfc3d6025e392d4` | Outside the current App/main V1 source graph. |
| `src/components/SettingsTab.tsx` | Retired frontend module | 121854 | `75a88f1c66ec71e29c47fbfd6765666b1310e85d4bc0d3581c75db75257b188a` | Outside the current App/main V1 source graph. |
| `src/hooks/useDebounce.ts` | Retired frontend module | 392 | `5b832d4818efebba51fb5a68c88fe7ef22282c12bea123fa1198775a01960b43` | Outside the current App/main V1 source graph. |
| `src/hooks/useResearchCampaign.ts` | Retired frontend module | 1856 | `8e89e31c8eba379779af12102bb080ee9c838b00869e0e196738cd350edefa4b` | Outside the current App/main V1 source graph. |
| `src/services/research/director.ts` | Retired frontend module | 51 | `a2a3321126e05b97fda7f5e57583a53579c5d05ebd4b17c5dc0a16b5b1a08e9c` | Outside the current App/main V1 source graph. |
| `src/services/research/health.ts` | Retired frontend module | 2617 | `748fdaa0fc167f4af69f11cfc155c7cb698346a70e9ae1901b03b809121c60c4` | Outside the current App/main V1 source graph. |
| `src/services/research/registry.ts` | Retired frontend module | 252 | `3223d17914b3021a3ead3d62341c0fdf5e41f5514e0dd2d0a37d5f6c131ea332` | Outside the current App/main V1 source graph. |
| `src/types/campaign.ts` | Retired frontend module | 885 | `d19dd349bc813c15a01962fccf9dee2185b9ec16795fbec968b13feffb2d5c58` | Outside the current App/main V1 source graph. |
| `src/types/research.ts` | Retired frontend module | 3356 | `d131262e9e3e53e1f412a3a2cc2cd9b0df119995b30a005dd9a4d97156c09fee` | Outside the current App/main V1 source graph. |
| `stop_job.mjs` | Historical diagnostic utility | 1222 | `5cd0a61bbbc13c829c4152e50b664f661ce07c2f2de1c76353c781bfbd217010` | Top-level debug/forensic utility not referenced by current release scripts. |
| `test_slim_direct.mjs` | Historical diagnostic utility | 1872 | `6258c650cf9fea99bc89a7347b8f421d1b05797cc714e524b9f2c864a67cde5d` | Top-level debug/forensic utility not referenced by current release scripts. |
| `test_slim_extraction.mjs` | Historical diagnostic utility | 1843 | `10bcda54f123406739b57061404aebcc1d4afafa439a84b012a4f71ced8c11f6` | Top-level debug/forensic utility not referenced by current release scripts. |
| `test_slim_timeout.mjs` | Historical diagnostic utility | 2113 | `705ceb609f065666d170aa5a8445a3342621edf251bd37fb3674cd440f710cbe` | Top-level debug/forensic utility not referenced by current release scripts. |
| `verify_snapshot.mjs` | Historical diagnostic utility | 2174 | `d9ec93525db283aa58f06bdf21a0aaaeeff5a7ff2a18601c4646b872f80300c2` | Top-level debug/forensic utility not referenced by current release scripts. |
| `wait_stop.mjs` | Historical diagnostic utility | 2064 | `5b6cfc7a7394a32931b73dffb9c8a274f3229299b9660f77777e3f5e876d2a54` | Top-level debug/forensic utility not referenced by current release scripts. |

## Recovery

Preferred recovery is Git (`fa7fcda`) because it preserves the complete pre-extraction tree. The ZIP is a second local recovery copy. Restore individual files only for historical reference or deliberate migration, never by bulk-copying the archive back into active `server/` or `src/` paths.

| `server/tests/control_room_live.test.ts` | Orphaned legacy test | 2099 | `d7f26e0d2ad7eeacf4e26ae22494c16efb10fe2aa545dcdfb54f3e9656b92eeb` | Tests the retired Control Room API and is not part of EdgeView V1. |
