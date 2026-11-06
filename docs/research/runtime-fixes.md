# Runtime fixes

Finish the maintainable Pi port through isolated runtime fixes. Users now get invalid-file protection, colon-bearing model selections, literal-message preservation, honest busy-mode refusal, and qualified policy diagnostics. Maintainers retain the existing modules and public contracts without a prompt-patching engine.

## Changes

- `extensions/pstack/config.ts` defaults only for missing files, strips only recognized terminal thinking suffixes, preserves colon-bearing IDs, retains exact authenticated-registry checks, explains safe lock recovery, and labels public merged settings as observations rather than effective native policy.
- `extensions/pstack/index.ts` ignores extension-source input for mode interception, matches the host's ASCII-space grammar, and refuses busy activations or toggles before persistence. Refused tasks are explicitly not queued.
- `tests/runtime.test.mjs` adds config, exact-selector, and lock regressions, including blocked role data for empty files.
- `tests/setup.test.mjs` proves real RPC setup refuses an empty file without dialogs or changed bytes.
- `tests/runtime-regressions.test.mjs` adds four real packed-package RPC regressions covering Sol's findings. Busy enable and disable leave both persisted and provider-visible state unchanged. Trusted project scope replacement succeeds through native subagent despite conflicting user restrictions. HOME is outside the project.
- `tests/fixtures/runtime-literal-message.ts` is a new uniquely named fixture for non-expanding extension traffic.

No shared fixtures, importer, verification-lane tests, dependencies, baseline, or live repository files changed. `tests/sdk.test.mjs` remains unchanged. No commits or staging operations occurred.

## Design and review

Read the supplied Poteto skill, generated Pi adapter, design document, TypeScript guidance, native model docs and suffix implementation, and Sol's early audit. The data shape remains discriminated `ConfigState` and exact provider/model/thinking selections. Native suffix semantics reserve recognized final thinking words. A literal model ID ending in `:high` needs an additional explicit suffix, for example `provider/model:high:off`. No fuzzy fallback was added.

The existing lock already failed immediately. Its raw EEXIST error lacked recovery instructions. The repair names the lock and requires confirmation that no setup writer is running before manual removal. It never steals ownership automatically.

Laziness Protocol kept repairs local. Model the Domain retained the existing state shapes. Type System Discipline kept checked error narrowing. Test Behavior, Not Implementation required byte, state, provider-message, and native-launch assertions. Reviewed exact diffs against immutable baseline. No comments were added and no review agents were launched.

## Checks and retained evidence

- `node --test tests/runtime.test.mjs` initially reproduced all three original regressions. Four existing tests passed.
- `node --test tests/runtime-regressions.test.mjs` with baseline runtime bytes temporarily copied into owned local files failed all four new regressions. A finally block restored the fixes. Baseline itself was untouched.
- `MSTACK_KEEP_TEST_ARTIFACTS=1 node --test tests/runtime.test.mjs tests/setup.test.mjs tests/sdk.test.mjs tests/runtime-regressions.test.mjs` passed all 13 tests.
- `node --test tests/runtime.test.mjs` passed all seven after adding the final empty-file role-data assertion.
- `npm run typecheck` passed after the final edit.
- `diff -u` reviewed both runtime modules. `diff -qr ../baseline/extensions/pstack extensions/pstack` and `diff -qr ../baseline/tests tests` confirmed exactly the six files above. Difference exit status 1 was expected.
- `git status --short` failed because this isolated directory has no Git metadata.

Final RPC evidence is retained at `/var/folders/0v/d5b2yvfs1tx739ndg_0m3vqr0000gn/T/mstack-packed-tUWKId/{literal,grammar,busy,policy}/runtime-evidence.json`. Those files include RPC records, provider requests, and stderr. This report and the regression tests retain the remaining evidence.

## Residual risks

Lock recovery still requires operator confirmation because no owner metadata exists. Native policy precedence is deliberately unverified by doctor; native preflight remains authoritative. Extension-origin skill text does not activate persistent mode, including opt-in expansion, because the input event provides no expansion-intent field. Busy mode tasks require retry after settlement. Tests use deterministic providers, not paid OpenRouter inference or real-model prose compliance. Parent-owned final package acceptance and review remain outstanding.

```acceptance-report
{
  "criteriaSatisfied": [{"id":"criterion-1","status":"satisfied","evidence":"Original defects and Sol findings repaired; 13 targeted tests passed; final runtime assertion and typecheck passed."}],
  "changedFiles": ["extensions/pstack/config.ts", "extensions/pstack/index.ts", "tests/runtime.test.mjs", "tests/setup.test.mjs", "tests/runtime-regressions.test.mjs", "tests/fixtures/runtime-literal-message.ts"],
  "testsAddedOrUpdated": ["tests/runtime.test.mjs", "tests/setup.test.mjs", "tests/runtime-regressions.test.mjs", "tests/fixtures/runtime-literal-message.ts"],
  "commandsRun": [
    {"command":"node --test tests/runtime-regressions.test.mjs (baseline runtime)","result":"failed","summary":"All four new audit regressions reproduced."},
    {"command":"MSTACK_KEEP_TEST_ARTIFACTS=1 node --test tests/runtime.test.mjs tests/setup.test.mjs tests/sdk.test.mjs tests/runtime-regressions.test.mjs","result":"passed","summary":"13 tests passed."},
    {"command":"node --test tests/runtime.test.mjs","result":"passed","summary":"Final seven tests passed."},
    {"command":"npm run typecheck","result":"passed","summary":"Final tsc passed."}
  ],
  "validationOutput": ["13 passed, 0 failed", "Final runtime assertions passed", "Typecheck passed", "Six-file diff reviewed against baseline"],
  "residualRisks": ["Manual stale-lock recovery requires confirming no writer is active.", "Native policy precedence remains unverified by doctor.", "Busy tasks require retry; extension-source text does not activate persistent mode.", "No live-model compliance or final package acceptance claimed."],
  "noStagedFiles": true,
  "diffSummary": "Six scoped files fix config parsing, selectors, lock guidance, input intent and grammar, busy state, and policy diagnostics with regressions.",
  "reviewFindings": ["No blockers in reviewed diff."],
  "manualNotes": "Consumer and maintainer impact, exact checks, evidence paths, and residual risks are recorded above. No Git index exists in the isolated directory. Sol steering incorporated."
}
```
