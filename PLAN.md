# Pstack port plan

## Goal

Port cursor/plugins pstack to pi with reproducible upstream updates. Use npm:@trevonistrevon/pi-loop for loops and npm:pi-subagents for delegation. Report unsupported Cursor capabilities rather than claiming parity.

## Checklist

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame
- [x] Phase B: Design the workflow
- [x] Phase C: Run the loop
- [x] Phase D: Keep the audit trail
- [x] Phase E: Verify and hand back

## Architect checklist

- [x] Ground
- [x] Sketch
- [x] Agree. Both requested reviewers accepted the revised design.
- [x] Implement
- [x] Scrap. Skipped because implementation evidence supports the repaired design.

## Swarm checklist

- [x] Frame
- [x] Fan out
- [x] Aggregate
- [x] Report

The grounding fan-out partitions upstream inventory from native pi API investigation. Both reports require concrete file evidence. No shared writers run in parallel.

## Arena checklist

- [x] Frame
- [x] Fan out
- [x] Cross-judge
- [x] Pick
- [x] Graft
- [x] Verify. Design-level acceptance only. Runtime gates remain.

Compare designs on upstream fidelity, update determinism, native pi integration, explicit capability gaps, and independently runnable verification.

## Execution gates

1. Inventory pinned upstream files, licensing, executable integrations, and pi APIs.
2. Compare two design candidates and synthesize the smallest maintainable port.
3. Have Muse Wonder and Sol 6.1 review the design. Fix blocking findings before implementation.
4. Build reproducible import and parity checks before runtime adapters.
5. Implement the approved design and document capability gaps.
6. Exercise the packaged extension in pi and rerun update generation for determinism.
7. Run fresh Muse Wonder and Sol 6.1 reviews. Fix concrete findings and repeat until both accept, or record a genuine external blocker.

## Done predicate

Every pinned upstream resource is accounted for by an import, explicit adaptation, or documented gap. Update tooling detects upstream drift and regenerates deterministically. The package loads in pi and its supported commands behave correctly. Both requested reviewers accept the implementation. Any unavailable capabilities remain explicit and do not count as verified parity.

## Active work

Initial implementation run `e619463c-dfce-4a48-9866-f436d5f1d720` completed. Parent monitor #1 independently passed check, typecheck, and all 24 tests without skips. Early audits identified narrow importer and verification weaknesses. Fixes use separate copies under `/tmp/pi-mstack-fixes.LDYdGb`; parent alone integrates into the live checkout. Final dual-model acceptance remains pending. Importer and verification fixes run in workflow `cee84ef3-6852-4d87-aee1-980371837be1`. Runtime fixes run in `e0b1d908-c95f-4819-a94a-1ad13e9e1d4e`. These lanes owned disjoint source paths in isolated copies. All three completed and their reports are retained under `docs/research/*-fixes.md`. Parent reviewed and integrated their assigned source changes, refreshed the accepted importer digest and generation, and reconciled the packed busy-mode test with explicit refusal and idle retry. The combined parent run passed check, typecheck, and all 43 tests with no skips in `/tmp/pi-mstack-integrated-tests.log`. Fresh implementation reviews are retained as `docs/research/{muse,sol}-implementation-review-1.md`. Sol ACCEPTed with an optional native-wake evidence clarification. Muse REJECTed on two P2 gaps in skill authoring destinations/dependencies and usable Pi transcript corpus instructions. Isolated repair child `c95a87ac-f746-4c26-b330-bc1107b398c9` owns `/tmp/pi-mstack-authoring.iVunB5` for mappings, hash-bound patches, regression tests and evidence-note corrections. Parent must review and integrate only source changes, refresh accepted generation, rerun verification and obtain fresh dual acceptance. No unrelated runtime change was made. Parent integrated the seven reviewed source files, re-proposed and accepted digest `30ccca761e15ac1ae1121e0ffc591f2e4aa2a23d217e7c91dd6146ccc2b0b281`, then regenerated. Monitor #3 passed check, typecheck, all 46 tests without skips, and shell syntax verification. Evidence is `/tmp/pi-mstack-authoring-integrated-tests.log`. Fresh second-round implementation reviews both returned ACCEPT. Reports are `docs/research/muse-implementation-review-2.md` and `docs/research/sol-implementation-review-2.md`. Both verified closure of the authoring/transcript blockers and inspected retained native evidence against matching implementation bytes. Parent accepts the documented port contract, not Cursor service parity or arbitrary-model compliance. Muse's optional P3 on unknown `/pstack` arguments is deferred because it is non-mutating diagnostic polish. No commit, publication, or global installation was performed.

## Acceleration swarm

The operator requested a swarm to accelerate work. Workflow `654b03ad-0a02-45ef-9d0d-0d0abb629825` audits frozen snapshot `/tmp/pi-mstack-swarm.gOVVUb` while the sole implementation writer continues. Snapshot inventory digest is `62b285c5d2ffe0e66b97cc32ff2309d4473633a453bb004dabcef837513a5bc2`.

- [x] Frame
- [x] Fan out
- [x] Aggregate
- [x] Report

Coverage partitions are upstream/import safety with Muse Wonder, native runtime with Sol 6.1, packaged/native verification with a test worker, and newly authored comments with Comment Sicko. Audit workers do not edit the live checkout. Early findings feed repairs but do not replace final acceptance of the finished artifact. All four lanes returned. Comments had no actionable findings. Fidelity found scanner/lock gaps and stale in-progress metadata. Verification found weak wake correlation despite retained real execution evidence. Runtime proved literal-input, empty-config, merged-policy diagnostic, and busy-toggle defects. Confirmed findings are assigned to the isolated fix lanes.

## Throughput checkpoint

The repository began without commits or implementation. Importer, generated resources, native extension, and tests now exist. One writer owns implementation. Four independent audit lanes inspect a frozen snapshot and isolated test copies. Bulk upstream changes belong in the reproducible importer, not manual edits. Final runtime and package evidence remains required.
