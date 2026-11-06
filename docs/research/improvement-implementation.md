# Implementation result

The goal is to implement the actionable pi-mstack improvements in the isolated copy, leaving independent review, regeneration, and GitHub publication to the parent. All six assigned areas have implementations and regression coverage. This is an implementation handoff, not final acceptance.

Consumers get exact custom-provider selection without false unavailable blockers. Maintainers get validated maintenance arguments, bounded lock-error cleanup, input-level drift diagnostics, hermetic inventory coverage, and documented evidence retention. Existing modules remain the implementation boundaries.

## Disposition and exact source files

1. **Exact selectors.** `extensions/pstack/config.ts` now parses an exact selector into a combined registry ID plus its recognized final thinking suffix. It resolves against `${provider}/${id}` rather than inventing a provider boundary. Colon and URL provider names pass configuration validation. Multiple matches block as ambiguous. Missing models, unsupported thinking, inheritance, scope diagnostics, and no-substitution behavior remain. `tests/runtime.test.mjs`, `tests/sdk.test.mjs`, and `tests/fixtures/provider.ts` cover custom providers, explicit and inherited choices, unavailable selections, picker round trips, ambiguity, and provider-visible SDK prompts without extension errors. `docs/configuration.md` describes the behavior.
2. **Maintenance CLI.** `tools/upstream.mjs` uses a command specification with required and optional flags. Unknown commands, unexpected arguments, unknown or duplicate options, and missing values fail before importer dispatch. Root parsing is inside the error boundary. Errors include command-specific usage. `generate --check` now actually requests the read-only check instead of silently ignoring the flag. `tests/update.test.mjs` spawns malformed invocations in an empty workspace and asserts no state was created.
3. **Owner write errors.** `tools/importer.mjs` opens the owner record exclusively and records directory and file identities. A caught write error removes only matching owned state, using nonrecursive directory removal. A replacement or nonempty ambiguous lock remains. `tests/importer.test.mjs` injects a partial owner write and a replacement-lock fault. Existing live, missing, malformed, foreign, and reused-PID repair tests remain unchanged. This is not process-death recovery or protection against hostile filesystem races.
4. **Input diagnostics.** `tools/importer.mjs` stores schema-2 acceptance with per-file `{ path, sha256 }` inputs. It validates entry shape, safe paths, duplicates, schema, and the inventory's binding to the stored review digest and current source manifest before comparing current inputs. Diagnostics list added, removed, and changed paths. The digest formula remains unchanged. Schema 1 and tampered inventory block. `tests/update.test.mjs` covers all three drift categories, malformed inventory, old schema, digest tampering, and duplicate paths.
5. **Hermetic inventory.** `tests/update.test.mjs` creates a local 66-file Git fixture with spaces, Unicode, nesting, and an executable script. It compares inventory bytes and hashes with committed Git blobs and proves checkout edits are ignored. It requires neither network nor a cached upstream checkout. The existing optional pinned-cache test remains optional.
6. **Retention and recovery.** No automatic proposal or stage deletion was added. `docs/maintenance.md` documents explicit manual retention decisions, schema migration, lost proposals, and pending journals. `.mstack-pending` stores the reviewed digest, not a proposal path. `tools/importer.mjs` reports recovery guidance when a journal blocks generation. `tests/update.test.mjs` verifies old proposals survive later acceptance and a lost proposal leaves the journal blocked until a freshly reviewed replacement is accepted. Interrupted stages remain retained.

`docs/reference/maintenance.md` is the new Diataxis reference for commands, schema, and retained state. `docs/index.md` links it. `docs/verification.md` describes the added coverage. No raw upstream files, port inputs, PLAN.md, decisions.tsv, or research records changed.

## Checks and retained evidence

All commands ran in `/tmp/pi-mstack-improvements.CQYSLq`, except read-only baseline extraction from the authorized live repository.

- Reproduced the original `node tools/upstream.mjs accept` missing-flag TypeError and slash-provider inherited-role false blocker before implementation.
- Ran the new SDK regression against original `config.ts` from commit `3fab20540f2aaa5e4a0287e55389382ea09e0a8b`. It failed at the custom-provider registry-valid prompt assertion. Evidence is `/tmp/mstack-implementation-sdk-before.log`. The implementation file was then restored.
- Ran `node --test --test-name-pattern 'owner write failures' tests/importer.test.mjs` against original importer code. It failed because the lock remained after the injected owner write failure. Evidence is `/tmp/mstack-implementation-lock-before.log`.
- Ran `node --test --test-name-pattern 'CLI rejects' tests/update.test.mjs` against original CLI code. It failed because usage was missing. Evidence is `/tmp/mstack-implementation-cli-before.log`.
- `node --test tests/runtime.test.mjs tests/sdk.test.mjs` passed all nine tests. Evidence is `/tmp/mstack-implementation-runtime.log`.
- The initial maintenance run passed the new focused tests but failed two existing generation fixtures because the copied acceptance was still schema 1. This expected migration blocker is retained in `/tmp/mstack-implementation-maintenance-before-accept.log`.
- Final `npm test` passed 51 tests, failed none, and skipped the one optional cached-upstream test. It included actual native tool-launched deterministic child fixtures, monitor wake delivery, preflight rejection, packed SDK, RPC, and PTY checks. Evidence is `/tmp/mstack-implementation-full.log`.
- Final `npm run typecheck` and `npm run check` passed. Evidence is `/tmp/mstack-implementation-typecheck.log` and `/tmp/mstack-implementation-check.log`.
- `MSTACK_KEEP_TEST_ARTIFACTS=1 npm run test:native` passed both tests. Evidence is `/tmp/mstack-implementation-native.log`. Retained native output and state are at `/var/folders/0v/d5b2yvfs1tx739ndg_0m3vqr0000gn/T/mstack-packed-9GXUf7/native`.
- Final `node tools/upstream.mjs accept` returned the expected nonzero missing-option error with useful usage. Evidence is `/tmp/mstack-implementation-cli-after.log`.

## Isolated acceptance is test-only

Ran:

```sh
node tools/upstream.mjs propose --repo /Users/asper/source/pi-mstack/.cache/cursor-plugins --commit 2776ddd2355d6d6c8747d3964600f28daf62f049
node tools/upstream.mjs accept --proposal .cache/proposal-drqEsQ --reviewed 1f142e0089a29932768d1fc74e1b32da021bd3f821134f3fcb03f6fb4f56ddbd
npm run generate
npm run check
```

Before acceptance, inspected the complete tools diff, read `review.json`, compared the proposed manifest byte-for-byte with the original, and recomputed the exact digest. The source change list was empty. The proposal and review evidence remain at `.cache/proposal-drqEsQ` and `/tmp/mstack-implementation-proposal.json`. Older isolated proposals remain retained.

`upstream/acceptance.json` is the only changed upstream artifact and is test-only. `generated/` and `port/` remain byte-identical to the baseline. The parent should integrate the source files and independently propose, review, accept, and generate rather than treating this isolated acceptance as approval.

## Diff review and approach

This workspace is a filesystem copy without `.git`. Read-only `git archive` from the supplied baseline populated `/tmp/mstack-implementation-baseline`. Reviewed the source comparison retained at `/tmp/mstack-implementation-source.diff`, including the new reference document separately. No files were staged, committed, installed, or pushed. No live workspace or shared node_modules files were edited.

The organizing data shapes are a selector union with a combined ID, a CLI command-specification table, and a versioned accepted input inventory. Model the Domain and Type System Discipline kept selector state explicit. Boundary Discipline moved validation ahead of CLI side effects and validates acceptance before diagnostics. Laziness Protocol kept changes in existing runtime and importer modules. Prove It Works required original-code failures and provider-visible SDK evidence. Technical Writing separated recovery instructions from reference facts. Unslop shaped the documentation wording.

The work proceeded in independently checked units for selectors, maintenance safety, schema migration, and full integration. No coding agents were launched. The no-comments skill was read, but its delegation step was not run because this assignment prohibits child coding agents. The sole new implementation comment explains why ambiguous cleanup failures leave state for manual inspection.

## Residual risks

- Parent-owned fresh review, final regeneration, release acceptance, and publication remain outstanding.
- Lock cleanup is bounded to caught failures and observed filesystem identity. Process death, failing cleanup operations, hostile local mutation, and all filesystem interleavings are not covered.
- Schema 1 acceptance intentionally blocks until explicit re-review. The digest provides content binding, not signer authentication. A party able to rewrite all source and approval metadata is outside that trust model.
- Lost-proposal recovery requires the intended commit and adaptation inputs to be independently established. The pending journal alone cannot reconstruct them.
- The cached-upstream optional test was skipped in the full suite. The authorized pinned commit was nevertheless inventoried during the actual isolated proposal flow, and default hermetic inventory coverage passed.
- Scripted provider tests establish host API behavior, not arbitrary-model compliance. Paid models, external services, renderer, Java, TLC, forge, and enabled-mode native completion/monitor wakes remain outside this change's verification.
- Evidence paths are local temporary artifacts, not durable release attachments.

```acceptance-report
{
  "criteriaSatisfied": [
    { "id": "criterion-1", "status": "satisfied", "evidence": "Six scoped implementation dispositions, exact checks, retained evidence, and residual risks are documented above. Final release acceptance remains parent-owned." }
  ],
  "changedFiles": ["extensions/pstack/config.ts", "tools/importer.mjs", "tools/upstream.mjs", "tests/fixtures/provider.ts", "tests/importer.test.mjs", "tests/runtime.test.mjs", "tests/sdk.test.mjs", "tests/update.test.mjs", "docs/configuration.md", "docs/index.md", "docs/maintenance.md", "docs/reference/maintenance.md", "docs/verification.md", "upstream/acceptance.json"],
  "testsAddedOrUpdated": ["tests/fixtures/provider.ts", "tests/importer.test.mjs", "tests/runtime.test.mjs", "tests/sdk.test.mjs", "tests/update.test.mjs"],
  "commandsRun": [
    { "command": "node --test tests/sdk.test.mjs against original config.ts", "result": "failed", "summary": "Expected custom-provider regression reproduced." },
    { "command": "node --test --test-name-pattern 'owner write failures' tests/importer.test.mjs against original importer", "result": "failed", "summary": "Expected stale lock regression reproduced." },
    { "command": "node --test --test-name-pattern 'CLI rejects' tests/update.test.mjs against original CLI", "result": "failed", "summary": "Expected missing-usage regression reproduced." },
    { "command": "node --test tests/runtime.test.mjs tests/sdk.test.mjs", "result": "passed", "summary": "Nine tests passed." },
    { "command": "npm test", "result": "passed", "summary": "51 passed, zero failed, one optional cached-upstream skip." },
    { "command": "npm run typecheck", "result": "passed", "summary": "TypeScript passed." },
    { "command": "npm run generate && npm run check", "result": "passed", "summary": "Isolated schema-2 acceptance validated; generated bytes unchanged." },
    { "command": "MSTACK_KEEP_TEST_ARTIFACTS=1 npm run test:native", "result": "passed", "summary": "Both native tests passed with retained evidence." }
  ],
  "validationOutput": ["/tmp/mstack-implementation-full.log", "/tmp/mstack-implementation-native.log", "/tmp/mstack-implementation-source.diff"],
  "residualRisks": ["Fresh parent review and publication remain outstanding.", "Caught lock-write recovery does not cover process death or hostile filesystem races.", "Legacy acceptance requires explicit re-review.", "Lost-proposal recovery needs independently established intended inputs.", "Scripted-provider and local filesystem evidence do not cover all external integrations."],
  "noStagedFiles": true,
  "diffSummary": "Scoped runtime, maintenance, regression, and Diataxis documentation changes. Only upstream/acceptance.json changed for isolated testing; generated and port bytes are unchanged.",
  "reviewFindings": ["No self-review blockers found. Independent parent review remains required."],
  "manualNotes": "Do not integrate the isolated acceptance as final approval. The parent owns independent source review and regeneration. Workspace has no Git metadata; baseline was extracted read-only from commit 3fab20540f2aaa5e4a0287e55389382ea09e0a8b."
}
```
