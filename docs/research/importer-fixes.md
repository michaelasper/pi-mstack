# Importer fixes

Goal was to finish the maintainable Cursor pstack port through isolated fixes for audit findings 3–5. Consumers now get an explicit native mapping for `subagent_type`. Maintainers get independent bounded vocabulary checks, wider role-reference checks, and actionable lock recovery diagnostics.

## Changes

Integrate exactly these six files.

- `tools/importer.mjs` verifies live owner process-start evidence and refuses missing evidence, mismatches, and live owners. Missing or malformed owner metadata without a usable token requires manual inspection, never automatic deletion. Repair rechecks the entire owner record.
- `tools/render.mjs` independently extracts snake_case assignments, Task-call fields, and `.cursor/<directory>` paths from adapted Markdown source before patches. It checks explicit inventories and mapping references. Role checks now include model, selector, and panel wording and agent prose while preserving existing line/role detection.
- `port/required-terms.json` owns the validated field/path inventories and required mapping keys. Supervisor approved this schema change.
- `port/mappings.json` adds `subagent_type` and Cursor worktree mappings and classifies reviewed existing protocol fields.
- `tests/importer.test.mjs` checks inventory digest binding and matching process-start refusal.
- `tests/update.test.mjs` adds unknown fields/paths, source-before-patch scanning, historical exclusion, mapping output, role wording, invalid inventory, missing/malformed owner, PID reuse, and unavailable process-start regressions. Existing renderer rejection tests now call render directly instead of hand-editing acceptance.

No fallback patches or mandatory gates changed. No live-repository edits, installs, child launches, commits, or baseline mutations occurred.

## Verification

Final `node --test tests/importer.test.mjs tests/update.test.mjs` passed 15 tests with zero failures and one environment-gated Git inventory skip. The real pinned Git proposal separately exercised source inventory.

Executed successfully in the isolated copy.

```sh
node tools/upstream.mjs propose --repo /Users/asper/source/pi-mstack/.cache/cursor-plugins --commit 2776ddd2355d6d6c8747d3964600f28daf62f049
node tools/upstream.mjs accept --proposal .cache/proposal-qWonCA --reviewed 2554478eb9c86a88261e30c568853d17e9f936121d5502c48f9b1a5071fa82aa
node tools/upstream.mjs generate
npm run check
node --test tests/importer.test.mjs tests/update.test.mjs
```

The proposal had zero source changes. Acceptance was not hand-edited. Temporary publication changed only `upstream/acceptance.json`, `generated/docs/harness/pi.md`, `generated/host-coverage.json`, `generated/index.json`, and `generated/index.sha256`. Do not integrate those five test-only files or `.cache/proposal-qWonCA`.

Early test runs exposed expected stale acceptance after generator edits and the previously uninventoried `is_background` agent frontmatter field. Both were resolved through explicit inventory review and temporary reacceptance. Ordinary Git status/diff commands were unavailable because this copy has no `.git`; I reviewed file diffs against immutable `../baseline` instead. A Python whitespace check passed all six integration files.

Retained evidence.

- `/tmp/importer-final-tests.log` contains final test results.
- `/tmp/importer-final-check.log` contains the passing package check.
- `/tmp/importer-proposal.json` records the proposal and reviewed digest.
- `/tmp/importer-reviewed.diff` contains the reviewed six-file diff.
- `/tmp/importer-before-accept.log` and `/tmp/importer-scanner.log` retain intermediate failures.

## Limits

This is a bounded lexical scanner, not a detector of arbitrary new host words or semantic drift. Changed source still needs review. Role references outside the supported backticked wording remain a review responsibility. `ps lstart` is platform-dependent and coarse; missing or mismatched live evidence blocks repair rather than authorizing a takeover. Owners without usable metadata require operator inspection. Full packed/native suites were outside this lane. Parent must re-propose, accept, and regenerate after integrating all adaptation changes.

Model the Domain shaped the explicit field/path inventories. Laziness Protocol kept this within the existing renderer and lock repair rather than adding a policy engine. Prove It Works required real pinned proposal/acceptance and targeted regression runs. These principle leaves were read. Independent comment-review delegation was not run because child launches were forbidden; no code comments were added.

```acceptance-report
{
  "criteriaSatisfied": [{"id":"criterion-1","status":"satisfied","evidence":"Six isolated integration files fix audit findings 3–5; final targeted suite passed 15 tests with zero failures and one skip; residual limits documented."}],
  "changedFiles": ["tools/importer.mjs","tools/render.mjs","port/mappings.json","port/required-terms.json","tests/importer.test.mjs","tests/update.test.mjs"],
  "testsAddedOrUpdated": ["tests/importer.test.mjs","tests/update.test.mjs"],
  "commandsRun": [
    {"command":"node --test tests/importer.test.mjs tests/update.test.mjs","result":"passed","summary":"15 passed, 0 failed, 1 environment-gated skip."},
    {"command":"node tools/upstream.mjs propose/accept/generate (exact commands above)","result":"passed","summary":"Pinned source unchanged; isolated acceptance regenerated through supported commands."},
    {"command":"npm run check","result":"passed","summary":"Offline accepted source and generated tree match."}
  ],
  "validationOutput": ["/tmp/importer-final-tests.log","/tmp/importer-final-check.log","/tmp/importer-proposal.json","/tmp/importer-reviewed.diff"],
  "residualRisks": ["Bounded syntax detection still requires source review for semantic drift.","Ambiguous lock ownership requires operator inspection; ps evidence is platform-dependent.","Parent must regenerate acceptance after integration; packed/native suites were not run."],
  "noStagedFiles": true,
  "diffSummary": "Six integration files changed; five separately listed publication files are test-only.",
  "reviewFindings": ["No blockers in reviewed six-file diff."],
  "manualNotes": "Reviewed against immutable baseline because isolated copy has no Git metadata. Supervisor approved inventory schema change. No live repo edits or hand-edited acceptance. Temporary publication files must not be merged."
}
```
