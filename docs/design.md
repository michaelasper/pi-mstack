# Pstack port design

This is the original design record. The current [configuration reference](configuration.md) supersedes its command-routing details: short mode routes now use input transforms, and saved defaults are supported.

## Goal and consumer contract

Port Cursor pstack to pi without creating a manually maintained workflow fork. Users get the upstream skill set, native persistent Poteto Mode, configurable model roles, and explicit capability gaps. Maintainers get a pinned source snapshot and a reproducible update command.

Install the two execution dependencies separately, then install this local package.

```sh
pi install npm:@trevonistrevon/pi-loop@0.7.19
pi install npm:pi-subagents@0.86.0
pi install /absolute/path/to/pi-mstack
```

No npm publication is implied. The proposed package name is `pi-mstack`.

```text
/pstack doctor
/setup-pstack
/poteto-mode
/skill:poteto-mode Inspect and fix the parser.
/poteto-mode off
/skill:how Explain the retry logic.
```

Only `poteto-mode`, `setup-pstack`, and `pstack` are extension commands. Other skills use native `/skill:name`. Upstream visibility remains intact. The bot UI skill remains discoverable by explicit invocation but becomes an honest capability-gap notice. Benny remains dormant.

## Synthesis decision

Sol's raw snapshot plus generated resources is the base. It keeps upstream bytes available offline, including omitted resources and executable fixtures. Muse's smaller runtime and independent dependency installation are retained. Both candidates agree that this package must not own scheduling, child execution, a cloud platform, or an RPC bridge.

Parent assessment uses five points per criterion. These are design judgments, not measured performance.

| Criterion | Muse | Sol | Reason |
| --- | ---: | ---: | --- |
| Upstream fidelity | 4 | 5 | Sol preserves the complete source and original skill names. |
| Update determinism and drift review | 3 | 5 | Sol separates proposal from acceptance and reviews every changed resource. |
| Native pi integration | 4 | 3 | Muse avoids a launch-policy layer. Sol's binding guard blocks ordinary workflow composition. |
| Honest capability boundaries | 5 | 5 | Both separate source preservation from service parity. |
| Reproducible verification | 4 | 5 | Sol includes packed artifact and interrupted-update checks. |

Reject Sol's mandatory tagged child launches and model-enforcement hook. They add a second policy protocol, disable native scripted workflows, and are not necessary to port upstream's prompt-driven role selection. The runtime exposes validated effective role selections. Adapted instructions pass exact selections to native subagent calls and check actual results. This is workflow policy, not an execution sandbox or a guarantee that an arbitrary model obeys it.

Reject Muse's mixed update-and-publish flow and reliance on an informal release checklist for unresolved changes. Acceptance and package checks enforce the reviewed source manifest. Reject removing `make-bot-ui` from the registered top-level names. Its gap notice preserves the name without claiming implementation.

A fresh Muse review also cross-judges the candidates against this synthesis. Sol independently reviews the combined design. Neither candidate author report counts as acceptance.

## Data and ownership

The import domain is a sorted array of resource records.

```text
ResourceRecord = sourcePath + storagePath + sha256 + gitMode + disposition
Disposition = copy(outputPath) | adapt(outputPath, adapterId) | preserve(reason, exposure)
PreservationReason = provenance | historical | dormant | capability-gap(gapId)
PreservationExposure = snapshot-only | generated-notice(outputPath) | generated-asset(outputPath)
Snapshot = repository + fullCommit + subtree + pluginVersion + ResourceRecord[]
Proposal = candidateSnapshot + added/changed/removed/modeChanged + unresolvedReviews
ModeEvent = version 1 + enabled boolean
RoleSelection = inherit-parent | exact provider/model-id[:thinking]
RoleAssignment = scalar RoleSelection | ordered nonempty RoleSelection[]
```

Every file remains in the raw snapshot regardless of disposition. Dormant resources must be snapshot-only. Capability-gap notices may expose a generated skill, but original unsupported instructions never become active resources. Provenance and historical preservation do not create capability-gap records.

Only ordinary Git files and executable files are accepted. Reject symlinks, submodules, unsafe paths, duplicate destinations, unsupported schema versions, and unknown dispositions. SHA-256 hashes identify literal bytes, not Git object IDs. The upstream commit identifies provenance. These are separate fields.

The source tree is `upstream/pstack/`. The accepted manifest is `upstream/manifest.json`. Standard npm packing excludes reserved `.gitignore` paths. Preserve those literal bytes under the single explicit safe storage mapping `.gitignore` to `__npm_reserved_gitignore__`. Record both sourcePath and storagePath. Every other path retains identical storage unless a separately reviewed npm-reserved case requires an explicit mapping. Validate storage path containment and collisions. Source identity, hashes, and modes always describe the original upstream tree. An export operation and packed-artifact test must reconstruct the original paths, bytes, and modes exactly. This narrow storage exception preserves standard `npm pack`; no custom tarball patcher is allowed. The generated runtime tree is `generated/`. The manifest preserves all 573 pinned files and their Git modes. Generated resources retain the upstream relative layout where possible. Raw and generated are not separately maintained forks. Only the source snapshot and adaptation policy are inputs.

The package manifest explicitly declares `pi.extensions: ["./extensions/pstack/index.ts"]`, `pi.skills: ["./generated/skills"]`, and `pi.subagents.agents: ["./generated/agents"]`. No discovery root reaches `upstream/`. The npm files set includes `extensions/`, `generated/`, `upstream/`, `port/`, `tools/`, `tests/`, `docs/`, `LICENSE`, and the required package/configuration files. This ships both provenance and every advertised maintainer entry point. Exclude caches, credentials, local orchestration state, and node_modules. The packed artifact must discover the exact 58 top-level names, including the bot gap notice, no Benny names, and generated ownership paths for mode and setup.

The importer owns source acceptance and generated output. The extension owns branch-local mode entries and its role configuration. pi-loop owns controller state. pi-subagents owns child state. Do not mirror dependency state in a combined port database.

## Maintainable adaptation strategy

Use the upstream project's own Claude Code generator as a precedent. It preserves most content and inserts a required host-adapter reference into skills rather than maintaining rewritten copies of every playbook.

The Pi port uses the same approach with stronger executable and drift checks.

1. Preserve every upstream file byte-for-byte in the accepted snapshot.
2. Generate skill resources with a prominent Pi adapter instruction after frontmatter and before upstream instructions. The adapter explicitly takes precedence for host-specific names, tools, models, paths, and unavailable services. Each skill and nested prose entry point must reach that adapter before executable host instructions. Nested playbooks and references get a short adapter preamble where their content uses host concepts.
3. Generate `docs/harness/pi.md` from one host mapping registry. Cover Cursor Task fields, generalPurpose, model slugs, readonly, cloud isolation, file attachments, skill invocation, todo lists, loops, monitors, session history, model setup, and services. Native calls use supported pi-subagents schema fields. The adapter forbids OrchestrationCreate as a delegation bridge.
4. Replace the setup skill with native setup instructions and preserve its original in the snapshot. Apply a small exact patch to Poteto Mode's host entry and persistent-mode text. The adapter handles repeated host vocabulary instead of editing each occurrence independently.
5. Generate native agent definitions with supported frontmatter and an absolute-path handoff requirement. Do not search Cursor installation directories. Agent definitions may restrict tools. An acceptance role is not a filesystem permission.
6. Replace `make-bot-ui` with a gap notice retaining its original frontmatter name and visibility. Keep Benny out of the registered skill root. Preserve original docs, images, manifests, and assets as historical resources, never as native runtime claims.
7. Executable scripts and fixture bytes are never subject to generic prose rewriting. The worktree-audit script needs an explicit adapter for workspace-scoped Pi history. Keep upstream default-branch and platform support. Network-install hardening is an exact script patch where needed, not an importer-wide replacement.

Mandatory evidence and authority gates keep their original meaning. A substitute must satisfy the original requirement. If it cannot, dependent actions remain blocked. Optional omissions may be reported and skipped only when no required gate depends on them. Never inherit the Claude adapter's blanket skip-and-continue policy. Shipping cannot arm a merge without independent real-product verification. Missing UI control blocks a required UI verification until a demonstrated equivalent is available. A placeholder is never a verdict.

The mapping registry starts with every term in upstream `scripts/generate-pstack-harness-trees.mjs` and adds Pi-specific mappings for AskQuestion, bare skill routing, child steer/resume/stop, worktree launch fields, MCP provider loading, model defaults, and capability gates. AskQuestion maps to an available user-interaction tool or a plain question, never an invented tool call. The scanner emits unmapped terms, missing referenced roles, and stale unreferenced roles. Missing mappings or roles fail generation. Stale roles require explicit retirement or a documented compatibility decision.

Role labels are derived and checked against upstream setup and workflow references. The initial registry includes all 17 observed labels. No separately maintained setup list is allowed. Missing-config defaults, rejected-selector defaults, nearest-slug fallback, same-family fallback, and Cursor budget defaults are adapt-required patterns. Give each affected file a source-hash-bound exact patch removing the contradictory paragraph and naming the native role-data section instead. At minimum inspect arena, architect, how, why, reflect, swarm, interrogate, and poteto-mode. Generation fails if a flagged fallback pattern survives in active prose. A preamble alone cannot satisfy this check.

A host-term scanner classifies every host-dependent Markdown resource. Every recognized term must map to a registry entry and the resource must contain the adapter preamble or be an explicit preserved historical resource. Cursor wording retained beneath that preamble is source vocabulary interpreted through the mapping, not an instruction to call nonexistent tools verbatim. Unknown terms and changed source bytes require upstream review. Do not claim that a lexical scan proves semantic equivalence. Real-model workflow quality remains separate from API contract tests.

This strategy deliberately keeps upstream prose visible. If review finds a host-specific passage whose meaning cannot be translated reliably by the adapter, give that exact file a hash-bound patch or replacement. Do not expand a broad rewrite rule to hide the conflict.

## Import and update contract

The maintainer interface has three operations.

```sh
npm run upstream:propose -- --repo /path/to/cursor-plugins --commit FULL_SHA
npm run upstream:accept -- --proposal .cache/proposal --reviewed REVIEW_DIGEST
npm run generate
npm run check
```

An explicit `upstream:fetch` convenience command may fetch the canonical repository into the cache. Proposal and generation never fetch implicitly. Extension load never contacts upstream, installs dependencies, or executes scripts.

Proposal reads Git tree and blob objects at the requested full commit. It does not trust a working checkout or run upstream code. It stages bytes, modes, and a sorted report in a unique directory. Every addition, removal, content change, and mode change needs a decision. Renames are removal plus addition, with optional similarity hints. New file kinds and unsupported entries fail closed.

The review digest binds the candidate source manifest and a sorted path/hash list of all generator code, mapping/scanner tables, role definitions, exact patches, agent templates, gap notices, and other adaptation inputs under `tools/` and `port/`. Adding, deleting, or changing any listed input invalidates approval, including template-only changes. Acceptance revalidates that digest and every staged byte, mode, and disposition. A changed adapter needs a reviewed source hash. No force flag silently carries an old approval forward. The command can record the operator's acknowledgment of unchanged copy policy for ordinary files, but cannot resolve unknown kinds or missing adapters automatically.

Acceptance and generated-tree publication share an exclusive checkout writer lock acquired with atomic mkdir. Store hostname, PID, process-start evidence, proposal digest, and a random ownership token in the lock. Never acquire through check-then-write. A live local owner or an owner whose liveness cannot be established blocks mutation. Release verifies the token. A crashed local owner can be recovered only through an explicit repair command that verifies the owner is dead. A foreign or ambiguous lock requires operator acknowledgment and is never automatically stolen. Repeating the verified proposal after that repair must converge. Proposal directories are isolated. Publication failures must leave either the previous accepted state or a detectable mismatch that blocks generation. Do not claim a cross-directory atomic transaction. Repeating acceptance from the same verified proposal repairs a partial publish.

Generation is offline. It validates the complete source against the manifest, builds a candidate tree, and derives an output index with source hash, adapter identity, destination, output hash, and mode. It never records time, absolute checkout paths, or nondeterministic ordering. Check mode computes differences without writing. Write mode refuses unexplained manual edits to tracked generated files. Recovery of an interrupted generated write requires an explicit repair operation and verified raw source. It deletes only stale generator-owned files.

Links whose destinations exist in generated resources remain relative. Links to source-only preserved files are rewritten to the shipped `upstream/pstack/` location relative to the generated file. Links to deliberately unshipped resources use a pinned-commit upstream URL, never main, or require an explicit removal adaptation. Resolve links in the unpacked artifact as well as the checkout.

Checks cover source inventory, manifest completeness, dormant exclusions, visibility, frontmatter names, local links, mapping coverage, exact patch matches, executable modes, licensing, and deterministic regeneration. No timestamp or package version string substitutes for the full commit and hashes.

## Runtime contract

### Mode

Bare `/poteto-mode` sets enabled without a model call. Repeating the same state writes no duplicate entry. `/poteto-mode off` appends a disabled entry. Task arguments enable mode and submit the package's own generated skill plus the task. Native `/skill:poteto-mode` activation is observed before expansion. Its exact off argument disables without running the skill.

Reconstruct state from `getBranch()` on startup, tree navigation, and before a run. Use versioned namespaced custom entries. A branch without an event is disabled. Forks inherit only ancestor events. Never scan all session entries for current state.

Use separate `before_agent_start.systemPromptOptions.sections` entries for mode and role data. The mode instruction contains the absolute generated mode path only while enabled. Validated role data is present independently of mode for standalone skills, nested reads, and custom-message wakes. This prevents `/skill:how` with mode off from losing configured selections. Include custom-message wakes. Do not replace the host system prompt. Invalid config produces diagnostics, not a silent inheritance table.

The guaranteed consumer routes are bare toggle, off, and native `/skill:poteto-mode <task>`. Task-bearing short-command forwarding is conditional on a prototype, not yet promised. Pi's extension `sendUserMessage` returns void, so awaiting that call is not a lifetime mechanism. Test TUI, RPC, print, JSON, and busy follow-up delivery through the actual host. Wait for `agent_settled` on real runs, not `agent_end`. This is a prototype gate. If the host command API cannot keep a one-shot run alive, use input transformation or an explicitly documented native invocation route rather than shipping a false promise. Tests must settle the choice before implementation spreads.

### Roles

Use one role registry for setup, parsing, status, and injected instructions. Preserve upstream role labels and ordered panel entries. Role configuration lives under the native agent directory in `pstack/models.json` with a port-specific version tag. An incompatible preexisting file is reported and never overwritten automatically.

Default selection is parent inheritance. The injected table resolves inheritance to the active parent's exact provider/model selector for the current run, so omission cannot accidentally select a user agent override instead. Explicit models keep their full identifier and thinking suffix. Validate against the authenticated available registry and host-supported thinking levels. Setup offers `ctx.scopedModels` when nonempty, otherwise the authenticated available set. Preserve persisted out-of-scope choices and diagnose them rather than rewriting them. Session picker scope and child launch enforcement are different policies. No fuzzy matching, Cursor slug translation, generic paid fast mode, or silent substitution is part of this package.

Setup is transactional. Cancellation and invalid input leave the file unchanged. Use same-directory atomic replacement and restrictive permissions. Headless setup reports instructions or current configuration and does not invent choices or rewrite defaults. Unavailable explicit selections remain visible blockers for the affected workflow. Other resource use can continue.

Role status distinguishes registry-valid from native-launch-eligible. Observe current public settings for subagents.modelScope, global/per-agent enforcement, strict mode, subagents.maxThinking, project trust, current parent, and session scope where available. Explain known scope or ceiling conflicts separately from missing authentication. Do not reimplement native matching or promise readiness when policy cannot be fully established. Status then says native preflight required. Native pi-subagents remains authoritative and can reject a configuration after settings change. Resolving inheritance to an explicit parent selector can make enforced scope reject it; report that failure without retrying an omitted model or a substitute. Tests must exercise native rejection under scope, strict inheritance, per-agent restrictions, and thinking ceilings. An observed failure remains a blocked step, not a successful launch.

The extension does not execute child runs or intercept unrelated calls. Adapted workflows use native async subagent calls and workflows, bind output through native fields, and inspect actual attribution. Exact role selection is an instruction contract with validated configuration, not a security guarantee.

### Diagnostics and provenance

Doctor reads registered tool and command metadata and reports observable capabilities. It distinguishes present, inactive, absent, and unverified when the host exposes those facts. Do not infer installed versions or package-agent definitions from tool names alone. Use public metadata where available and report unverified elsewhere rather than importing private dependency internals.

Check the exact owning paths of mode and setup resources before every activation, disable, input consumption, or forwarding operation. The native `/skill:poteto-mode` hook must check ownership before writing any entry. On mismatch leave state unchanged and report the winning sourceInfo. At session_start inspect all three command names and both special skill names and emit collision notices, including numeric command suffixes and extension commands shadowing native skill names. Test the suffixed invocation as well as native on/off. Do not consume another package's off command.

Check the exact owning paths of mode and setup resources before forwarding. If another installed port wins skill-name discovery, fail with an actionable collision message. Duplicate command suffixes and user/project agent overrides must remain visible where public APIs expose them. Native agent overrides remain operator choices, but a workflow cannot claim the bundled agent's restrictions without confirming the actual resolved definition. Otherwise report agent provenance unverified. No alias silently calls a different package's skill.

This package has only host peer dependencies at runtime. Separately installed loop and subagent extensions are not imported across module roots. Test dependencies can be pinned in development. Document the tested version combination and warn about untested versions only when versions are actually observable.

## Missing capabilities

The package does not provide Cursor cloud VMs, editor selection, the Custom Mode gesture, always-on automation, Benny triggers, bot routine webhooks, secret storage, SendToUser, Bugbot as a service, or a video renderer. It also does not bundle cursor-team-kit's deslop, control-cli, or control-ui. A project or separately installed tool may satisfy verification needs, but the port must inspect that tool before claiming it does.

Worktrees isolate source changes, not credentials, processes, or network. pi-loop requires an active host and does not promise exactly-once side effects or durable monitor handles. Existing forge comments remain usable evidence. Missing external services do not prevent the ordinary skill port, but they prevent a claim of full Cursor service parity.

## Verification gates

1. Local Git fixtures test unsafe paths and modes, additions and removals, mode-only drift, modified source and generated bytes, unknown adapters, stale review digests including template-only changes, missing/stale role labels, surviving forbidden fallback paragraphs, concurrent acceptance/generation, abandoned-lock repair, interrupted acceptance, and deterministic regeneration.
2. The real pinned inventory must account for every file, preserve MIT attribution and executable modes, and keep fixtures byte-identical except for explicit reviewed changes.
3. Pure runtime tests cover config parsing, full model IDs with slashes, thinking suffixes, invalid versions, cancellation, ordered repeated panels, branch-local mode reduction, effective parent selection, scoped/unscoped setup, persisted out-of-scope choices, and role use while mode is off with conflicting native agent overrides.
4. Real pi SDK tests load the packed package in isolated directories. A scripted provider captures actual prompts. Test mode activation, off, task arguments, custom wakes, resume, fork, tree navigation, reload, collision refusal, and config diagnostics.
5. Real CLI/RPC tests prove command dispatch and one-shot lifetime. Test both handled commands and actual agent turns. No ambient credentials or paid inference routes are present in the test process.
6. Load the requested dependency packages and demonstrate actual agent discovery, a native child, retained output, completion delivery, and a loop or monitor wake that causes a provider-visible follow-up. Keep these contract tests bounded and dispose timers, children, and sessions.
7. Test tarball contents and included maintenance commands. Advertised package scripts must not reference files excluded from publication. Offline checks are distinct from renderer, Java/TLC, forge, and optional live-model evaluation.
8. Adapter acceptance examples cover Shipping with missing independent product verification, required UI verification without a control tool, and an unavailable explicit reviewer. All remain blocked at their dependent action. Optional unavailable evidence remains labeled missing without invented coverage.
9. Fresh Muse Wonder and Sol 6.1 reviews must accept the implementation after fixes. Source-observed contracts and scripted-provider tests do not prove that arbitrary models follow every prose instruction. Report that limit.

## Delivery sequence

Build source accounting and generator checks first. Then implement adapter text and native runtime. Verify a packaged installation, run both reviews, fix concrete findings, and repeat until accepted. Do not publish, deploy, or open a remote PR without a configured repository and appropriate authority.

No-comments is not applicable to this design-only review because no implementation comments exist yet. It remains an implementation-review gate.
