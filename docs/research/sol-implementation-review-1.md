# Final implementation review

The goal is a maintainable full Cursor pstack port to Pi, with native scheduling and delegation, reproducible updates, and explicit capability gaps.

## Findings

No blocking implementation defects found. **ACCEPT** for the documented port contract, not Cursor service parity or arbitrary-model compliance.

### Optional P3. Narrow the native wake coverage claim

`docs/verification.md:32` says captures prove mode and roles on both native wakes. `tests/native.test.mjs:24-80` never enables mode, and its provider-wake predicates assert delivery tokens without asserting role-data sections. The retained native evidence has role data and mode off on both wakes. SDK coverage separately demonstrates an enabled-mode custom wake, but that is not the native monitor/completion combination.

Reproduction is inspection of `native-evidence.json` under the retained native directory listed below. The requests ending in `MONITOR_PROVIDER_WAKE` and run ID `f97dbf16-aa3b-4f13-9f0b-a50ceab67ae2` both omit `<pi-mstack-mode>` and contain `<pi-mstack-role-data>`.

Consumer behavior is not shown to be broken. Maintainers could overestimate this regression gate. Minimal improvement is to describe native wake coverage as mode-off role delivery and assert the role section in both matching requests. Add an enabled-mode native variant if that broader claim is intended. This is an optional coverage/documentation improvement, not a rejection reason.

## Assumptions and scope

Reviewed files directly because the repository has no HEAD and implementation files are untracked. Read the requested design, maintenance, configuration, verification, research audits and repair reports, package metadata, runtime modules, importer/rendering tools, port registries/templates/patches, test sources and fixtures, and relevant generated skills, scripts, agents, and adapter. The supplied installed skill's adjacent adapter was absent. The repository's actual generated Pi adapter was read and used.

No repository edits, installs, global changes, commits, publications, or delegated child launches occurred. Native agents were not relaunched. Existing retained runtime records were independently inspected and compared with the current implementation. The no-comments child-launch step was skipped under the explicit no-children constraint. The earlier comment audit was read, and no actionable first-party source-comment issue was found during this review.

## Verified implementation

- Source accounting passes for all 573 records at `2776ddd2355d6d6c8747d3964600f28daf62f049`. The disposition counts are 422 copy, 114 adapt, 21 historical, 12 dormant, three provenance, and one capability gap. Six executable source files retain executable status. The real Git-object inventory also passes.
- Standard packed export reconstructs all original paths, hashes, and executable status. The sole raw `.gitignore` storage mapping preserves source identity. The packed checks independently verify 58 skill names, visibility, licensing, dormant exclusion, maintenance scripts, and private-state exclusion.
- The former stale acceptance digest and missing generated index are repaired. Offline check and deterministic regeneration tests pass. Digest binding covers tools, registries, templates, and source manifest. Local Git fixtures prove additions, removals, content/mode drift, rejected stale approvals, interrupted acceptance recovery, and generated repair without deleting unowned files.
- Lock repair now checks process-start evidence and fails closed on live, reused, unavailable, or malformed ownership. Vocabulary and role-reference regressions cover the documented bounded grammar. They do not claim semantic completeness.
- Config parsing rejects existing empty files, retains colon-bearing exact model IDs, preserves ordered panels, and resolves inheritance explicitly to the current parent selector. Registry validity is separate from native eligibility. Public merged settings are labeled observations, not effective native precedence.
- Input handling leaves literal extension messages intact, follows ASCII-space skill syntax, checks resource ownership before mutation, and refuses busy mode requests without persistence or queued tasks. Retained busy requests show unchanged enabled prompts, then disabled prompts after idle retry. Branch reduction and retained SDK/RPC coverage support resume, forks, navigation, reload, and role availability while mode is off.
- Native evidence proves real package-agent discovery, an asynchronous child with a separate PID, explicit `script/model` selection despite an `other` agent override, correlated completed run attribution, retained `child.md`, and separate provider-visible monitor and completion wakes. This conclusion uses actual output and provider requests, not launch receipts. Both recorded native PIDs are now absent.
- The retained packed implementations match this checkout byte-for-byte across all 570 files under `extensions/`, `tools/`, `port/`, `generated/`, and `tests/` in each retained package. The evidence is not from an older runtime build.
- The adapter and exact fallback patches preserve mandatory verification and authority gates. Missing independent product verification, required UI control, explicit reviewers, and required diversity remain blockers. Missing Cursor services remain capability gaps. The port does not route delegation through the incompatible optional RPC bridge.

For consumers, this is a native skill port with explicit operational limits and no silent model substitution. Maintainers inherit a pinned snapshot, one adaptation policy, reproducible generation, and executable recovery tests rather than a hand-maintained workflow fork.

Prove It Works changed the review from trusting passing summaries to comparing packed bytes, inspecting actual native output and provider-visible wakes, and rerunning source/update checks. Unslop kept findings concrete and separated measured evidence from unverified claims.

## Tests and retained evidence

Checks run in this review:

1. `npm run check` passed.
2. `npm run typecheck` passed.
3. `MSTACK_GIT_TESTS=1 node --test tests/importer.test.mjs tests/update.test.mjs tests/runtime.test.mjs` passed 23 tests with no skips.
4. `node --test --test-name-pattern='tarball preserves|packed maintenance|packed CLI exports|advertised scripts' tests/packed.test.mjs` passed four selected tests with no skips.
5. Python inspection asserted native completion/run-ID correlation, retained output, provider-visible wakes, process exit, busy task exclusion, and packed/current byte identity.
6. `git diff --cached --name-only` returned no staged files.

Review logs are `/tmp/pi-mstack-sol-static-checks.log`, `/tmp/pi-mstack-sol-final-checks.log`, `/tmp/pi-mstack-sol-packed-checks.log`, and `/tmp/pi-mstack-sol-retained-evidence.log`.

The parent full check/typecheck/43-test run was inspected at `/tmp/pi-mstack-integrated-tests.log`. It passed with no skips. This review did not independently rerun the entire CLI/PTY/RPC/native suite.

Native evidence is `/var/folders/0v/d5b2yvfs1tx739ndg_0m3vqr0000gn/T/mstack-packed-RDTS3b/native/native-evidence.json`, its adjacent `child.md`, and native run state. RPC regression evidence is under `/var/folders/0v/d5b2yvfs1tx739ndg_0m3vqr0000gn/T/mstack-packed-6ymcOm/{literal,grammar,busy,policy}/runtime-evidence.json`.

## Residual limitations and verdict

Scripted providers prove host contracts, not arbitrary-model adherence to every adapted workflow. Lexical checks do not prove semantic fidelity for every source paragraph. No paid-model, renderer, Java/TLC, forge, cloud, bot, or missing external control-service integration is established. Native policy and agent provenance still require actual native preflight. Busy mode changes require idle retry. Worktrees are not cloud isolation, and scheduling requires a live host. Ambiguous locks require operator inspection.

**ACCEPT.** No blocking findings remain within the documented implementation contract. The optional native-wake coverage clarification does not authorize weakening any mandatory gate. Parent owns fixes and final acceptance.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Fresh read-only final review returned ACCEPT, one optional P3 coverage clarification, exact checks, retained evidence, and explicit residual limitations."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {"command": "npm run check", "result": "passed", "summary": "Accepted source and generated resources match."},
    {"command": "npm run typecheck", "result": "passed", "summary": "No TypeScript diagnostics."},
    {"command": "MSTACK_GIT_TESTS=1 node --test tests/importer.test.mjs tests/update.test.mjs tests/runtime.test.mjs", "result": "passed", "summary": "23 passed, zero failures or skips."},
    {"command": "node --test --test-name-pattern='tarball preserves|packed maintenance|packed CLI exports|advertised scripts' tests/packed.test.mjs", "result": "passed", "summary": "Four selected artifact checks passed."},
    {"command": "Python retained-evidence inspection and packed/current byte comparison", "result": "passed", "summary": "Actual native output and wake requests verified; 570 implementation/resource files match each retained package; native PIDs exited."},
    {"command": "git diff --cached --name-only", "result": "passed", "summary": "No staged files."}
  ],
  "validationOutput": [
    "/tmp/pi-mstack-sol-static-checks.log",
    "/tmp/pi-mstack-sol-final-checks.log",
    "/tmp/pi-mstack-sol-packed-checks.log",
    "/tmp/pi-mstack-sol-retained-evidence.log",
    "/tmp/pi-mstack-integrated-tests.log"
  ],
  "residualRisks": [
    "Scripted runtime evidence does not establish arbitrary-model workflow compliance or external service parity.",
    "Native monitor/completion coverage currently runs with mode off; enabled-mode native wake coverage is an optional improvement.",
    "Bounded lexical scanning still requires semantic upstream review.",
    "Native policy/provenance require preflight; busy mode changes require idle retry; scheduling requires an active host.",
    "Full native/CLI suite was inspected through retained matching artifacts and parent logs rather than relaunched in this review."
  ],
  "noStagedFiles": true,
  "diffSummary": "No repository changes. Review artifact written outside the repository.",
  "reviewFindings": [
    "No blockers. ACCEPT for the documented port contract.",
    "Optional P3: docs/verification.md:32 and tests/native.test.mjs:24-80 should distinguish mode-off native wake evidence from enabled-mode coverage and assert role sections explicitly."
  ],
  "manualNotes": "Reviewed implementation files rather than an absent HEAD diff. Retained native output and provider-visible delivery independently inspected. No delegated children launched. Consumer impact, maintainer impact, repair verification, exact checks, and evidence paths are recorded above."
}
```
