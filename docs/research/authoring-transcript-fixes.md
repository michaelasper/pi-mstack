# Authoring and transcript repairs

The goal is a maintainable Pi port with executable native workflows and fresh parent-owned acceptance. This isolated implementation fixes both Muse P2 findings and narrows Sol's native-wake claim. It does not claim final acceptance.

Consumers now get a self-contained skill-authoring procedure with discoverable project and personal destinations. Transcript workflows use the current Pi session or exact authorized retained paths. Cross-chat mining without an authorized corpus is blocked. Maintainers inherit hash-bound exact patches, registered vocabulary, packed prose regressions, and an executable shell acquisition test. No runtime module or tool changed.

## Integrate only these source files

- `port/mappings.json`.
- `port/patches.json`.
- `port/required-terms.json`.
- `tests/adapter.test.mjs`.
- `tests/native.test.mjs`.
- `docs/implementation-notes.md`.
- `docs/verification.md`.

All changes are in `/tmp/pi-mstack-authoring.iVunB5`. The raw upstream tree is byte-identical to the live checkout. No commits, installations, global changes, or child-agent launches occurred.

## Changes reviewed

Exact patches cover automate-me, reflect and its reviewer/synthesizer references, recall, create-verification-skill, maintain-verification-skill, poteto-help, Poteto Mode, authoring-a-skill, session-pickup, eval, and show-me-your-work. The authoring procedure specifies destinations, frontmatter, operational instructions, discovery checks, positive and negative cases, description tuning, retained evidence, and caller approval rules. It does not delegate back to itself or depend on create-skill.

The adapter uses `printf '%s\n' "${PI_SESSION_FILE:-}"` in Pi's local built-in shell tool. Installed Pi 1.5.0 environment-variable and extension documentation plus `dist/core/tools/bash.js` verify injection and its limitations. The new test executes that command and the header-read command through the installed shell definition with a real SessionManager. It checks persistent, ephemeral, and disabled-exposure cases. No `/session` assumption is required. Header identity and workspace checks precede entry reads. Session-wide files are not presented as the active branch. Parent-session pointers do not grant access to other histories.

Both actual native-wake request predicates now assert role data and absence of enabled-mode data. Documentation distinguishes mode-off native monitor/completion coverage from enabled-mode SDK custom wakes. Native tests were syntax-checked but not executed here because this task forbids child-agent launches.

Implementation notes now label previous 43-test and native records as historical run evidence, correct setup lock semantics, and leave final digest and integration evidence to the parent.

Principles applied. Laziness Protocol kept changes inside the existing registry and exact-patch machinery. Prove It Works required packed output inspection and an executable acquisition check. Test Behavior, Not Implementation shaped assertions around shipped instructions and shell results. Writing-skills guidance informed the failing baseline and explicit distinction between lexical checks and model compliance. Its model pressure-test and deployment steps remain unrun under the no-children and no-publication constraints. The installed Poteto skill's adjacent Pi adapter was absent, so I read the repository's generated Pi adapter. No-comments delegation was likewise prohibited. I reviewed the source diff directly.

## Checks and retained evidence

- Baseline `node --test tests/adapter.test.mjs` failed both added prose regressions, with four existing gates passing. Evidence is `/tmp/authoring-red.log`.
- Final `node --test tests/adapter.test.mjs` passed seven tests. Evidence is `/tmp/authoring-green.log`.
- `npm run check` passed. Evidence is `/tmp/authoring-check.log`.
- `npm run typecheck` passed. Evidence is `/tmp/authoring-typecheck.log`.
- `node --test tests/importer.test.mjs tests/update.test.mjs tests/runtime.test.mjs` passed 22 tests with one optional local Git-cache inventory test skipped. Evidence is `/tmp/authoring-static.log`. The pinned Git source was separately inventoried by propose.
- `node --test --test-name-pattern='tarball preserves|packed maintenance|packed CLI exports|advertised scripts' tests/packed.test.mjs` passed four tests. Evidence is `/tmp/authoring-packed.log`.
- `node --check tests/native.test.mjs` passed.
- `bash -n generated/skills/poteto-mode/scripts/worktree-audit.sh` passed.
- Raw upstream comparison returned no differences. Source whitespace checks passed. The isolated copy has no Git index. No-index whitespace output is `/tmp/authoring-whitespace.log`; exit status 1 denotes differing source files, with no whitespace diagnostics.
- Reviewed source diff is `/tmp/authoring-source.diff`.

## Tests-only generated state

Ran `node tools/upstream.mjs propose --repo /Users/asper/source/pi-mstack/.cache/cursor-plugins --commit 2776ddd2355d6d6c8747d3964600f28daf62f049`. It reported no upstream source changes. Proposal evidence is `/tmp/authoring-proposal.json` and `.cache/proposal-ak0GXF` in the isolated copy.

Reviewed and accepted exact digest `30ccca761e15ac1ae1121e0ffc591f2e4aa2a23d217e7c91dd6146ccc2b0b281`, then ran `node tools/upstream.mjs generate`. This changed isolated `upstream/acceptance.json` and regenerated resources and indexes only for testing. Do not integrate those generated files or acceptance state. Parent must regenerate and refresh acceptance after integrating source changes.

## Residual risks

Lexical regressions do not prove arbitrary-model compliance. No fresh Muse or Sol acceptance is claimed. Native wake assertions need execution after integration. Overridden and remote shells may not expose session metadata and must use the documented exact-path fallback. Cross-chat recall remains blocked without an authorized corpus. Full-suite, real-model authoring, and minimum-Node-version validation remain parent-owned.

```acceptance-report
{
  "criteriaSatisfied": [{"id":"criterion-1","status":"satisfied","evidence":"Scoped fixes, exact source paths, failing baseline and passing regressions, evidence paths, tests-only generated state, and residual risks reported. Final port acceptance is not claimed."}],
  "changedFiles": ["port/mappings.json","port/patches.json","port/required-terms.json","tests/adapter.test.mjs","tests/native.test.mjs","docs/implementation-notes.md","docs/verification.md"],
  "testsAddedOrUpdated": ["tests/adapter.test.mjs","tests/native.test.mjs"],
  "commandsRun": [
    {"command":"node --test tests/adapter.test.mjs (baseline)","result":"failed","summary":"Expected red baseline. Both new prose regressions failed."},
    {"command":"node --test tests/adapter.test.mjs","result":"passed","summary":"Seven passed, including installed Pi shell acquisition."},
    {"command":"npm run check","result":"passed","summary":"Tests-only accepted generation matches."},
    {"command":"npm run typecheck","result":"passed","summary":"No diagnostics."},
    {"command":"node --test tests/importer.test.mjs tests/update.test.mjs tests/runtime.test.mjs","result":"passed","summary":"22 passed; one optional cache inventory test skipped."},
    {"command":"node --test --test-name-pattern='tarball preserves|packed maintenance|packed CLI exports|advertised scripts' tests/packed.test.mjs","result":"passed","summary":"Four passed."},
    {"command":"node --check tests/native.test.mjs","result":"passed","summary":"Syntax valid."},
    {"command":"node --test tests/native.test.mjs","result":"not-run","summary":"No-child-launch constraint. Parent must execute new wake assertions."},
    {"command":"bash -n generated/skills/poteto-mode/scripts/worktree-audit.sh","result":"passed","summary":"Shell syntax valid."},
    {"command":"propose pinned commit; accept exact reviewed digest; generate","result":"passed","summary":"No upstream source changes. Tests-only digest 30ccca761e15ac1ae1121e0ffc591f2e4aa2a23d217e7c91dd6146ccc2b0b281."}
  ],
  "validationOutput": ["/tmp/authoring-red.log","/tmp/authoring-green.log","/tmp/authoring-check.log","/tmp/authoring-typecheck.log","/tmp/authoring-static.log","/tmp/authoring-packed.log","/tmp/authoring-proposal.json","/tmp/authoring-source.diff","/tmp/authoring-whitespace.log"],
  "residualRisks": ["Fresh independent acceptance and full integration suite remain parent-owned.","Prose regressions are lexical checks, not arbitrary-model compliance proof.","New native-wake assertions were not executed under the no-child-launch constraint.","Cross-chat mining requires an authorized corpus; overridden shells may require exact-path fallback."],
  "noStagedFiles": true,
  "diffSummary": "Seven source files changed. Raw upstream unchanged. Isolated acceptance and generated output refreshed for tests only.",
  "reviewFindings": ["No blockers found in scoped source diff. Native assertion execution and final independent acceptance remain outstanding."],
  "manualNotes": "Integrate only the seven listed source paths. Do not copy isolated generated output or acceptance state. No Git index exists in the isolated copy. No runtime or tool changes, installations, commits, or child-agent launches occurred."
}
```
