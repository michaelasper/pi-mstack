# Implementation evidence and boundaries

The implemented port keeps Cursor pstack's pinned source and native Pi execution separate. Consumers get generated skill resources, branch-local mode, validated role data, and diagnostics. Maintainers get Git-object proposals, digest-bound acceptance, offline regeneration, and explicit repair operations.

## Post-publication improvement checks

Against published baseline `3fab20540f2aaa5e4a0287e55389382ea09e0a8b`, the parent integrated custom-provider selector fixes, CLI validation, owned lock-write cleanup, schema-2 adaptation inventories, hermetic Git edge coverage, and safe retention guidance. The reviewed importer digest is `1f142e0089a29932768d1fc74e1b32da021bd3f821134f3fcb03f6fb4f56ddbd`.

`npm run check`, `npm run typecheck`, `MSTACK_GIT_TESTS=1 MSTACK_KEEP_TEST_ARTIFACTS=1 npm test`, and `git diff --check` passed. All 52 tests passed with no skips. The log is `/tmp/pi-mstack-improvements-parent-tests.log`. This run retained native evidence under `/var/folders/0v/d5b2yvfs1tx739ndg_0m3vqr0000gn/T/mstack-packed-fTLrma/native` and RPC evidence under `/var/folders/0v/d5b2yvfs1tx739ndg_0m3vqr0000gn/T/mstack-packed-VdsBRz`.

Independent Codex and Muse Contributor reviews both returned ACCEPT. See [Codex review](research/codex-improvement-review.md), [Muse review summary](research/muse-improvement-review.md), and [implementation handoff](research/improvement-implementation.md). Muse's optional, unreproduced concern that a file-close error could mask an earlier write error is deferred. Caught write cleanup does not promise process-death recovery or protection against hostile filesystem races.

## Historical initial-port checks

Evidence is run-specific. The pre-repair integration log `/tmp/pi-mstack-integrated-tests.log`, cited by the first Muse and Sol reviews, reported 43 passing tests with no skips. That result predates the authoring and transcript repairs and is not final acceptance of them. The old 24-test count and digest are superseded.

After integrating the authoring and transcript repairs, the parent ran `npm run check`, `npm run typecheck`, `MSTACK_GIT_TESTS=1 MSTACK_KEEP_TEST_ARTIFACTS=1 npm test`, and `bash -n generated/skills/poteto-mode/scripts/worktree-audit.sh`. All checks passed, including 46 tests with no skips. The log is `/tmp/pi-mstack-authoring-integrated-tests.log`. That run's accepted importer digest was `30ccca761e15ac1ae1121e0ffc591f2e4aa2a23d217e7c91dd6146ccc2b0b281`. Fresh independent reviews by Muse Wonder and Sol 6.1 both returned ACCEPT. Their reports are retained in `research/muse-implementation-review-2.md` and `research/sol-implementation-review-2.md`. Parent acceptance is limited to this documented port contract.

This run retained native evidence at `/var/folders/0v/d5b2yvfs1tx739ndg_0m3vqr0000gn/T/mstack-packed-sWuu2E/native/native-evidence.json` and RPC regression evidence under `/var/folders/0v/d5b2yvfs1tx739ndg_0m3vqr0000gn/T/mstack-packed-fxzc8i`. The native assertions passed for role delivery and mode off on both wakes. The declared Node.js 22.19 minimum has not been exercised separately.

The first reviews inspected native evidence at `/var/folders/0v/d5b2yvfs1tx739ndg_0m3vqr0000gn/T/mstack-packed-RDTS3b/native/native-evidence.json`. This is historical run evidence, not proof of the next packed artifact. Its adjacent `child.md` and provider captures demonstrated native completion and monitor wakes with mode off. Enabled-mode native wakes were not exercised. Temporary paths are not durable release artifacts. Reproduce and retain new evidence with the commands in [verification](verification.md).

The ordinary test suite packs and unpacks the standard npm artifact. It proves source export, shipped maintenance commands, actual Pi CLI and SDK loading, native package-agent discovery, async output retention, native policy rejection, and a provider-visible monitor wake. It does not infer those properties from mocks of Pi's extension API.

## Implementation choices

The task-bearing short-command prototype completes in TUI and RPC but loses completed output in print and JSON. The supported task route is therefore `/skill:poteto-mode <task>`. The package refuses short task commands instead of relying on a void forwarding call to keep the host alive.

Standard npm packaging excludes `.gitignore`. The approved exception stores only that filename as `__npm_reserved_gitignore__`, while the manifest retains its original identity, hash, and mode. Packed export reconstructs the complete original tree. No tarball patcher or replacement packaging workflow exists.

Source publication uses a journal and directory renames. It detects partial publication rather than claiming a cross-directory atomic transaction. Generated publication requires explicit recovery after an interrupted backup. A generated-index checksum detects accidental metadata edits. Neither the checksum nor a review digest is a signature against an attacker who can rewrite all local inputs.

Model configuration uses a versioned schema and a single role registry. Inheritance resolves explicitly on every run. Native enforcement remains in pi-subagents, and the port never retries a rejected selector by omission. Scope matching is not duplicated in the port.

The adapter preserves host-independent prose and fixtures. Exact source-hash-bound patches remove contradictory model fallbacks, provide Pi skill-authoring destinations and procedures, and restrict transcript acquisition to authorized Pi paths. The workspace-history audit requires a separately authorized marked directory. The few npm-install hardening changes are explicit script patches. The bot skill is a capability notice, while Benny remains snapshot-only.

## Remaining limits

The scripted provider proves dispatch and prompt visibility, not arbitrary-model compliance with playbook prose. Renderer, Java, TLC, forge, external bot, cloud, and paid-model evaluations were not run. The inherited worktree-audit script received a shell syntax check, not cross-platform execution against real forge data.

Setup creates an exclusive models.json.lock before the optimistic stale-write check and atomic rename. An existing lock refuses the write. The owner removes its lock in cleanup. Native agent overrides remain operator choices. Doctor cannot promise agent provenance or installed dependency versions when public metadata does not expose them.

Both independent implementation reviews accepted the repaired artifact. The optional P3 that unknown `/pstack` arguments produce a doctor report remains deferred. The initial implementation review itself performed no commit, publication, global settings change, or production action. The repository was subsequently published at the user's request. The parent integrated the worker changes and maintains the final design, research, plan, and decision records.
