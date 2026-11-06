# Final implementation review. pi-mstack

Goal restated. Finish a maintainable full port of Cursor pstack to Pi using native pi-loop scheduling and pi-subagents delegation, with reproducible upstream updates and explicit capability gaps.

This is a fresh final implementation review. It is not a design review. I inspected files directly because the repository has no HEAD and every implementation file is untracked. I made no repository edits.

Principles applied. Prove It Works changed the review to run the package check and a scratch propose, accept, generate, check, and export cycle instead of trusting reports. Test Behavior, Not Implementation changed the native evidence check to require actual `monitor:done` and `subagent-notify` records plus a parent provider request, not substring presence alone. Make Operations Idempotent shaped the interrupted acceptance and lock repair probes. Build the Lever is satisfied by the importer itself, and I reran that lever in scratch.

## Findings

### P2 blocker. Skill authoring workflows still depend on Cursor's built-in create-skill and write skills to Cursor-only locations

Evidence.

- `generated/skills/automate-me/SKILL.md:15` says the flow orchestrates "Cursor's built-in `create-skill`". Line 71 repeats the dependency. Lines 73 to 76 place new skills under `.cursor/skills/` or `~/.cursor/skills/` and take frontmatter rules from create-skill.
- `generated/skills/reflect/SKILL.md:55` directs approved skill edits to `.cursor/skills/<skill>/` or `~/.cursor/skills/<skill>/`. Lines 60 to 62 hand substantive edits, description tuning, and new skills to create-skill.
- `generated/skills/poteto-mode/playbooks/authoring-a-skill.md:7` says "Use the **create-skill** skill (Cursor's built-in for authoring SKILL.md files)." The Pi adapter does not supply that skill. The mapping registry at `port/mappings.json` has no create-skill entry, and `port/patches.json` has no patch for these files.
- `generated/skills/create-verification-skill/SKILL.md:29` writes the generated verification skill to `.cursor/skills/verify-<app>/SKILL.md`. `generated/skills/maintain-verification-skill/SKILL.md:29` looks for targets under `.cursor/skills/verify-*/`.
- Pi's installed skill documentation at `node_modules/@earendil-works/pi-coding-agent/docs/skills.md:59-61` says skills load from the user or project skills directory and from `~/.agents/skills/` and `.agents/skills/`. It does not list `.cursor/skills/` as a discovery location.

Impact. A consumer running automate-me, reflect skill editing, or create-verification-skill in Pi can produce a skill in a directory Pi never discovers, or spend the run looking for a built-in that is not installed. The adapter mapping for `.cursor/skills/` at `generated/docs/harness/pi.md:79` only says to use the absolute generated skill path or `/skill:name`. That covers invoking bundled skills. It does not translate authoring a new skill. This is not an explicit capability gap either. The gap list in `docs/design.md` under Missing capabilities does not name create-skill.

Minimal fix. Add a create-skill entry to `port/mappings.json` that routes authoring to the generated authoring-a-skill playbook plus Pi's Agent Skills locations. Add hash-bound exact patches that replace the `.cursor/skills/` authoring destinations in automate-me, reflect, create-verification-skill, and maintain-verification-skill with Pi project or user skill locations. Register create-skill in `port/required-terms.json` so a future upstream rename fails generation. Re-propose, re-accept, regenerate, and add one adapter regression test that asserts no active skill instructs the reader to use create-skill or to write a new skill under `.cursor/skills/`.

### P2 blocker. Transcript mining skills keep a concrete Cursor corpus while the Pi adapter offers no usable Pi corpus

Evidence.

- `generated/skills/recall/SKILL.md:19` gives the transcript location as `~/.cursor/projects/<slug>/agent-transcripts/<uuid>/<uuid>.jsonl` and step 3 fans out across that corpus.
- `generated/skills/reflect/SKILL.md:19-22` tells the reader to find transcripts in "the `agent-transcripts/` directory the system prompt names" and runs `ls -t <agent-transcripts>/*.jsonl ...` globs.
- `generated/skills/automate-me/SKILL.md:33` gives the same agent-transcripts instruction for history mining.
- The shipped adapter mapping at `generated/docs/harness/pi.md:91-93` says to use the current Pi branch or exact retained session paths and never to glob global private history. It does not say how to obtain the current session file. It does not name `$PI_SESSION_FILE`, `/session`, or workspace header verification. Those instructions exist in the installed pstack Pi runtime reference, but that reference is not part of this package's generated adapter.

Impact. Recall is a cross-chat workflow. Pi gives one current session branch to an extension-driven run, not a discoverable multi-chat corpus through these instructions. A model following the concrete path reads Cursor transcripts if they exist, which are the wrong host's private history, or finds nothing and stalls. A model following the abstract adapter rule has no path to execute step 3 as written. Either way the workflow is not ported and is not declared blocked.

Minimal fix. Give recall, reflect, and automate-me hash-bound patches that scope transcript work to the current Pi session file and to exact retained session paths the operator or a retained subagent run record supplies. State that cross-chat mining without exact paths is blocked rather than approximated by scanning a sessions tree. Add the session-file acquisition rule to the adapter mapping registry so every nested playbook inherits the same instruction.

### P3. Implementation notes describe an older accepted state

Evidence.

- `docs/implementation-notes.md:17` claims 24 tests and final review digest `72e7dcfa...b804`. The current accepted digest in `upstream/acceptance.json` is `2554478e...2aa`, and the parent supplied a 43-test passing log.
- `docs/implementation-notes.md:19` points native evidence at `mstack-packed-DZKx8G`. The retained evidence supplied for this review is `mstack-packed-RDTS3b`.
- `docs/implementation-notes.md:39` says setup has no cross-process setup lock. `extensions/pstack/config.ts:46-57` creates `models.json.lock` and refuses writes while it exists.

Impact. Maintainers following the notes will cite the wrong digest and look for evidence in a directory that this run did not retain. The setup sentence understates the concurrency guard that actually ships.

Minimal fix. Update the three statements to the current digest, the current test count, and the lock behaviour. Treat the retained evidence path as run-specific each time it is regenerated.

### P3 observation. The diagnostic command accepts any argument as doctor

Evidence. `extensions/pstack/index.ts:88-98` registers `pstack` with `handler: async (_args, ctx)` and ignores the argument.

Impact. `/pstack bogus` prints the doctor report instead of an error. No state changes. This is a small honesty gap in the command surface, not a correctness risk.

Minimal fix. Accept bare `/pstack` and `/pstack doctor`. Report an error for any other argument.

## Verified sound

Source accounting. I parsed `upstream/manifest.json`. It holds 573 records for commit `2776ddd2355d6d6c8747d3964600f28daf62f049`, plugin 0.15.36. Dispositions are 422 copy, 114 adapt, and 37 preserve. Six records carry Git mode 100755. One record maps source `.gitignore` to storage `__npm_reserved_gitignore__`. No other storage mapping exists.

Reproducibility. In scratch at `/tmp/muse-scratch` I copied only `tools/`, `port/`, and `upstream/`, then ran propose against the pinned cache commit, accepted the emitted digest `2554478eb9c86a88261e30c568853d17e9f936121d5502c48f9b1a5071fa82aa`, generated, and checked. The proposal reported zero source changes. Export reconstructed 573 files including `.gitignore`. `diff -r` showed the scratch `upstream/` and `generated/` trees identical to the repository trees. This is measured evidence, not inference from the test log.

Importer recovery. The early fidelity findings on stale acceptance, missing `generated/index.sha256`, process-start verification, and missing or malformed lock owners are repaired in the current tree. `generated/index.sha256` exists and matches the index hash I recomputed across all 539 index entries with zero mismatches. `tools/importer.mjs:103-124` compares live process-start evidence and refuses missing evidence, mismatches, and live owners. Tests in `tests/update.test.mjs` cover interrupted acceptance at journal and rename points, foreign token acknowledgment, and PID reuse.

Runtime repairs. The early runtime findings are repaired. `extensions/pstack/index.ts:70` ignores extension-source input. The grammar at line 71 matches only ASCII-space skill syntax. Busy requests refuse before persistence at lines 45 to 53. `extensions/pstack/config.ts:37` defaults only when the file is absent, so empty files stay invalid. `policyStatus` at `extensions/pstack/config.ts:101-115` labels merged settings as observations with native precedence unverified. These match the intended contracts stated in the task.

Native evidence. I read `/var/folders/0v/d5b2yvfs1tx739ndg_0m3vqr0000gn/T/mstack-packed-RDTS3b/native/native-evidence.json` directly. It contains `monitor:done` and `subagent-notify` records, the retained `child.md` contains `native-child-retained`, and capture records show two distinct PIDs with a parent provider request carrying the monitor wake. The RPC regression evidence under `mstack-packed-6ymcOm` is present for literal, grammar, busy, and policy cases. The requested loop and subagents dependencies are used directly. No RPC bridge is imported.

Packed artifact. The parent log at `/tmp/pi-mstack-integrated-tests.log` shows check, typecheck, and 43 tests passing with no skips, including packed export of all 573 records and the reserved `.gitignore` reconstruction. I reran `npm run check` and `npm run typecheck` myself. Both passed. I did not rerun the full suite in this review, so the packed and native runtime claims rest on the parent log plus my direct reading of the retained evidence files.

Capability honesty in the core. The bot UI skill at `generated/skills/make-bot-ui/SKILL.md` is a gap notice, Benny stays snapshot-only, and no generated path contains a Benny resource per the packed test. Public merged settings are observations in both doctor output and `docs/configuration.md`. The vocabulary scanner's bounded syntax limit is documented in `docs/maintenance.md`. My two blockers are passages where the concrete Cursor instruction cannot be executed through the adapter at all, which is a different defect from the scanner's stated limit.

## Open questions

None. The two blockers have a smallest fix inside the existing patch and mapping machinery.

## Tests and checks run

- `npm run check` in the repository. Passed.
- `npm run typecheck` in the repository. Passed.
- Scratch propose, accept, generate, check, and export in `/tmp/muse-scratch`. Passed. Zero source changes. Export held 573 files. Scratch trees identical to repository trees.
- Direct Python verification of manifest counts, generated index hashes for 539 entries, and retained native evidence records. Passed.
- Parent-supplied `/tmp/pi-mstack-integrated-tests.log`. 43 tests passed, 0 failed, 0 skipped. I read this log. I did not rerun it.

## Residual limitations

Scripted providers prove host API behaviour. They do not prove that arbitrary models follow every prose instruction. Cursor cloud services, Benny triggers, Bugbot as a service, forge access, renderer, Java, and TLC paths remain unverified and are stated gaps. The Node 22.19 minimum is declared in `package.json` but the observed runs used a newer Node. Cross-chat recall in Pi has no verified corpus mechanism in this package, which is blocker two.

## Verdict

REJECT.

The importer, runtime, packaging, and native evidence are sound and reproducible. Two shipped workflows still send Pi consumers to a Cursor built-in and to Cursor-only paths with no workable native substitute and no declared gap. That breaks the explicit capability-gap contract and the source adaptation completeness required for this port. Fix the two P2 blockers, regenerate and re-accept through the reviewed digest flow, update the stale implementation notes, and this artifact should pass a fresh review without further structural change.

Consumer impact of the verdict. Core mode, role, delegation, and update workflows are usable today. Skill authoring and transcript recall workflows are not.

Maintainer impact of the verdict. Both fixes fit the existing exact-patch and mapping registry design. No new subsystem is needed.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Findings with severity, file and line, reproduction evidence, impact, and minimal fix written to the authoritative output path. Explicit REJECT verdict with tests run and residual limitations."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "npm run check",
      "result": "passed",
      "summary": "Accepted snapshot and generated tree valid in the repository."
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "tsc reported no diagnostics."
    },
    {
      "command": "node tools/upstream.mjs propose/accept/generate/check/export in /tmp/muse-scratch",
      "result": "passed",
      "summary": "Zero source changes, digest 2554478e, export reconstructed 573 files, scratch trees identical to repository."
    },
    {
      "command": "node --test tests/*.test.mjs (parent run, log read)",
      "result": "passed",
      "summary": "43 passed, 0 failed, 0 skipped per /tmp/pi-mstack-integrated-tests.log. Not rerun by this reviewer."
    }
  ],
  "validationOutput": [
    "Manifest parsed at 573 records, 422 copy, 114 adapt, 37 preserve, 6 executable, one reserved storage mapping.",
    "Generated index verified at 539 entries with zero hash mismatches.",
    "Retained native evidence contains monitor:done, subagent-notify, native-child-retained, and a parent provider wake across two PIDs."
  ],
  "residualRisks": [
    "Skill authoring workflows depend on Cursor create-skill and .cursor/skills destinations with no Pi substitute or declared gap.",
    "Transcript mining skills keep a Cursor corpus with no usable Pi session corpus in the shipped adapter.",
    "Scripted provider evidence does not prove arbitrary model compliance with prose workflows.",
    "Declared Node 22.19 minimum was not exercised in observed runs."
  ],
  "noStagedFiles": true,
  "diffSummary": "No repository files changed. Review artifact written to the authoritative subagent output path only.",
  "reviewFindings": [
    "P2 blocker: generated/skills/automate-me/SKILL.md:15,71-76 and generated/skills/reflect/SKILL.md:55,60-62 depend on Cursor create-skill and .cursor/skills destinations that Pi does not discover.",
    "P2 blocker: generated/skills/recall/SKILL.md:19 and generated/skills/reflect/SKILL.md:19-22 keep a Cursor agent-transcripts corpus while the shipped adapter gives no Pi session-file acquisition path.",
    "P3: docs/implementation-notes.md:17,19,39 describe an older digest, test count, evidence path, and setup lock behaviour.",
    "P3 observation: extensions/pstack/index.ts:88-98 ignores any /pstack argument."
  ],
  "manualNotes": "Verdict is REJECT. Core importer, runtime, packaging, and native evidence verified sound, including a scratch re-acceptance that reproduced both trees byte for byte. Parent owns fixes and final acceptance."
}
```
