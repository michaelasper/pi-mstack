# Verification fixes

The goal is faster delivery of a maintainable Cursor pstack port to Pi. Consumers now have stronger regression coverage for actual native wakes, child results, and packaged CLI tasks. Maintainers get independent artifact checks and explicit prose-only gate tests. Production behavior is unchanged.

## Changes

Modified only `tests/native.test.mjs`, `tests/packed.test.mjs`, `tests/helpers.mjs`, `tests/pty-smoke.py`, and `tests/fixtures/provider.ts`. Added `tests/adapter.test.mjs`.

Native tests inspect actual active tools before conditionally enabling subagents. They assert enable and launch success, require a custom `pi-loop` `monitor:done` message, correlate completed native runs with launch IDs and retained output paths, require parent-PID provider requests ending with each wake, and await `agent_settled` after both notifications. Cleanup checks parent and captured child process termination, including teardown after assertion failures.

Packed maintenance checks no longer prevent export, license, inventory, or script-resource checks from running. Export uses the packed CLI. Script targets and excluded private-state paths are inspected. Native print/JSON and PTY routes assert the task, packaged absolute skill path, and mode section. JSON completion events are parsed. PTY cleanup reports verified process exit. Experimental forwarding remains separate from supported native invocation.

Adapter tests inspect shipped mandatory-blocker instructions for Shipping, UI control, explicit reviewers, and optional evidence. Test names explicitly disclaim model-behavior coverage.

Model the Domain shaped the event predicates and table of gate scenarios. Test Behavior, Not Implementation changed wake assertions from substring matches to actual native delivery plus provider requests. Prove It Works drove packed CLI execution and process-liveness assertions. Throughput checkpoint used the existing scripted provider and isolated packed environments rather than adding another harness. No child review agents were launched.

## Verification

- `MSTACK_KEEP_TEST_ARTIFACTS=1 node --test --test-concurrency=1 tests/native.test.mjs tests/packed.test.mjs tests/adapter.test.mjs` passed all 14 tests.
- `MSTACK_KEEP_TEST_ARTIFACTS=1 node --test --test-concurrency=1 tests/*.test.mjs` passed 30, skipped 1, failed 0 across 31 tests. The existing upstream-checkout Git test remains conditional.
- `node node_modules/typescript/bin/tsc` passed.
- `node tools/upstream.mjs check` passed.
- `git diff --no-index --check ../baseline/tests tests` passed. Reviewed the baseline comparison. Ordinary Git status/diff was unavailable because this isolated directory has no `.git`.

An initial native run failed because provider context does not expose tools there. The fixture now uses the actual public `pi.getActiveTools()` API. Native reruns passed. No installs, commits, dependency mutations, or live-repository edits occurred.

Retained evidence includes `/tmp/verification-targeted.log`, `/tmp/verification-all.log`, `/tmp/verification-typecheck.log`, `/tmp/verification-diff.txt`, and `/var/folders/0v/d5b2yvfs1tx739ndg_0m3vqr0000gn/T/mstack-packed-aMhaPM/native/native-evidence.json`. The latter retains native events, provider requests, and the adjacent `child.md` output.

## Residual risks

Scripted providers prove API contracts, not arbitrary-model instruction compliance or Cursor service parity. Prose tests intentionally pin gate wording. This run used isolated environments and offline scripted providers, not an OS network sandbox. Experimental one-shot forwarding produced no completed output and zero captured requests in this run; it remains unsupported rather than being treated as successful.

```acceptance-report
{
  "criteriaSatisfied": [{"id":"criterion-1","status":"satisfied","evidence":"Owned test repairs completed; targeted 14/14 passed, full suite 30 passed and 1 skipped; risks documented."}],
  "changedFiles": ["tests/native.test.mjs","tests/packed.test.mjs","tests/helpers.mjs","tests/pty-smoke.py","tests/fixtures/provider.ts","tests/adapter.test.mjs"],
  "testsAddedOrUpdated": ["tests/native.test.mjs","tests/packed.test.mjs","tests/adapter.test.mjs","tests/pty-smoke.py"],
  "commandsRun": [
    {"command":"MSTACK_KEEP_TEST_ARTIFACTS=1 node --test --test-concurrency=1 tests/native.test.mjs tests/packed.test.mjs tests/adapter.test.mjs","result":"passed","summary":"14 passed"},
    {"command":"MSTACK_KEEP_TEST_ARTIFACTS=1 node --test --test-concurrency=1 tests/*.test.mjs","result":"passed","summary":"30 passed, 1 skipped, 0 failed"},
    {"command":"node node_modules/typescript/bin/tsc","result":"passed","summary":"No diagnostics"},
    {"command":"node tools/upstream.mjs check","result":"passed","summary":"Accepted snapshot and generated artifacts valid"},
    {"command":"git diff --no-index --check ../baseline/tests tests","result":"passed","summary":"No whitespace errors"}
  ],
  "validationOutput": ["/tmp/verification-all.log","/tmp/verification-targeted.log","/var/folders/0v/d5b2yvfs1tx739ndg_0m3vqr0000gn/T/mstack-packed-aMhaPM/native/native-evidence.json"],
  "residualRisks": ["Scripted API contracts and deterministic prose assertions do not prove model compliance.","Existing optional upstream-checkout Git test skipped.","No OS network sandbox used."],
  "noStagedFiles": true,
  "diffSummary": "Six owned test sources changed; no production changes.",
  "reviewFindings": ["No blockers in baseline diff review."],
  "manualNotes": "Reviewed retained native completion schema and real monitor wake. No repository index exists in this isolated cwd. Parent must integrate only owned test sources."
}
```
