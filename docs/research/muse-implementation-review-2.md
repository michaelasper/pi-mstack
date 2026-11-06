# Muse implementation review 2. pi-mstack

Goal. Complete a maintainable full Cursor pstack port to Pi with native pi-loop scheduling and pi-subagents delegation, reproducible updates, explicit gaps, and both requested reviewer ACCEPT verdicts.

This review inspected the repository directly. The repository has no HEAD, so I treated the files on disk as the review target. I made no source edits, installs, global changes, commits, publications, or delegated child launches. Bounded checks and a scratch importer cycle outside the repository were run.

Principles used. Prove It Works changed the review from trusting summaries to rerunning check, typecheck, adapter tests, and a scratch propose, accept, generate, check, and export cycle. Test Behavior, Not Implementation changed the native evidence check to require correlated completion and monitor records plus parent provider requests that carry role data and no enabled-mode section. Laziness Protocol kept the accepted fix path inside the existing mapping and exact-patch machinery rather than asking for a new subsystem.

## Findings

No P0, P1, or P2 findings remain.

### Optional P3. The diagnostic command still accepts unknown arguments

Severity. P3.

File and line. `extensions/pstack/index.ts:88-102`.

Evidence. The `pstack` command handler ignores `_args`. A call such as `/pstack bogus` therefore produces the doctor report rather than an unknown-argument error. The configuration reference describes bare `/pstack` and `/pstack doctor` as the diagnostic routes at `docs/configuration.md:51-53`.

Impact. Consumers can mistype the diagnostic route and still receive a normal report. No state changes and no mandatory gate depends on this route. Maintainers inherit a small command grammar mismatch.

Minimal fix. Accept only empty arguments and `doctor`. Report an error for any other argument. This is optional polish and is not a rejection reason.

## Prior P2 closure

### Skill authoring is now self-contained and discoverable

The previous Muse P2 named Cursor create-skill and `.cursor/skills/` destinations in automate-me, reflect, the authoring playbook, and the verification-skill workflows. The current tree closes that defect through the existing port machinery.

Measured evidence. `port/mappings.json` now contains a `create-skill` mapping. `port/required-terms.json` requires that mapping. `port/patches.json` contains hash-bound edits for automate-me, reflect, reflect reviewer and synthesizer references, create-verification-skill, maintain-verification-skill, and `skills/poteto-mode/playbooks/authoring-a-skill.md`. The generated authoring playbook at `generated/skills/poteto-mode/playbooks/authoring-a-skill.md:5-10` gives project and personal Pi destinations, frontmatter limits, discovery checks, positive and negative cases, retained evidence, and caller approval rules. It does not delegate back to a missing built-in.

A scan of every Markdown file under `generated/skills/` found no `create-skill` dependency and no `.cursor/skills/` destination. The only remaining matches in generated output are adapter headings in `generated/docs/harness/pi.md` that translate the old terms. Pi 1.5.0 documentation at `node_modules/@earendil-works/pi-coding-agent/docs/skills.md:61-72` confirms recursive discovery from `~/.agents/skills/` and project `.agents/skills/`. I label that documentation check as source evidence from the installed dependency.

Consumer impact. A Pi consumer can now author or revise a skill at a location Pi discovers. The procedure also tells the consumer to preserve an existing Pi-discovered destination and to avoid package caches and generated package resources.

Maintainer impact. Future upstream changes to those passages must pass the source-hash-bound patches, required-term checks, and packed prose regressions. The fix did not add a hand-maintained fork.

### Transcript scope is now explicit and usable

The previous Muse P2 named a Cursor transcript corpus in recall, reflect, and automate-me, and said the shipped adapter gave no usable Pi acquisition path. The current tree closes that defect.

Measured evidence. `generated/docs/harness/pi.md:93` gives the exact local shell command `printf '%s\n' "${PI_SESSION_FILE:-}"`. It says Pi injects the variable into its shell tools, not arbitrary terminals. It covers ephemeral sessions, disabled exposure, overridden or remote tools, exact operator or retained-run fallback paths, first-line header reading, session ID and workspace verification, branch limits, and child handoff by exact path. It states that cross-chat mining without an authorized corpus is blocked. It forbids recursive global session scans, guessed paths, unauthorized parent-session traversal, and silent Cursor transcript fallback.

The generated recall, reflect, automate-me, show-me-your-work, session-pickup, and eval instructions now require exact authorized paths. `tests/adapter.test.mjs:57-73` executes the documented printf and header-read commands through the installed Pi shell definition with a retained SessionManager. It also checks ephemeral and disabled-exposure cases. I reran `node --test tests/adapter.test.mjs`. All 7 tests passed.

Installed Pi evidence supports the contract. `node_modules/@earendil-works/pi-coding-agent/docs/environment-variables.md:26-27` defines `PI_SESSION_ID` and `PI_SESSION_FILE`. `dist/core/tools/bash.js:137-147` clears inherited values and injects current values only when a session context provides them. This proves the stated acquisition API behavior. It does not prove an arbitrary overridden or remote shell behaves the same way. The adapter correctly turns that case into the exact-path fallback.

Consumer impact. Current-session work has an executable acquisition route. Cross-chat work blocks when no authorized corpus exists instead of reading another workspace or host history by inference.

Maintainer impact. Privacy scope is stated once in the adapter registry and repeated by exact patches at each concrete workflow entry point. Packed regressions now scan for the known bad destinations and instructions.

## Deterministic importer and packaging

Measured evidence. The accepted review digest in `upstream/acceptance.json` is `30ccca761e15ac1ae1121e0ffc591f2e4aa2a23d217e7c91dd6146ccc2b0b281`, matching the digest supplied for this review. `upstream/manifest.json` records commit `2776ddd2355d6d6c8747d3964600f28daf62f049`, plugin version `0.15.36`, and 573 records. The disposition counts are 422 copy, 114 adapt, and 37 preserve. Six records are executable.

I copied only `tools/`, `port/`, `upstream/`, and `package.json` to `/tmp/muse-review2-scratch`. Proposal against the pinned local cache returned zero source changes and the same review digest. Acceptance, generation, and check then passed in that scratch tree. Export reconstructed 573 files, including `.gitignore`. A byte comparison found no differences between the scratch `upstream/` and repository `upstream/`, and no differences between the scratch `generated/` and repository `generated/`.

Generated discovery contains 58 top-level skill names. It contains no Benny resource. `make-bot-ui` remains a capability notice rather than an implementation claim.

Maintainer impact. The digest still binds the source manifest and adaptation inputs. The scratch cycle proves the current bytes regenerate deterministically rather than merely matching a stored summary.

## Earlier importer and runtime fixes

The earlier repairs remain sound in the current tree and retained evidence.

The importer still validates unsafe paths, storage mappings, duplicate destinations, unsupported file kinds and modes, stale review digests, missing mappings, stale roles, and surviving fallback paragraphs. Lock repair still checks process-start evidence and rejects live, reused, foreign, missing, or malformed ownership unless the documented acknowledgment route applies. Interrupted acceptance and generated repair remain explicit recovery operations rather than silent cleanup.

The extension still checks resource ownership before mode mutation, refuses busy mode changes without persistence or queueing, leaves extension-origin input untouched, uses only ASCII-space native skill grammar, and keeps role data available while mode is off. Config parsing still rejects an existing empty file, preserves colon-bearing model identifiers apart from a recognized final thinking suffix, and keeps registry validity separate from native launch eligibility. Doctor still labels merged native settings as observations rather than effective enforcement.

I compared the retained packed package under `/var/folders/0v/d5b2yvfs1tx739ndg_0m3vqr0000gn/T/mstack-packed-sWuu2E/package` with the current checkout. Every file under `extensions/`, `tools/`, `port/`, `generated/`, and `tests/` matched byte for byte. The only package difference was `docs/implementation-notes.md`. That matches the statement that the latest post-pack changes were evidence notes only, and I verified it directly.

## Native scheduling and delegation evidence

Retained native evidence at `/var/folders/0v/d5b2yvfs1tx739ndg_0m3vqr0000gn/T/mstack-packed-sWuu2E/native/native-evidence.json` contains `monitor:done` and `subagent-notify` records, retained child output, and parent provider requests for both wake routes. The current test at `tests/native.test.mjs:77-83` now finds each matching parent request, asserts `<pi-mstack-role-data>`, and asserts that `<pi-mstack-mode>` is absent. That narrows the claim correctly to role delivery with mode off on native monitor and completion wakes.

Enabled-mode custom wakes remain separate SDK evidence. The documentation now states that distinction at `docs/verification.md:32` and `docs/implementation-notes.md:17`. I found no remaining claim that the native monitor and completion test enables mode.

RPC regression evidence under `/var/folders/0v/d5b2yvfs1tx739ndg_0m3vqr0000gn/T/mstack-packed-fxzc8i` is present for literal input, grammar, busy refusal, and policy cases. I compared the packed package in that directory as part of the parent-run artifact set and relied on direct file inspection plus the parent log for the full run.

This evidence proves host API behavior with a scripted provider. It does not prove arbitrary model compliance with adapted prose.

## Mandatory gates and capability gaps

The adapter at `generated/docs/harness/pi.md:7-9` still states that substitutes must satisfy the original requirement with retained evidence. Missing independent real-product verification blocks Shipping before merge. Missing control-ui blocks required UI verification. An unavailable explicit reviewer blocks that review and dependent actions. Placeholders cannot act as verdicts. Optional missing evidence can be skipped only when no mandatory gate depends on it.

The exact fallback patches still remove family defaults, nearest-slug choices, omitted rejected selectors, and silent substitutions from active workflow prose. The mapping at `generated/docs/harness/pi.md:105` still forbids OrchestrationCreate as a delegation bridge. Cursor cloud services, Benny triggers, bot webhooks, secret storage, editor selection, and video rendering remain explicit gaps. Missing Cursor services and unavailable external integration verification remain limitations, not implied parity.

## Checks run

- `npm run check` in `/Users/asper/source/pi-mstack`. Passed.
- `npm run typecheck` in `/Users/asper/source/pi-mstack`. Passed.
- `node --test tests/adapter.test.mjs`. Passed. Seven tests passed, zero failed, zero skipped.
- `bash -n generated/skills/poteto-mode/scripts/worktree-audit.sh`. Passed.
- Scratch importer cycle in `/tmp/muse-review2-scratch`. Proposal returned zero changes and digest `30ccca761e15ac1ae1121e0ffc591f2e4aa2a23d217e7c91dd6146ccc2b0b281`. Accept, generate, and check passed. Export produced 573 files.
- Byte comparisons. Scratch upstream and generated trees matched the repository. Retained packed implementation, tools, port, generated resources, and tests matched the current checkout.
- Parent-supplied full run at `/tmp/pi-mstack-authoring-integrated-tests.log`. Check, typecheck, and 46 tests passed with no skips. I read the log. I did not rerun the full CLI, PTY, RPC, and native suite in this review, and I did not launch delegated children.

## Residual risks

Scripted provider tests are host API evidence. They do not prove that arbitrary models follow every prose instruction or author a good skill from a natural-language prompt.

Lexical scans catch known Cursor terms and destinations. They do not prove semantic equivalence for every upstream paragraph. A future upstream diff still needs human review even when generation passes.

Session acquisition depends on Pi's local shell exposing session variables. Ephemeral sessions, disabled exposure, and overridden or remote shells must use the exact authorized path fallback. The adapter states this limit.

Enabled-mode native monitor and completion wakes are not covered. Enabled-mode custom wakes have separate SDK coverage. This is a coverage limit, not a consumer defect found in this review.

No renderer, Java, TLC, forge, paid-model, cloud-service, or external bot integration was verified. The declared Node.js 22.19 minimum was not exercised separately. Temporary retained evidence paths are not durable release artifacts.

## Verdict

ACCEPT for the finished documented port contract.

The prior P2 authoring and transcript blockers are closed by exact patches, registered mappings, discoverable Pi destinations, executable session acquisition evidence, and explicit cross-chat blocking. Deterministic importer and packaging evidence reproduces the current trees. Mandatory gates were not weakened. The remaining P3 command-argument polish and the stated external and model-compliance limits do not block acceptance.

Consumer impact. Pi users get native mode, skills, scheduling, delegation, authoring, and bounded transcript workflows with explicit gaps. Maintainers get a pinned snapshot, digest-bound review, deterministic regeneration, and recovery paths that a reviewer can rerun. Parent owns integration and final acceptance.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Read-only review written to the authoritative output path. Prior P2 closure, scratch deterministic importer cycle, retained native and RPC evidence, exact checks, optional P3, residual risks, and ACCEPT verdict are documented with file and line references."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "npm run check",
      "result": "passed",
      "summary": "Accepted source and generated resources match in the repository."
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "TypeScript reported no diagnostics."
    },
    {
      "command": "node --test tests/adapter.test.mjs",
      "result": "passed",
      "summary": "Seven passed, zero failed or skipped, including packed authoring prose, transcript scope, and installed Pi shell session acquisition."
    },
    {
      "command": "bash -n generated/skills/poteto-mode/scripts/worktree-audit.sh",
      "result": "passed",
      "summary": "Shell syntax valid."
    },
    {
      "command": "node tools/upstream.mjs propose, accept, generate, check, and export in /tmp/muse-review2-scratch",
      "result": "passed",
      "summary": "Zero source changes, digest 30ccca761e15ac1ae1121e0ffc591f2e4aa2a23d217e7c91dd6146ccc2b0b281, export reconstructed 573 files, and scratch upstream and generated trees matched the repository byte for byte."
    },
    {
      "command": "MSTACK_GIT_TESTS=1 MSTACK_KEEP_TEST_ARTIFACTS=1 npm test (parent run, log read)",
      "result": "passed",
      "summary": "46 passed, zero failed or skipped per /tmp/pi-mstack-authoring-integrated-tests.log. Not rerun by this reviewer."
    }
  ],
  "validationOutput": [
    "Manifest verified at 573 records, 422 copy, 114 adapt, 37 preserve, and six executable files for commit 2776ddd2355d6d6c8747d3964600f28daf62f049.",
    "Generated skill scan found no active create-skill dependency or .cursor/skills destination under generated/skills.",
    "Generated discovery contains 58 top-level skill names, no Benny resource, and a make-bot-ui capability notice.",
    "Retained native evidence contains monitor:done and subagent-notify records with role data and no enabled-mode section on matching parent provider requests.",
    "Retained packed implementation, tools, port, generated resources, and tests match the current checkout byte for byte. Only docs/implementation-notes.md differs in the retained package."
  ],
  "residualRisks": [
    "Scripted provider evidence proves host API behavior, not arbitrary model compliance with prose workflows.",
    "Lexical checks do not prove semantic equivalence for every upstream paragraph.",
    "Enabled-mode native monitor and completion wakes remain uncovered; enabled-mode custom wakes have separate SDK coverage.",
    "Renderer, Java, TLC, forge, paid-model, cloud, bot, and other external integrations remain unverified explicit limitations.",
    "Declared Node.js 22.19 minimum was not exercised separately."
  ],
  "noStagedFiles": true,
  "diffSummary": "No repository files changed. The review report was written only to the authoritative subagent output path.",
  "reviewFindings": [
    "No P0, P1, or P2 blockers remain.",
    "Optional P3: extensions/pstack/index.ts:88-102 ignores unknown /pstack arguments instead of accepting only bare /pstack and /pstack doctor.",
    "Verdict ACCEPT for the finished documented port contract."
  ],
  "manualNotes": "Prior Muse P2 authoring and transcript blockers are closed. Sol native-wake wording is now narrowed to mode-off role delivery. Parent owns integration and final acceptance."
}
```
