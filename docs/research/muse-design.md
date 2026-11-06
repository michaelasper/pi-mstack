# Pstack port to pi. Design candidate (Muse)

## Problem

The goal is a maintainable full port of Cursor pstack to pi. The user keeps the workflows they already trust. The maintainer gets an update path they can rerun and audit instead of a hand edited fork that drifts in silence.

Upstream is pinned at commit `2776ddd2355d6d6c8747d3964600f28daf62f049`, plugin version `0.15.36`, with 573 tracked files, 58 top level skills, 23 playbooks, 24 principle leaves, two agents, 424 script tree files, and a dormant Benny pack of 12 files. Most of pstack is Markdown policy that a host agent interprets. A smaller part is runnable software, and the statechart tree carries 356 corpus fixtures whose bytes are expected results. A port that renames slash commands and copies prose would lose executable behavior, visibility policy, and fixtures. A port that forks every file by hand would lose the next upstream release.

Three host facts shape everything below. This evidence comes from the two grounding reports supplied for this run.

1. pi-loop 0.7.19 and pi-subagents 0.86.0 do not share an orchestration RPC. pi-loop orchestration probes `subagents:rpc:ping` and requires protocol version 2 from `@tintinweb/pi-subagents`. The requested pi-subagents 0.86.0 serves protocol 1 on `subagents:rpc:v1:request`. There is no bridge to build here. Scheduling goes to pi-loop. Delegation goes to the `subagent` tool. `OrchestrationCreate` is never used as glue.
2. Pi has no established replacement for Cursor cloud agents, always on automations, bot webhooks and secret storage, editor context, Bugbot as a service, or the external `cursor-team-kit` skills `deslop`, `control-cli`, and `control-ui`. Worktrees isolate source changes. They are not VMs, and this design never describes them as VMs.
3. The installed `@zenspc/pi-pstack` 0.9.0 is a reference with real code, not a parity baseline. It ships 547 files against 573 upstream, drops the Benny pack, the docs, the logo, and `make-bot-ui`, adds a `deslop` skill upstream does not ship, flips discoverability from 1 of 58 model invocable skills to 4, and publishes no importer in its npm artifact. Its sticky mode extension and its typed config boundary are worth learning from. Its defaults and omissions are product choices, not correctness.

The non obvious part is the seam between three owners. Upstream owns workflow content. pi-loop owns scheduling and monitors. pi-subagents owns child execution. This package owns only the record of what upstream shipped, the explicit Pi adaptations, and a small extension for mode, config, and diagnostics. Keeping that seam thin is the whole design.

Principles that shaped this candidate, with the choice each one changed:

- **Model the Domain** changed the centre of the design from a copy script to one typed record per upstream resource with an explicit disposition. Drift, review, and generation all read that record.
- **Laziness Protocol** kept the runtime extension to three files and refused a bundled scheduler, a child process manager, and an RPC bridge.
- **Make Operations Idempotent** made regeneration a pure function of the pinned tree plus the overlay, with a second run required to produce no diff.
- **Boundary Discipline** put all parsing of Git output, frontmatter, config JSON, and model selectors at the importer and config edges. Interior code trusts typed records.
- **Type System Discipline** made the disposition a discriminated union, so a resource cannot be both shipped as a skill and recorded as a gap.
- **Separate Before Serializing Shared State** gave the importer sole write ownership of the generated tree. The extension never writes that tree. It writes only session entries and the operator config file.
- **Prove It Works** moved verification from "the files look right" to loading the packaged artifact in real pi with a scripted provider.
- **Sequence Work into Verifiable Units** ordered delivery so the importer and its determinism check land before any runtime adapter.
- **Foundational Thinking** put the resource record and the importer scaffold before features, because every later phase depends on them.
- **Exhaust the Design Space** forced two whole shape alternatives to be compared below before settling.

## Usage (caller's view)

Written first, per the architect runner prompt. The type sketch in Shape is derived from these call sites. Where they disagree, this section wins.

### Consumer. Install and daily use

```text
pi install npm:pi-subagents@0.86.0
pi install npm:@trevonistrevon/pi-loop@0.7.19
pi install npm:pi-pstack
```

Three packages, each installed as a Pi package so each extension loads once under its own owner. The port package declares only Pi host peers. It does not npm bundle pi-loop or pi-subagents, because ordinary npm dependencies do not activate Pi resources, and bundling risks a second extension load beside the operator's own install.

```text
/poteto-mode fix the flaky checkout test
/poteto-mode            (sticky on, no task yet)
/poteto-mode off
/skill:how does the retry path work
/skill:principle-prove-it-works
/setup-pstack
/pstack status
/pstack doctor
```

What the consumer observes:

- `/poteto-mode` turns sticky mode on for the active session branch and, when a task follows, forwards it as `/skill:poteto-mode <task>` through `pi.sendUserMessage` with `expandPromptTemplates: true`. Sending is steering or follow up aware when the session is busy. `/poteto-mode off` writes a disabled entry, so resume and tree navigation cannot resurrect an earlier enable.
- Plain `/skill:poteto-mode` also turns sticky mode on. The extension observes the raw input before native expansion. Toggling with no task costs no model call.
- Every other skill uses native `/skill:<name>`. This package registers no short alias commands for the other 57 skills. That is deliberate. Duplicate command names receive numeric suffixes in pi, and a silently suffixed `/how` that binds another package's skill is worse than one honest invocation spelling.
- Frontmatter policy is upstream's policy, unchanged. 57 of 58 skills carry `disable-model-invocation: true`. Only `setup-pstack` is model invocable. Hidden means the model does not auto discover them. Explicit invocation still works.
- `/setup-pstack` writes versioned JSON to `$PI_CODING_AGENT_DIR/pstack/models.json`, defaulting to `~/.pi/agent/pstack/models.json`. It offers only selectors from the live model registry plus `inherit-parent` and `auto`. It refuses to overwrite a config it could not fully parse. With no UI it writes the inherit parent default or reports the existing file, matching the reference behaviour worth keeping.
- `/pstack status` reports mode state, catalog visibility, config load status, and per role effective selectors. `/pstack doctor` reports dependency and collision facts. Missing pi-loop commands, a missing `subagent` tool surface, an undiscovered `poteto-agent`, a same named skill owned by another package, and configured selectors absent from the registry each appear as named failures, not as a generic "degraded" note.

### Delegation call site, as ported skill prose instructs the parent

```ts
// Panel leg for one "architect runners" entry, order preserved.
subagent({
  agent: "poteto-agent",
  task: briefWithAbsolutePotetoModeSkillPath,
  model: "anthropic/claude-opus-4-1:high", // exact registry selector, suffix carries effort
  async: true,
})
```

Rules the prose and the doctor both state:

- Omit `model` when the role value is `inherit-parent` or `auto`. Never pass those words as a model id. Never pass a standalone per launch `thinking` field to the current tool dispatch, because 0.86.0 ignores it. Effort rides in the `:thinking` suffix of the selector.
- Preserve panel order. A repeated parent model in a panel is repeated samples, not a multi model panel, and status output says so.
- If a required selector is not in the registry, that leg stops with a named error. No silent substitution, no nearest slug retry inside this package. The calling skill's own fallback policy, stated in its text, is the only fallback.
- `acceptanceRole: "read-only"` is evidence policy, not a sandbox. Tool restriction lives in agent frontmatter. A child with `bash` can write, and the docs say so wherever a read only step is described.
- Naming an MCP tool in a brief grants nothing. The agent definition must select the tool and load its provider, or the step reports the source as a gap.

### Loop call site, as ported skill prose instructs the parent

```text
LoopCreate for the babysit poll, with an explicit stop condition.
A command monitor runs skills/poteto-mode/scripts/watch-pr and wakes the parent on change.
LoopDelete when the PR merges, closes, or the operator stops the run.
```

The port promises loops while pi stays active. It does not promise an always on daemon, exactly once side effects, monitor reattachment after a crash, or replay of missed wakes. pi-loop's own runtime continuity doc denies each of those, so the ported prose denies them too, in the playbook text where the promise would otherwise be implied.

### Maintainer. Update and release

```bash
node tools/importer/import.mjs --pin 2776ddd2355d6d6c8747d3964600f28daf62f049 --check
node tools/importer/import.mjs --pin <new-commit>            # writes tree, manifest, review queue
node tools/importer/import.mjs --pin <new-commit>            # second run. Must print "no changes".
npm test                                                      # offline suite
npm run test:live                                             # network and live host suite, explicit only
```

What the maintainer observes:

- `--check` exits non zero and prints a drift report when the shipped tree differs from what the pinned upstream plus overlay would generate. CI runs `--check`, never the writing form.
- A pin bump that touches any file whose disposition is `adapt-patch`, `adapt-replace`, or `gap-preserved` adds that file to `import/review-queue.md` with old and new hashes. The import still completes for verbatim files. The release checklist, not the importer, blocks publishing while the queue is non empty.
- A new upstream path with no classification rule and no record fails the import with exit code 2 and names the path. Nothing falls through a glob into the package unnoticed. A removed upstream path fails the same way until its record is retired in the overlay.
- Extension load performs no network access and executes no upstream code. It reads one config file, registers two commands plus one command group, and subscribes to session events.

## Shape

### Core data shape

One record per tracked upstream file. This is the single source of truth for inventory, generation, drift, and the capability ledger. Per **model-the-domain**, the disposition is the domain, so it is a discriminated union rather than a comment in a spreadsheet.

```ts
type GitMode = "100644" | "100755" | "120000";

type Disposition =
  | { kind: "verbatim"; shipAs: ShipTarget }            // bytes copied, mode preserved
  | { kind: "adapt-patch"; shipAs: ShipTarget; patch: string }   // overlay patch id
  | { kind: "adapt-replace"; shipAs: ShipTarget; replacement: string } // overlay file id
  | { kind: "generate"; shipAs: ShipTarget; template: string }   // rendered from typed inputs
  | { kind: "gap-preserved"; shipAs: "preserved"; gap: GapId }   // kept, not discoverable
  | { kind: "manifest-only"; shipAs: "none" };           // accounted, not shipped (e.g. upstream .gitignore)

type ShipTarget = "skills" | "agents" | "extensions" | "preserved" | "assets" | "docs" | "root";

interface UpstreamResource {
  path: string;            // posix path relative to pstack/ in the upstream repo
  sha256: string;          // of upstream bytes
  mode: GitMode;
  size: number;
  disposition: Disposition;
}

interface UpstreamPin {
  repo: "https://github.com/cursor/plugins";
  subtree: "pstack";
  commit: string;          // full 40 char sha
  pluginVersion: string;   // read from plugin.json, never hand typed in two places
  resources: UpstreamResource[]; // sorted by path, the only ordering anywhere
}

type GapId =
  | "cursor-cloud-agents" | "cursor-automations" | "bot-webhooks-secrets"
  | "cursor-editor-context" | "cursor-custom-mode-ui" | "team-kit-external"
  | "benny-runtime" | "video-renderer-unverified";
```

Invariants encoded in types and in importer checks, hardest first:

- A `gap-preserved` resource has `shipAs: "preserved"`. It cannot land under `skills/`, so Benny's three skills and `make-bot-ui` cannot become slash skills by accident.
- `adapt-patch` and `adapt-replace` require the recorded upstream hash to match before application. A mismatch is a review queue entry plus a hard failure for that file. The importer never fuzzy applies a patch and never overwrites a replacement silently.
- The shipped tree is a pure function `generate(pin, overlay) -> files`. No timestamps, no absolute paths, no host dependent ordering inside any generated file. JSON is two space indented with a final newline. Generated prose uses LF.
- Executable fixtures are outside the reach of text transforms. The classification table refuses `adapt-patch` for anything under `skills/statechart/scripts/test/**` and refuses line ending or whitespace normalisation for any file whose upstream bytes are not valid UTF-8. This answers the brief rule against globally rewriting executable fixtures with a build failure instead of a convention.

### Module map

Five modules. Each owns one body of knowledge. Callers never reach inside another module's files, per the importable internals red flag.

| Module | Owns | Public surface | Deliberately does not |
| --- | --- | --- | --- |
| `tools/importer/` | Upstream enumeration, classification, overlay application, link and frontmatter checks, drift | `import.mjs` CLI with `--pin`, `--check`, `--verify-upstream` | Run in the published package. Execute upstream code. Fetch on extension load. |
| `import/` (data, not code) | The pin manifest, overlay patches and replacements, the gap ledger, the review queue | Files a maintainer reads and edits in review | Contain logic. A second hand maintained inventory list anywhere else. |
| `extensions/pstack/` | Sticky mode, role config, status and doctor, skill catalog filtering | Commands `poteto-mode`, `setup-pstack`, `pstack`; hooks `session_start`, `session_tree`, `input`, `before_agent_start` | Schedule, delegate, import, or write the shipped tree. Import pi-loop or pi-subagents at runtime. |
| `skills/`, `agents/`, `preserved/`, `assets/`, `docs/` | The generated shipped tree | Pi package manifest entries `pi.skills`, `pi.subagents.agents` | Get hand edited. Every file header or ledger entry points back to its record. |
| `tests/` | Offline proof and live proof, kept apart | `npm test` offline, `npm run test:live` explicit | Mix network steps into the offline pass or call a paid model in CI by default. |

Extension internals stay at three files, as the reference proved sufficient. `index.ts` wires events and commands. `config.ts` parses and writes the role config at the boundary. `diagnostics.ts` derives doctor output from `pi.getCommands()`, command `sourceInfo`, the model registry, and agent discovery. Pure functions take parsed inputs and return report lines, so they test without a host. Per **boundary-discipline**, Git output, JSON text, and registry objects are parsed once at these edges and trusted afterwards.

### Runtime behaviour in detail

**Sticky mode.** State is a versioned custom entry `pstack-mode` with `{ enabled: boolean }`, appended with `pi.appendEntry`. Reconstruction scans `ctx.sessionManager.getBranch()` on `session_start` and `session_tree`, takes the last boolean, and defaults to undefined. Disabled is stored explicitly. The in memory boolean is a cache of branch state, refreshed in `before_agent_start`, never a second owner. Injection uses structured `systemPromptOptions.sections.pstack` in `before_agent_start`, which also covers runs started by background custom messages, and composes with pi-subagents' catalog handling instead of replacing the whole prompt. The injected text is short. Mode on, the absolute path of `skills/poteto-mode/SKILL.md`, and an instruction to reload after compaction. The full skill text is never copied into the prompt. `/pstack off` filtering hides this package's skills from the catalog by file path prefix when `skillsEnabled` is false. It does not revoke `/skill:` invocation, and status output says so.

**Skill invocation.** Native expansion handles `/skill:<name>`. One collision rule, checked by doctor and by tests. If `pi.getCommands()` shows a same named skill whose `sourceInfo` is not this package, doctor names both provenances. This package keeps the first discovered definition behaviour of pi visible rather than pretending to override it.

**Config.** The role table keeps the reference's 17 role names, including the four list roles `arena runners`, `arena cross-judge pool`, `architect runners`, and `interrogate reviewers`, because upstream prose addresses roles by those exact labels and renaming them would fork every playbook. Selector grammar is `provider/model-id` with an optional `:thinking` suffix, parsed by splitting on the first slash so model ids containing slashes survive. `inherit-parent` and `auto` are sentinel values in the type, normalised at injection time, never forwarded. Writes are atomic through a temp file and rename in the same directory, with the config directory at mode `0o700` and the file at `0o600`. A partial load reports each rejected selector and keeps the file untouched. Legacy Cursor `.mdc` content is not migrated automatically, because its slugs are Cursor slugs. Setup offers it as a read only starting list and marks every unverified entry as needing a choice. That drops the reference's silent legacy Markdown migration, which could carry `claude-opus-5-5-xhigh` into a registry that has no such id.

**Diagnostics.** Doctor checks, in order. Pi package resources discovered. pi-loop commands present, meaning `LoopCreate` family and monitor surface as documented for 0.7.19. pi-subagents agent discovery finds `poteto-agent` and `comment-sicko` from this package's `pi.subagents.agents` entry. Dependency versions read from installed package manifests and compared against the tested compatibility table in `docs/capability-map.md`. Any version outside the tested set is a warning with the tested set printed, not a hard block, because patch releases should not brick the mode. Config status and unavailable selectors. Command and skill collisions with provenance. Doctor performs no network call and spawns nothing.

**Agents.** `agents/poteto-agent.md` and `agents/comment-sicko.md` are `adapt-replace` records. Upstream frontmatter fields such as `is_background` become pi-subagents fields. Tool selection lives in the agent definition. The poteto agent body keeps the upstream instruction to read the full poteto mode skill by absolute path before work, with the path resolved from the installed package, not from a `~/.cursor/plugins` search. The dormant instruction to pick the highest versioned Cursor plugin copy is deleted, and the replacement records why in the overlay ledger.

### Import and update algorithm

Deterministic, idempotent, and boring. Per **make-operations-idempotent**, every step derives from current bytes, so a crash mid run leaves a staging directory the next run discards.

1. Resolve the pin. Clone or open the upstream repo in a maintainer supplied cache outside the package. Check out the exact commit. Refuse a dirty or short sha. Read `plugin.json` for the version.
2. Enumerate with `git ls-tree -r -z <commit> -- pstack`. Parse path, mode, and blob id at this boundary into typed rows. Hash file bytes with SHA-256. Sort by path bytes. A filesystem walk cross checks the count, because the sparse checkout in the grounding run hid generator scripts that live outside `pstack/`. Those outside files are read as precedent only and recorded as `manifest-only` context in the ledger notes, not imported.
3. Classify. A single ordered rule table in the importer maps path patterns to a default disposition. The existing manifest supplies per path overrides. Unknown pattern plus unknown path is exit code 2. This is the hand synced list red flag answered structurally. There is one list, the manifest, and generation derives package contents, counts for docs, and the capability ledger from it.
4. Diff against the stored pin. Added, removed, renamed by blob, mode changed, and content changed sets are computed. Files with an adaptive disposition and any change go to `import/review-queue.md`. Renames need a human to confirm the overlay still targets the right path.
5. Apply. Verbatim copies bytes and mode into a staging tree. Patch application is exact context matching against the recorded hash, no fuzz, no offsets beyond exact hunk placement. Replacements copy the overlay file and record the upstream hash they were reviewed against. Generate renders the small set of truly Pi native files, the capability map and the pi reference docs, from typed inputs. Benny, docs, logo, and `make-bot-ui` land under `preserved/` or `assets/`, never under `skills/`.
6. Validate the staging tree. Frontmatter name matches directory name for every shipped skill. Upstream visibility flags preserved. Relative links resolve inside the shipped tree or to a mapped preserved target. A Cursor token scan over adapted prose flags `Task` tool fields, Cursor model slugs, `~/.cursor` paths, `/loop` Cursor semantics, and `update_state` or `SendToUser` calls, with an allowlist keyed by resource path for historical mentions and gap records. Script entry points still carry mode `100755`. The six upstream executables are named in a test fixture list derived from the manifest by mode, not retyped.
7. Swap. Compare staging against the live tree by hash. Write only changed files, delete only files the manifest retired, preserve modes. Print a summary of added, changed, removed, and review queued paths. A second identical run prints no changes and leaves `git status` clean. That is the no op regeneration predicate, and a test asserts it.
8. `--verify-upstream` is a separate explicit step that rehashes a fresh clone and compares it to the manifest. It needs network. It is never part of `npm test` and never runs on load.

### Capability table

Supported means a mechanism exists in pi plus the two named dependencies. Adapted means the workflow runs with explicit changes. Gap means no established replacement, stated to the user at the point of use.

| Upstream capability | Verdict | Pi mapping in this design |
| --- | --- | --- |
| Principle leaves, writing standards, TDD, benchmark guidance | Supported | Verbatim skills. Verification still depends on the target project. |
| 58 skills, 23 playbooks, references | Adapted | Verbatim or patch adapted skills with upstream visibility. Playbooks stay inside `poteto-mode`. |
| Sticky poteto mode | Adapted | Branch local custom entries plus structured prompt section. Not the Cursor Custom Modes UI and no Option+Enter gesture. |
| Skill invocation | Adapted | Native `/skill:<name>` plus extension commands for `poteto-mode` and `setup-pstack` only. |
| Setup and per role models | Adapted | Versioned JSON config, registry validated selectors, ordered panels, no silent substitution. Cursor budget ladder becomes explicit per role thinking suffixes chosen in setup. |
| Async delegation and panels | Supported mechanism, adapted policy | pi-subagents `subagent` tool and agent definitions. Cursor `Task` fields translated in prose. No per launch tools allowlist exists. |
| Recurring and dynamic loops, PR watchers | Supported mechanism, adapted policy | pi-loop `LoopCreate` family and command monitors. `watch-pr` ships verbatim. Active process only. |
| Restart proof unattended execution | Gap | pi-loop persists intent, not execution. Docs and playbooks say pi must stay active. |
| Cloud agents and cloud isolation | Gap | None. Worktrees are named as source isolation only, in `docs/capability-map.md` and in adapted prose. |
| Cursor Automations and Benny runtime | Gap, source preserved | All 12 files under `preserved/benny/`. Setup prose kept for a future Cursor side install. Not a pi feature. |
| Bot UI routines, webhooks, secret storage | Gap, source preserved | `make-bot-ui` under `preserved/` with a gap record naming `update_state`, `SendToUser`, and secret requests. Not registered as a skill. |
| Bugbot and agentic security review service | Gap as a service | Existing forge comments are readable evidence in adapted playbooks. Nothing starts or promises a review. |
| `deslop`, `control-cli`, `control-ui` from cursor-team-kit | Gap, external | Absent, and doctor reports them absent when a playbook needs one. The reference port's added `deslop` skill is not carried over, because inventing an upstream skill breaks fidelity. Project verification skills are the stated substitute path. |
| MCP backed research in `why` and `how` | Adapted, conditional | Works only when the agent definition loads the provider. Missing sources are reported per source, never summarised as covered. |
| Session pickup and transcript recall | Adapted | Pi session entries and pi-subagents retained run records, verified against workspace and branch. No scans of global session history, and the adapted `worktree-audit.sh` is patched to workspace scope, fixing the reference fork's whole sessions tree search. |
| Statechart verifier and corpus | Supported with dependencies | Verbatim tree including 356 corpus files. Offline corpus tests offline. Renderer and live TLC tests in the live suite only, installs use `--ignore-scripts`. |
| Video catch up rendering | Gap, unverified | Skill adapted to state the renderer and presentation requirement. No parity claim. |
| Origin PR workflows | Adapted, optional | Playbook branch kept. Watcher remains GitHub specific and says so. |
| Editor context and Cursor provided skills such as create-skill | Gap | Named in the capability map. Authoring guidance points at pi skill docs instead. |

The capability map in `docs/capability-map.md` is generated from the manifest gap records plus a small typed table in the importer, so the doc cannot drift from the ledger without `--check` failing. That is **encode-lessons-in-structure** applied to documentation.

### Interface depth judgement

The public surface is three commands, one config file, one importer CLI, and the manifest. Behind it sit Git enumeration, patch application, link checking, token scanning, config parsing, collision detection, and panel formatting. A maintainer learns four nouns, resource, disposition, pin, overlay, and can trace any shipped file to its record in one hop. Callers never coordinate importer stages. There are no pass through layers. The one deliberate exposure is the review queue, because drift visibility is a feature the operator must see, not complexity the callee can hide.

Red flag screening, per the architect red flags reference:

- Shallow module. Rejected by the depth argument above. The importer hides enumeration, application, and validation behind `--pin` and `--check`.
- Hand synced list. The manifest is the only inventory. Counts in docs, the executable entry point list, package contents checks, and the capability ledger all derive from it.
- Split ownership. The importer alone writes the shipped tree. The extension alone writes session entries and operator config. Children write only what the parent brief allows.
- Two ways to do one task. Delegation has one spelling, the `subagent` tool. Scheduling has one spelling, pi-loop tools. The orchestration RPC is documented as incompatible and unused, which removes the tempting second path.
- Importable internals. Overlay files are data consumed by the importer. Shipped skills reference only the generated pi reference docs, never importer paths.
- Temporal decomposition. Modules are organised by knowledge owned, inventory, runtime state, shipped content, proof, not by load then transform then save stages.
- Information leakage. Cursor wire concepts, Task fields, slugs, `.mdc` rules, stay inside adapted prose and the token scanner allowlist. The config type exposes only pi selectors.

### Synthesis decision

This candidate is one runner's package, written for the parent's arena comparison. No synthesis across candidates has happened inside this report. The parent owns base selection and grafting.

### Tradeoffs accepted

- We accept carrying `preserved/` content that pi cannot run, including Benny and `make-bot-ui`, in exchange for full accounting of all 573 upstream files and an honest gap a user can read.
- We accept patch overlays that break loudly on upstream anchor changes in exchange for never silently merging Pi wording into changed upstream prose.
- We accept a three package install with version warnings instead of hard blocks in exchange for not duplicating extension loads and not bricking the mode on a dependency patch release.
- We accept no short slash aliases beyond the two mode commands in exchange for zero silent command collisions.
- We accept that read only behaviour for children is prose plus agent frontmatter, not a sandbox, in exchange for telling the truth about the 0.86.0 schema instead of copying the reference port's unsupported per launch tools advice.
- We accept setup dropping automatic Cursor config migration in exchange for never writing an unverified model slug.
- We accept generated files living in the repo root tree where pi expects them, rather than a pristine vendored mirror plus a build output, in exchange for one shipped representation a reviewer can diff directly. The manifest hashes, not a second copy, carry the raw upstream evidence.

### Alternatives considered

**Alternative A. Chosen shape. Manifest driven overlay importer generating one shipped tree.** Described above. Public surface is the importer CLI plus the manifest. It hides classification, patching, and validation. It exposes drift through the review queue. Fewest independently maintained representations. One shipped tree, one data ledger, one small overlay set.

**Alternative B. Pristine vendored mirror with runtime adaptation.** Vendor all 573 files byte identical under `upstream/`, and adapt at load time or through a transform layer between the mirror and pi discovery. This hides nothing from the maintainer, who now reasons about two trees plus a transform, and it fights the host. Pi discovers skill files on disk. A transform layer means generating the discoverable tree anyway, which is Alternative A with an extra 573 file copy kept in the repo, or patching prose in the extension, which cannot rewrite skills pi already loaded. It exposes the most complexity to callers for the purest provenance. The manifest hash gives the same provenance without the second tree. Rejected on interface depth and on **laziness-protocol**.

**Alternative C. Fork and edit the shipped tree, reconcile by hand each release.** This is effectively the reference port's posture without its importer. The public surface looks smallest on day one, just files. It hides no drift machinery because there is none. Every upstream release becomes a manual three way merge across 60 already diverged files, discoverability flips and omissions stay invisible, and the npm artifact cannot prove what it contains. The grounding comparison, 477 identical of 537 common paths with no published importer, is the measured cost of this shape. Rejected because update determinism and drift visibility are scored requirements, not preferences.

**Alternative D. Bundle pi-loop and pi-subagents as npm dependencies of this package.** One install line for the consumer. But npm dependencies do not activate Pi resources without explicit `node_modules` resource paths, independent installs keep separate module roots, and an operator who also installs either package directly risks duplicate extension loads. The grounding report marks the bundled route as needing an isolated tarball loading test with no demonstrated win. Rejected unless that test later proves single load behaviour, in which case it is a packaging change that does not alter this design's modules.

### Open questions and risks

- Should `preserved/` ship in the npm tarball, or publish as a separate provenance artifact, given the logo and guide images have no separate licence file beyond the MIT notice naming Lauren Tan, which this package reproduces verbatim in `LICENSE` either way?
- Which pi minor versions beyond the inspected 1.5.0 should the compatibility table claim, and who reruns the real host suite when pi, pi-loop 0.7.19, or pi-subagents 0.86.0 moves?
- Does the operator want the optional live model evaluation of routing quality, scripted provider tests prove API behaviour but not that a model follows ported prose, funded as part of this project or deferred?
- Should setup offer the upstream budget ladder, unlimited to small, as a bulk thinking suffix rewrite across roles, or stay strictly per role as this candidate specifies?

### Validation plan

Offline and live suites stay separate. `npm test` needs no network, no credentials, and no paid model.

Offline:

1. Importer unit tests. Classification of a fixture tree, hash and mode capture, rename detection, unknown path exit code 2, patch anchor mismatch failure, fixture tree refusal for statechart corpus paths.
2. Determinism. Generate twice from the pinned fixture into temp dirs. Byte compare both trees including modes. Then generate over the committed tree and assert `--check` passes with no diff.
3. Drift. Mutate one upstream fixture byte. Assert the drift report names it and, for an adapted file, the review queue gains an entry.
4. Package contents. Unpack the npm tarball in a temp dir. Assert every manifest record with a ship target is present, no `gap-preserved` path sits under `skills/`, executables keep mode `100755`, the MIT `LICENSE` naming Lauren Tan is at root, and no importer or test file leaks into the published `files` list.
5. Config. Parse, partial load diagnostics, atomic save, selector grammar with slashes in model ids, sentinel handling, refusal to overwrite an invalid file. Pure function tests against `config.ts`.
6. Extension logic. Branch reconstruction from synthetic session entries including a fork where an abandoned branch enabled the mode and the active branch disabled it. Catalog filtering by path prefix. Doctor line derivation from fake command lists.

Real pi, scripted provider, still offline:

7. Load the packaged artifact with `DefaultResourceLoader` and `createAgentSession` in an isolated agent dir. Bind extensions. Assert command provenance through `getCommands()` and `sourceInfo`, skill discovery counts, and that the Benny skills are absent.
8. Register a deterministic scripted provider through `pi.registerProvider` with a custom `streamSimple`. Drive mode on, a normal prompt, `/skill:poteto-mode`, mode off, a custom message wake, reload, resume, fork, and tree navigation. Assert provider visible instructions and persisted branch state, not just callbacks.
9. Exercise agent discovery and one native child on the scripted provider. Assert the child ran as `poteto-agent`, the selector and thinking suffix reached it, the retained artifact exists, and completion reached the parent. Keep the parent alive through detached delivery.
10. Collision test. Install a fixture skill also named `how`. Assert doctor reports both provenances and no alias silently rebinds.
11. Loop behaviour. Create a short interval loop and a command monitor against a fixture script. Assert the wake re enters the agent, the stop condition deletes the controller, and cancellation leaves no pending wake. Assert the docs' active process limit by killing and restarting pi and checking intent is listed without claiming execution happened.
12. CLI and RPC smoke against the real pi executable with `--offline` and an isolated `PI_CODING_AGENT_DIR`. Check `get_commands`, `get_state`, `get_entries`, and command handling dispositions.

Live, explicit only under `npm run test:live`:

13. `--verify-upstream` against a fresh clone at the pin. Renderer and live TLC statechart tests, which install packages and may fetch Java. One real model smoke of a panel with two distinct registry models, asserting order and no substitution when one is deliberately made unavailable.

Every check asserts observable behaviour, per **test-behavior-not-implementation**. A failing check names the surface it drove.

## Next implementation step

Build the importer skeleton first. Pin enumeration, the resource record, classification for the 573 known paths, and the twice generated byte identical determinism test, with no extension code yet. That unit proves the maintenance contract every later step depends on, per **sequence-verifiable-units** and **foundational-thinking**.

## Provenance and limits of this candidate

This report is read only design work. No repository files were changed and no upstream code was executed. Sources read this session are the poteto mode skill, the architect skill with its runner prompt, rationale template, and design red flags, the principle leaves named above, the design brief, both grounding reports, the reference port's extension and config sources, and the pinned upstream poteto mode, setup, agent, and Benny entry documents. Runtime behaviour of pi 1.5.0, pi-loop 0.7.19, and pi-subagents 0.86.0 is source observed through those reports, not executed here. The validation plan exists precisely to convert those claims into measured ones before anyone calls this port done.
