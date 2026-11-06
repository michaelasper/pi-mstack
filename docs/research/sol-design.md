# A source-preserving pstack port with generated Pi resources

## Problem and recommendation

The goal is a maintainable full Cursor pstack port to Pi using pi-loop for scheduling and pi-subagents for children. Users retain the engineering workflows and can see which Cursor services are unavailable. Maintainers inherit an auditable upstream snapshot, deterministic generation, and a small native extension rather than a second orchestration platform.

I recommend one complete upstream snapshot, one explicit adaptation policy, generated Pi resources, and a native extension that owns only mode state, role configuration, and diagnostics. The extension does not run the importer, start background processes, or contact upstream when it loads.

This is a design candidate, not an implementation or runtime certification. The package name `pi-mstack` below is proposed, not a claim that a release exists. The evidence versions are upstream pstack 0.15.36 at commit `2776ddd2355d6d6c8747d3964600f28daf62f049`, Pi 1.5.0, pi-loop 0.7.19, and pi-subagents 0.86.0. Both grounding reports establish these inputs. Their runtime recommendations remain unexecuted proposals.

Throughput checkpoint. This is a read-only design step. I read the supplied grounding and contracts, compared whole-package alternatives, and screened the proposed ownership boundaries. I did not start another playbook, launch children, or implement anything.

## Usage before types

### Install and inspect

The installation consists of three independently loaded Pi packages. The release documentation pins the tested versions rather than assuming that npm dependencies activate Pi extensions.

```sh
pi install npm:@trevonistrevon/pi-loop@0.7.19
pi install npm:pi-subagents@0.86.0
pi install npm:pi-mstack@<release>
```

The last command is a proposed installation example. Replace its placeholder with the published release during implementation.

After installation, use these commands in Pi:

```text
/pstack doctor
/setup-pstack
/pstack status
/poteto-mode Implement the parser change and verify its CLI behavior.
```

`/pstack doctor` reports the host version, resource provenance, dependency tools, loaded agents, command collisions, unavailable configured models, and external requirements. It does not install packages, fetch upstream, invoke models, or run bundled scripts. It distinguishes a missing package from tools disabled in the current session and from an unsupported package version.

`/setup-pstack` selects exact available model identifiers and supported thinking levels. Ordered panels remain ordered, including repeated entries. Saving a panel with the same model twice produces an explicit repeated-samples notice, not a diversity claim. Default roles inherit the current parent model. Inheritance is resolved to its exact selector before a port-owned launch rather than relying on pi-subagents' configurable fallback chain.

The proposed role file is `<agentDir>/pstack/models.json`, where `agentDir` respects `PI_CODING_AGENT_DIR`. It is not Pi's provider catalog `models.json`. The new file format has an explicit version. An incompatible existing reference-port configuration is diagnosed and never overwritten automatically.

### Use persistent mode and individual skills

```text
/poteto-mode
Explain the architecture before changing it.
/pstack status
/poteto-mode off
/skill:statechart Model the retry state machine.
```

A bare `/poteto-mode` enables sticky mode without spending a model turn. A task argument enables mode and submits the package's actual mode skill with that task. `/poteto-mode off` records an explicit disabled state without a model call. `/skill:poteto-mode` also activates persistence. `/skill:poteto-mode off` disables it and is consumed before skill expansion.

Mode is local to the active session branch. A fork inherits only the mode entries in its ancestry. Navigating to another branch restores that branch's value. A branch with no activation has no mode instruction. Compaction does not discard the custom mode entry. Loop wakes and child-completion wakes receive the same current mode instruction as ordinary prompts.

Native `/skill:<name>` is the canonical entry for other skills. This design does not register 58 short command aliases. The only compatibility aliases are `/poteto-mode` and `/setup-pstack`, each with one native handler. Native skill frontmatter visibility stays upstream-compatible. At the pinned revision, 57 top-level skills remain hidden from automatic invocation and `setup-pstack` retains its upstream policy. Hidden does not mean unavailable through explicit invocation.

`/skill:make-bot-ui` loads an honest gap page that lists the missing Cursor webhook, secret-storage, and messaging services. It does not start a local imitation of those services. The complete original remains in the source snapshot. Benny's three dormant skills are preserved there but never registered.

### Delegate a design step through the native tool

An adapted architect workflow reads the generated Pi delegation reference, resolves its configured panel, and makes ordinary native `subagent` launches. The following is one illustrative member. The selector is an example from the inspected dependency documentation, not a claim about local availability.

```json
{
  "agent": "poteto-agent",
  "task": "Read the supplied design brief and produce one candidate. Do not implement or launch children.",
  "model": "openai-codex/gpt-5.6-sol:high",
  "async": true,
  "output": "candidate-a.md",
  "options": {
    "context": "fresh",
    "extensionBindings": {
      "pi-mstack/1": {
        "role": "architect runners",
        "slot": 0
      }
    }
  }
}
```

The binding identifies pstack policy without adding a competing execution tool. The extension checks the selected slot and exact model before the native tool executes. pi-subagents owns the child, output mapping, retained run, and completion delivery. The workflow binds output through the native `output` field rather than putting a supposedly authoritative output path only in task prose.

A configured unavailable required selector blocks that launch. Neither the extension nor the adapted skill retries on a different model. Changing the panel requires an explicit later configuration or operator decision. A family requirement in a workflow remains a separate policy requirement and cannot be satisfied by repeating one model under different thinking suffixes.

### Update upstream as a maintainer

The proposed maintainer commands are package scripts, not model tools:

```sh
npm run upstream:propose -- --repo /absolute/path/to/cursor-plugins --commit <full-commit>
npm run upstream:accept -- --proposal .cache/upstream-proposal
npm run generate
npm run verify:offline
npm run verify:package
```

`upstream:propose` reads the selected Git tree into a proposal directory and emits a path-level review report. It does not change the accepted snapshot or generated package resources. The maintainer reviews new files, changed bytes, changed modes, removals, and adaptation changes before accepting the proposal. `upstream:accept` refuses unresolved decisions. `generate` is offline and cannot fetch upstream.

A repeated generation produces no content or mode diff. `generate --check` computes the expected tree and reports divergence without replacing it.

## Shape

### The central data shape

An upstream resource record accounts for every tracked file. Source bytes, their adaptation, and their registration are different concepts. A missing capability does not erase the source file.

The following TypeScript is a declaration sketch. It is not repository code. Branded values are created only by boundary parsers that verify their claims.

```ts
type SourcePath = string & { readonly __brand: "SourcePath" };
type OutputPath = string & { readonly __brand: "OutputPath" };
type ContentHash = string & { readonly __brand: "Sha256" };
type GitCommit = string & { readonly __brand: "FullGitCommit" };
type AdapterId = string & { readonly __brand: "AdapterId" };
type GapId = string & { readonly __brand: "GapId" };
type ExactModelSelector = string & {
	readonly __brand: "ExactModelSelector";
};

type GitFileMode = "100644" | "100755";

type Disposition =
	| { readonly kind: "import"; readonly destination: OutputPath }
	| {
		readonly kind: "adapt";
		readonly destination: OutputPath;
		readonly adapter: AdapterId;
	}
	| {
		readonly kind: "gap";
		readonly gap: GapId;
		readonly exposure:
			| { readonly kind: "source-only" }
			| { readonly kind: "skill-notice"; readonly destination: OutputPath };
	};

type ResourceRecord = {
	readonly sourcePath: SourcePath;
	readonly hash: ContentHash;
	readonly gitMode: GitFileMode;
	readonly disposition: Disposition;
};

type AcceptedSnapshot = {
	readonly repository: string;
	readonly commit: GitCommit;
	readonly subtree: "pstack";
	readonly records: readonly ResourceRecord[];
};

type ReviewItem =
	| { readonly kind: "added"; readonly path: SourcePath }
	| { readonly kind: "changed"; readonly before: ResourceRecord;
		readonly afterHash: ContentHash; readonly afterMode: GitFileMode }
	| { readonly kind: "removed"; readonly before: ResourceRecord }
	| { readonly kind: "unsupported-entry"; readonly path: string;
		readonly gitMode: string };

type ReviewProposal = {
	readonly commit: GitCommit;
	readonly items: readonly ReviewItem[];
	readonly unresolved: readonly string[];
};
```

The accepted record array is sorted by normalized source path. Its order is stable for review and serialization. The importer derives a temporary path map for comparisons. Runtime lookup uses a generated resource index, not a second handwritten inventory.

The proposal is deliberately not an `AcceptedSnapshot`. Unknown Git entry modes, unclassified files, missing adapter reviews, and unsafe paths prevent acceptance. Future symlinks or submodules require a policy decision rather than accidental filesystem traversal. The currently observed modes are ordinary and executable files.

The manifest hashes the literal source bytes with SHA-256. It records the full Git commit separately. A source hash is not a Git object ID. The output index records source identity, adapter identity where applicable, and output hash, so a maintainer can trace a loaded skill to the accepted upstream blob.

### Model roles and mode state

A single port-owned role specification defines role names, scalar or panel shape, default panel size, and the workflows that use each role. Generation derives setup labels, the delegation reference, validation schemas, and role-name types from that specification. A source audit checks that adapted workflow role references are covered. There are no separately maintained role tables in each skill.

```ts
type RoleSelection =
	| { readonly kind: "inherit-parent" }
	| { readonly kind: "exact"; readonly selector: ExactModelSelector };

type NonEmpty<T> = readonly [T, ...T[]];

type RoleAssignment =
	| { readonly kind: "scalar"; readonly selection: RoleSelection }
	| { readonly kind: "panel"; readonly selections: NonEmpty<RoleSelection> };

type ModeState = "unset" | "enabled" | "disabled";

type ModeEvent = {
	readonly version: 1;
	readonly kind: "set-mode";
	readonly enabled: boolean;
};

type RoleResolution =
	| { readonly kind: "ready";
		readonly selectors: NonEmpty<ExactModelSelector> }
	| { readonly kind: "blocked"; readonly diagnostics: NonEmpty<string> };

declare function resolveRole(input: RoleResolutionInput): RoleResolution;
declare function modeFromBranch(events: readonly ModeEvent[]): ModeState;
declare function proposeUpdate(input: LocalGitSource): Promise<ReviewProposal>;
declare function acceptUpdate(input: ReviewedProposal): Promise<AcceptedSnapshot>;
declare function generate(input: AcceptedGenerationInput): Promise<GenerationResult>;
```

`RoleResolutionInput` contains validated role policy, the selected assignment, a native parent-model snapshot, and the exact available-model catalog. It contains no external JSON. `ReviewedProposal`, `LocalGitSource`, and `AcceptedGenerationInput` are boundary-produced domain values. Their parsers own path safety, allowed commands, schema versions, and snapshot verification. These are private package interfaces, not a new public SDK.

The on-disk role file can retain concise selector strings and arrays. The parser converts them to the discriminated domain types above. `inherit-parent` is the sole new-format inheritance keyword. A legacy `auto` value requires an explicit migration choice because omission can invoke operator subagent defaults rather than the current parent.

Invalid configuration never becomes an implicit inheritance policy. The package continues to expose resources and diagnostics, but affected role launches are blocked. Setup refuses to overwrite invalid or partially understood files. Cancellation leaves the existing file unchanged.

The mode reducer consumes only recognized custom entries from the active branch. An unsupported event version produces a visible compatibility diagnostic instead of guessing its meaning.

## Module ownership

The proposed repository has these ownership boundaries:

| Location | Owned knowledge and writes |
| --- | --- |
| `upstream/` | The accepted byte-for-byte pstack snapshot, including its original LICENSE, docs, assets, scripts, manifests, fixtures, and dormant pack. Only the update command changes it. |
| `port/policy.ts` | Exact adaptation decisions, gap identifiers, known path classes, and role definitions. It is the only handwritten policy source. |
| `tools/upstream.ts` | Git-tree inventory, proposal review, accepted resource records, deterministic generation, source/output hashes, permission preservation, and generated-tree checking. One implementation owns the import contract. |
| `generated/skills/` | Generated ordinary skills, playbooks, references, scripts, and explicit gap notices. No manual edits. Relative resource layout matches upstream wherever possible. |
| `generated/agents/` | The two adapted agent definitions. Registration uses the pi-subagents package manifest contract. |
| `generated/resource-index.json` | Derived path, hash, mode, disposition, and registration information. Doctor, mapping documentation, and package checks read it. |
| `extensions/pstack/index.ts` | Native command and event bindings, provenance checks, dependency observations, user-visible diagnostics, and forwarding to native skill expansion. No importer or child-process code. |
| `extensions/pstack/mode.ts` | Pure branch-mode reduction and mode prompt construction. The index appends events through Pi. No mode JSON file. |
| `extensions/pstack/models.ts` | Role-file parsing, exact model resolution, setup transactions, and the port-owned launch guard. It is the only writer of role configuration. |
| `tests/` | Import fixtures and real SDK, CLI, loop, child, and packed-artifact tests. Network suites have separate entry points. |
| `docs/` | Human usage and release procedures. Resource accounting and capability mapping sections are generated from policy and the resource index. |

The precise filename count is not a requirement. Combining the two small pure runtime modules is acceptable if it reduces reading without mixing state ownership. Splitting the importer into independent load, transform, and save frameworks is not.

Package metadata registers one extension, only `generated/skills`, and `pi.subagents.agents: ["./generated/agents"]`. It never registers `upstream`, the repository root, or a broad recursive resource path. The npm artifact includes the raw snapshot, generated resources, the importer, policy, its required fixtures, and the verification entry points it advertises. Published scripts must not reference omitted files.

The npm package does not bundle the two runtime extensions or import them across independently installed module roots. Host APIs are peers. Development dependencies can support tests without activating duplicate runtime packages. The initial compatibility claim is limited to the inspected and tested version combination.

## Runtime behavior and boundaries

### Persistence and command dispatch

On `session_start`, `session_tree`, and immediately before every agent start, the extension reconstructs mode from `getBranch()`. It does not fall back to `getEntries()`, because that would import abandoned-branch state. An unsupported host fails its compatibility check rather than accepting incorrect persistence.

All activation routes call one internal set-mode operation. Repeating the current setting appends no duplicate event. An actual change uses a versioned `pstack-mode` custom entry. Disabling writes a tombstone-like false value, so reload cannot resurrect an earlier enable.

`before_agent_start` adds a small structured `systemPromptOptions.sections` entry. It points at the absolute generated mode skill and instructs the model to read the full file when the relevant instructions are absent, including after compaction. It does not replace the whole system prompt or paste the complete mode skill into every message. Role instructions use their own stable section and compose with the subagent catalog.

The alias handler forwards task-bearing invocations through `sendUserMessage` with prompt expansion enabled. A busy session queues a follow-up rather than injecting a steering command into unrelated work. Print and JSON command handlers await the forwarded task's completion. This forwarding is a release-gated behavior because the reference port's README identifies one-shot lifetime risks.

Commands and skill expansion have different precedence in Pi. The input hook recognizes exact native skill invocations before expansion. It parses the off argument before activation. It does not globally rewrite slash commands or intercept prose containing a command string.

On discovery, the extension verifies command and skill `sourceInfo` against its generated resource paths. A same-named skill from another package is not accepted as this package's mode skill. A command renamed by Pi due to collision produces a diagnostic with actual discovered names and owners. Doctor instructs users to remove or disable the conflicting package. The extension never silently takes over another definition. The installed reference port is an expected conflict case.

### Role selection and native children

The role file parser rejects malformed selectors, empty panels, unknown roles, unsafe keys, and unsupported format versions. It preserves the original full qualified selector, panel order, and duplicates. It uses the model registry to validate provider and entire model ID, including additional slashes. Thinking suffixes are checked against the host's supported levels. Cursor model slugs and generic fast flags are not translated.

Missing roles use the documented role default. Explicit invalid roles block. A panel's configured list is authoritative. An inherited panel expands to the role's documented default sample count. Workflows that require two independent samples or distinct families validate those requirements separately and report the actual panel. They cannot silently append models to an explicit list.

Before a port-owned direct `subagent` call, the native `tool_call` hook validates its binding, slot, and explicit selector against the current role configuration and exact registry availability. A missing or mismatched selection returns a policy error before native fuzzy model matching. In enabled mode, an untagged child execution is rejected with instructions to use the generated binding. In otherwise disabled mode, the guard applies to tagged port launches and does not change unrelated native subagent behavior.

The guard is a boundary check, not a dispatch wrapper. It creates no runs, subscribes to no private RPC, and implements no retries. All adapted workflows use direct native child launches and native management actions. They do not submit opaque workflow scripts whose internal launches would bypass this policy check. Code-mode delivery must exercise the same guard in integration tests or be documented as outside the port-controlled launch path.

This is not a security sandbox. A model that runs arbitrary external code can bypass a prompt-level workflow. The claim is narrower and testable. The port's documented native child path rejects unavailable required selectors and never substitutes another model. Child results report actual model attribution. A mismatch is a failed verification, not a reason to rebrand the run as successful.

The two upstream agents retain their names. pi-subagents owns package-agent discovery. Doctor reports when project or user definitions override them under native precedence. Adapter instructions use real supported fields under `options`, not stale per-launch `tools` fields. Read-only acceptance remains an evidence policy. Restricting tools requires an agent definition and does not make unrestricted Bash read-only.

Fresh children receive the absolute generated mode path and the assigned step. MCP-dependent work requires an appropriate agent definition and explicitly loaded provider extensions. Naming tools in a task is insufficient. The parent retains the playbook. Native artifacts, status actions, and completion delivery remain the execution record.

### Loops and monitors

The port uses ordinary `LoopCreate`, `LoopUpdate`, `LoopList`, `LoopDelete`, and monitor tools for their documented purposes. It uses `subagent` for children. It never calls `OrchestrationCreate` or bridges its protocol-v2 RPC to Nico Bailon's protocol-v1 package. The capability grounding identifies that incompatibility in shipped source.

Generated loop guidance follows one owner per goal. A normal multi-step pstack playbook remains parent-owned policy, not a mirror collection of persistent tasks. An ordinary evolving goal can use a dynamic loop. Work explicitly requiring durable phase routing can use native loop workflows, with no duplicate standalone tasks for those phases. The first implementation does not build a playbook-to-workflow compiler.

Every unattended workflow records its native controller or monitor ID, goal, stop condition, finite budget or expiry, and artifact location in its existing decision trail. A duplicate wake inspects current native state before causing another mutation. It does not blindly spawn the previous child again.

A PR watcher runs through `MonitorCreate` with completion delivery configured. Its output is evidence to inspect, not proof that the host was awakened or that a PR is safe. A monitor completion does not authorize merging. A real provider-visible follow-up turn proves wake delivery in tests.

Session scope is the supported default. Project scope has no scheduler owner election and is not promoted as a safe multi-host coordinator. Pi must remain running. Monitor handles and ordinary buffered wakes are process-local. Recovery inspects native state and retained child runs before resuming. It never claims exactly-once execution or replay-safe external side effects.

The port does not treat a human approval as machine evidence for a loop workflow terminal pause. No user-authority provider was established. Native administrative pause plus an explicit decision trail remains distinct from a verified blocker transition.

## Import and update algorithm

1. Read the complete tracked `pstack` subtree from an explicitly supplied local Git repository and full commit. Use Git tree and blob reads, not a working-directory glob. No fetch is implicit. Validate every normalized path before extraction. Reject unexpected entry kinds and traversal.
2. Hash original bytes and record Git mode. Include dotfiles, both manifests, the MIT notice, branding, all docs, both agents, the dormant Benny pack, every test fixture, and every executable. The pinned acceptance fixture asserts 573 records, 58 top-level skills, 23 playbooks, 24 principles, two agents, and six executable files. These are revision-specific assertions, not permanent totals.
3. Compare against the accepted record set. Report additions, byte changes, mode-only changes, removals, and possible renames. Treat a rename as removal plus addition for correctness. Similarity is only a review hint.
4. Classify through the explicit path policy. Ordinary unchanged resources inherit their accepted disposition. Every new or changed resource requires review, including a changed file previously imported unchanged. Unknown kinds or paths remain unresolved. Nothing new enters through a permissive copy glob.
5. Produce the proposal with source diffs, affected adapters, unresolved references, and proposed output changes. The maintainer reviews the actual upstream diff and updates policy where necessary. Acceptance records the reviewed source hash and mode for each decision. A changed adapted file cannot reuse a previous hash approval just because its old replacement anchor still matches.
6. On acceptance, publish the verified raw snapshot and accepted manifest. No raw upstream executable runs. A failure leaves either the previous accepted state or a detectable hash mismatch. There is no claim of a cross-directory filesystem transaction. Rerunning reconstructs from the selected Git tree rather than trusting an incomplete copy. Generation and packaging refuse mismatched source and manifest state.
7. Generate a fresh candidate output tree. Imported resources copy exact bytes and modes. Markdown adapters apply path-scoped replacements with expected occurrence counts and source-hash checks. Agent adapters emit native frontmatter and instructions. Unsupported skill adapters emit gap notices with original names and visibility. The source-only dormant pack has no generated skill path.
8. Keep executable files and fixtures out of prose rewriting. A script change requires an explicit file-specific adapter and tests. Preserve all fixture bytes unless that exact fixture is part of a reviewed behavioral adaptation. Preserve the original lockfiles and launchers. Do not insert generated notices into executable text.
9. Generate the resource index, command/capability mapping, provenance notices, and adapted role reference. Preserve relative directory structure. Check links against both generated resources and preserved source. Rewrite a link only when its known destination moved. A gap link points to the original source or the generated notice rather than a nonexistent resource.
10. Check skill names, frontmatter visibility, package resource registration, executable modes, licensing, and unresolved host references. Historical docs and explicit gap explanations may mention Cursor. Active instructions cannot call Cursor tools. A path-scoped allowlist distinguishes those cases. Verify exact adapter match counts so a partial rewrite cannot look successful.
11. Compare the complete candidate to the existing generated tree. In check mode, report differences. In write mode, replace only generator-owned outputs and remove stale generated files. Refuse manual modifications that do not match the previous generated index rather than silently destroying them. Temporary directories are per invocation. Interrupted publication is detected by index/hash checking and repaired by regeneration.
12. Generate again into another fresh directory and compare paths, bytes, hashes, and modes. Generation records no wall-clock time, local source checkout path, random identifier, filesystem enumeration order, or absolute installed path. Runtime discovers absolute paths relative to the installed package.

The raw and generated trees are two representations, but only the raw tree and adaptation policy are maintained inputs. Generated content is never an independent fork. The update command is the single writer. Concurrent proposals use separate directories. Canonical acceptance refuses to run concurrently in the same checkout, using a scoped update claim with recognizable ownership and interruption diagnostics. Separate checkouts can produce independent proposals for normal Git review.

The executable worktree-audit adaptation must be reviewed directly. It must not recursively search all private Pi sessions or assume `origin/main`. Preserve upstream base selection and platform support. Any recall behavior accepts explicit relevant session paths or the current workspace's native session metadata. No implicit Git fetch or session-wide scan occurs on extension load.

## Capability and mapping table

These classifications describe the proposed port. Supported mechanisms are source-observed in the grounding, not runtime-certified in this report.

| Upstream behavior | Pi mapping | Boundary |
| --- | --- | --- |
| Principles, engineering guidance, playbooks, writing rules | Generated skills and unchanged nested resources | The agent interprets workflow policy. Generation does not convert prose into an execution engine. |
| Cursor skill commands | Native `/skill:<name>` | Short aliases exist only for native mode and setup behavior. |
| Cursor Custom Mode | Branch-persistent extension state and prompt section | No claim of the Cursor editor gesture or Custom Modes UI. |
| Setup `.mdc` model rules | Versioned pstack role JSON and native setup UI | Exact registry selectors replace Cursor slugs. Pi core model settings remain untouched. |
| Task and background panels | Native `subagent`, async completion, native artifacts | No private execution manager, no fake tool allowlist, no silent model fallback. |
| Cursor `/loop` and watchers | pi-loop ordinary controllers and monitors | Active host required. No protocol bridge and no exactly-once guarantee. |
| Cloud-agent isolation | Optional native Git worktrees | Worktrees share the machine, credentials, processes, and network. VM isolation remains unavailable. |
| Always-on automation and Benny triggers | Preserve dormant source with explicit gap records | No Slack trigger daemon, service deployment, or dormant skill registration. |
| Bot webhooks, secrets, `SendToUser`, `update_state` | Hidden skill notice plus preserved original | No established native replacement. Operator approval is required before adding a platform. |
| Editor-selected context | Explicit task context and files | No fabricated Cursor editor context. |
| `deslop`, `control-ui`, `control-cli`, `/create-skill` | Capability checks and project or separately installed tools | External Cursor team-kit resources are not silently added to the upstream skill set. |
| Bugbot and forge reviews | Inspect existing authenticated forge evidence | Reading comments does not install or guarantee the review service. |
| GitHub and optional Origin workflows | Preserve upstream branching, native shell tooling, monitors | Authentication and tools are prerequisites. Monitor exit is not a merge verdict. |
| MCP-backed `why` research | Explicit provider discovery and child-provider loading | Missing evidence categories remain visible gaps. |
| Recall and session pickup | Pi session branch APIs and exact retained child records | No global private-history search. |
| Statechart and formal verification | Complete original compiler, scripts, corpus, and explicit compatibility patches | Trusted local views execute code. TLC, Java, renderers, and network bootstrap remain separate prerequisites. |
| Video catch-up | Preserve workflow and inspect a configured renderer's output | Renderer and presentation availability are not established by Pi installation. |
| README, guides, logo, plugin metadata | Preserve raw provenance and provide an adapted Pi entry document | Historical Cursor documentation stays visibly labeled as original material. |

The generated mapping document links each capability and gap to its resource records. Licensing retains the original MIT notice naming Lauren Tan. Imported documentation and scripts carry that notice with the distributed package. Reference-port code reuse needs a separate provenance entry and review against the pinned upstream. This candidate does not assume that the logo's license grants trademark rights or that runtime tool distributions share pstack's license.

## Validation plan

The verification program has separate offline, native-runtime, optional network, and optional live-model commands. A missing external prerequisite is a skipped or blocked named suite, not a passing parity test.

### Offline import and resource checks

- Build small local Git fixtures containing dotfiles, executable files, unusual filenames, mode-only changes, additions, removals, broken links, unknown modes, and changed adapter anchors. Assert complete accounting and refusal of unresolved proposals.
- Pin a full source fixture or source manifest for the supplied upstream commit. Assert the full resource set, executable modes, original MIT notice, dormant exclusions, and preservation of all 376 statechart test-tree files reported by grounding.
- Apply an upstream change to an already imported Markdown file. Assert that it needs review even when no adapter exists. Change only an executable fixture's bytes and assert that no prose replacement touches it.
- Run generation twice into different directories and compare byte-for-byte and mode-for-mode. Include stable manifest serialization and absence of checkout-specific paths.
- Inject interruption at publication boundaries. Assert that check mode catches incomplete state and rerunning converges. Assert that a manual generated edit is reported rather than overwritten.
- Validate local links, skill frontmatter policy, exact upstream names, agent declarations, output ownership, and stale-output removal. Detect unresolved active Cursor calls separately from intentional historical text.
- Run upstream offline script tests unchanged where possible. Keep new compatibility tests beside explicit adapters. Do not silently replace or omit upstream tests because the reference package did so.

### Real Pi and native execution checks

Load the packed candidate, loop 0.7.19, and subagents 0.86.0 in isolated Pi 1.5.0 SDK sessions. Use isolated directories, settings, credentials, stores, and explicit resources. Bind extensions through the real resource loader. A deterministic file-backed scripted provider supplies valid model and tool events without remote inference.

Assert these behaviors through the actual provider-visible prompt and actual session tree:

- The package exposes exactly its generated skill set and two package agents. Raw source skills, Benny skills, and duplicate runtime extensions do not load.
- Mode on, off, native skill activation, off arguments, bare toggles, task forwarding, busy follow-ups, reload, compaction, resume, forks, and branch navigation behave as specified.
- A background custom-message wake includes the correct current mode instructions. A disabled branch does not inherit an activation from another branch.
- Same-name commands and skills from a fixture package cannot masquerade as this package's resources. Doctor reports actual provenance and collision names.
- Setup round-trips panel order, duplicates, full model IDs containing slashes, thinking suffixes, and parent inheritance. Missing, invalid, unknown-version, and partially rejected role files never trigger silent model substitution or destructive saves.
- A genuine native foreground child and a detached child discover the packaged agent. The detached fixture explicitly loads the scripted provider. Assert actual child model, thinking, output artifact mapping, retained run, and parent completion turn.
- A required selector absent from the registry is rejected before a native child starts. Test native fuzzy near-matches, a changed parent model, stale slot bindings, host thinking ceilings, model scopes, and ordinary unrelated subagent calls when mode is off.
- The model-policy hook runs for the documented direct native call path, including supported code-mode calls. An opaque workflow script cannot silently become a port-owned checked dispatch.
- Read-only acceptance does not advertise filesystem enforcement. A provider-dependent child fails clearly when its required provider is not loaded.

Run a separate real CLI/RPC process against the packed package. Subscribe before actual prompts and wait for `agent_settled`, not merely `agent_end`. For handled, model-free commands, assert the command response and state without waiting for a nonexistent agent turn. Test print and JSON forwarding to ensure the host remains alive through the submitted task.

Disable cache warming, retries, automatic compaction except in its dedicated test, ambient credential discovery, and unnecessary network behavior. `--offline` is not a sandbox. The test provider must be the only reachable inference route. Bound and dispose sessions, timers, monitors, and children.

### Loop behavior checks

Use actual loop tools with a scripted provider and a harmless local monitor executable. Assert ordinary scheduling, dynamic continue, finite limits, expiry, cancellation, monitor completion, and a real follow-up turn. Deleting or pausing a controller prevents later work. A duplicate wake does not create a second child for an already completed step.

Restart the host and assert only the documented recovery behavior. Do not expect an ordinary buffered wake, a monitor handle, or its output to survive. Confirm that a successful monitor exit alone does not create false verification evidence. Assert that the adapted resources contain no `OrchestrationCreate` delegation path and that loading the two packages never implies protocol compatibility.

### Package and release checks

Create an npm tarball and install it into a clean isolated agent directory alongside only the two documented dependency packages. Check both manifest discovery and executable modes from the installed artifact. Run the advertised maintainer check entry points from the artifact if the README claims they are included.

A release is blocked by resource loss, generated drift, an unresolved adapter review, a loaded dormant skill, a missing MIT notice, command provenance ambiguity, or a failed native lifecycle check. Package contents are checked against the generated index rather than a second handwritten file list.

### Separate network and model evaluation

Network suites cover upstream fetch comparison, renderer installation, Java/TLC bootstrap, and authenticated forge or MCP checks. They run only with an explicit command and cache policy. Inspect lifecycle-script behavior before preserving or adapting upstream bootstrap commands. Safe installation changes are exact script adapters, not importer-wide string replacements.

Optional live-model evaluation covers playbook routing, reading hidden skills, panel discipline, provider loading, capability-gap honesty, and refusing to describe worktrees as VMs. Scripted providers establish host contracts. They cannot prove that a real model follows all workflow prose.

## Whole-shape alternatives considered

### Selected alternative A. Raw snapshot plus deterministic generated resources

The user installs ordinary Pi resources and a small extension. The maintainer changes upstream bytes only through review and expresses Pi differences in path-scoped policy. This hides import mechanics from users while keeping adaptation review visible to maintainers. The public runtime commands do not expose importer stages or internal RPC details.

Its cost is shipping both raw and generated representations and maintaining some exact adaptation rules. That cost is acceptable because only one representation is manually adapted. It also lets ordinary Pi skill loading and native child discovery work without a custom resource interpreter.

### Rejected alternative B. Raw-only package with runtime translation

Ship the original upstream tree and interpret or transform skills dynamically as the model reads them. A custom read tool or virtual filesystem could present adapted text, leaving one physical copy.

This hides byte rewriting from the maintainer but exposes a more serious operational requirement to every caller. Reads, relative links, executable scripts, native skill discovery, and child resource inheritance must all use the virtual path. A normal filesystem read can bypass translation. Runtime loading would have to handle more adaptation failures, and child sessions would need the same interpreter. Its smaller disk footprint does not justify replacing native resource semantics.

### Rejected alternative C. Curated native fork with bundled executors

Copy the reference port, manually edit its skills, and bundle loop and child execution behind one pstack command or workflow engine. This gives users a short installation path and can hide several native APIs.

It loses upstream accounting unless a separate synchronization system is added later. It also creates a second executor, inherits omitted resources and stale advice, and risks loading dependencies twice. A deeper-looking command does not compensate for split ownership of runs, model routing, and scheduler state. The observed incompatible orchestration contracts make an implicit bridge especially unsuitable.

## Red-flag screening

- The native extension does not expose separate load, validate, transform, and save operations to consumers. Setup is one transaction, and a mode task is one command.
- No module forwards child execution under another name. The model guard adds exact-selection policy at a real boundary but never dispatches.
- Mode has one native session owner. Roles have one file owner. Loop state and child state stay with their dependency packages. No mirror JSON combines their mutable state.
- Role documentation, resource accounting, gap lists, and package checks derive from policy and generated records. Generation fails on disagreement rather than asking maintainers to synchronize lists.
- Transport payloads stay inside the Pi event bindings. The importer and model resolver accept validated domain data. No private dependency RPC becomes a public pstack API.
- Native skill invocation and compatibility aliases share behavior. They do not keep separate activation implementations.
- The package exports no reusable internal runtime SDK. Tests enter through commands, artifacts, or package-private modules. New contributors cannot take a public shortcut into importer internals.

## Tradeoffs accepted

- We accept a larger tarball in exchange for complete provenance, dormant preservation, and auditability of original versus adapted resources.
- We accept three package installations in exchange for native ownership and avoiding duplicate extension loads.
- We accept explicit update review in exchange for preventing changed upstream assumptions from passing through stale adapters.
- We accept direct native child launches instead of generated workflow scripts in exchange for exact, testable model-policy checks without a dispatch framework.
- We accept active-process scheduling limits in exchange for not operating an unrequested daemon or cloud service.
- We accept hidden gap notices for unsupported top-level skills in exchange for preserving names without advertising nonexistent execution capabilities.
- We accept a stricter role configuration boundary than the reference port in exchange for never turning an invalid required selector into parent-model inheritance.

## Synthesis status and residual risks

This is one independent candidate. No cross-candidate synthesis has occurred. Its proposed base is alternative A. The parent should compare it with the other candidate on fidelity, update review, native runtime evidence, and independently maintained representations.

The binding-based model guard is the main item to prove early. The supplied subagent schema supports `options.extensionBindings`, but this report has not executed that path or established hook behavior for every host execution mode. A failed real-host experiment should narrow the supported call path or replace the binding mechanism before implementation spreads. It should not lead to a second child executor.

The initial host compatibility range and final npm name remain release decisions. The default is the inspected Pi 1.5.0 combination and a separately installed package. Broader host support earns a compatibility claim only after the same runtime suite passes.

Adding Cursor cloud, bot secrets, webhooks, or always-on triggers requires an operator product decision. This candidate preserves their source and reports the gaps. It does not delay the ordinary native port while inventing those services.

## First implementation step

Build the local-Git inventory and deterministic-generation check against the supplied pinned subtree, with failing tests for a new unreviewed file, a changed adapted file, an executable mode change, and a second generation diff, before adding any runtime command.

The next verifiable units are native branch-mode behavior, exact role resolution and the native launch check, packed-package discovery, and real loop and child lifecycle tests. Each unit must pass its own check before the next broadens the port.

## Evidence, principles, and work performed

I read the complete [design brief](/Users/asper/source/pi-mstack/docs/design-brief.md), [upstream grounding report](/Users/asper/.pi/agent/sessions/--Users-asper-source-pi-mstack--/subagent-artifacts/outputs/06b559dd-80ad-43c8-b210-533a5f65b5e9/grounding.md), and [Pi capability report](/Users/asper/.pi/agent/sessions/--Users-asper-source-pi-mstack--/subagent-artifacts/outputs/ea724fd4-5bf7-4044-a321-99363d2afbbe/pi-capabilities.md). I also read the installed architect skill, its runner prompt, rationale template, and design red flags. The reports supply the inventory and API findings used here.

Additional direct reads were the reference port's extension and model configuration excerpts, the requested pi-subagents model documentation and public launch schema, and the pi-loop reference excerpt. The schema confirms the native option nesting and `extensionBindings` field used in this proposal. These reads do not establish runtime success.

The following principles changed concrete design choices. I read each named leaf skill in full during this task.

- Model the Domain changed the importer from a copy script into complete resource records with explicit dispositions and a separate unresolved proposal type.
- Boundary Discipline placed JSON parsing, Git path validation, native event parsing, and exact model checks at their entry points rather than repeating guards through workflows.
- Type System Discipline replaced optional adaptation fields and ambiguous mode booleans with discriminated variants and validated semantic identifiers.
- Make Operations Idempotent changed generation to fresh-tree derivation and mode changes to setting a value rather than toggling implicitly.
- Separate Before Serializing Shared State kept native loop and child records separate and gave concurrent proposals their own directories. It limited serialization to acceptance of one canonical checkout state.
- Laziness Protocol rejected a private RPC bridge, a pstack child tool, a daemon, and a playbook compiler.
- Minimize Reader Load kept import knowledge in one owner and reduced command-to-state tracing to the native binding and its domain owner.
- Encode Lessons in Structure made dormant exclusion, source provenance, adapter coverage, and model-selection failures machine-checkable instead of repeated prose cautions.
- Prove It Works separated source-observed mechanisms from the real packed-package, Pi, loop, and child checks required before claiming parity.
- Sequence Work into Verifiable Units put deterministic source accounting before runtime feature work and gave persistence, roles, discovery, and lifecycle behavior separate checks.

I also read how, unslop, technical-writing, and typescript-best-practices. The supplied grounding serves the how requirement without forbidden child delegation. This report is a design explanation with the required usage and declaration sketches.

I reread the saved report's usage, runtime boundaries, and closing sections. A read-only artifact check confirmed all required candidate sections, balanced code fences, and the absence of long-dash punctuation. I also screened the design against the supplied red flags. These are report checks, not implementation tests.

No repository files changed. No child agents, upstream scripts, network operations, model calls, or runtime tests ran. The only written artifact is this candidate report. All generation guarantees and runtime behavior above are proposed acceptance requirements until implemented and verified.
