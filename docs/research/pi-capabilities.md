# Pi capability findings

The goal is a maintainable full port of Cursor pstack using `npm:@trevonistrevon/pi-loop` and `npm:pi-subagents`. Users can retain the workflows, persistent mode, and native child sessions. Maintainers can keep Pi-specific behavior in a small extension and leave execution ownership with the two dependencies. This is a source-backed design assessment, not a runtime compatibility certification.

## Evidence locations and versions

The following roots make every abbreviated path below exact.

- `PI` is `/Users/asper/.pi/agent/install/releases/1.5.0/node_modules/@earendil-works/pi-coding-agent`.
- `LOOP` is `/Users/asper/.pi/agent/npm/node_modules/@trevonistrevon/pi-loop`.
- `SUB` is `/Users/asper/.pi/agent/npm/node_modules/pi-subagents`.
- `UPSTREAM` is `/Users/asper/source/pi-mstack/.cache/cursor-plugins/pstack`.

Installed manifests report Pi **1.5.0**, pi-loop **0.7.19**, and pi-subagents **0.86.0**. pi-loop requires Node `>=22.19.0`; its development Pi pins are 1.4.0. pi-subagents documents Pi 1.2.0 or newer and uses the host SDK, including for detached children. No separate SDK installation is required for ordinary use. Sources are each package's `package.json` and `SUB/README.md`.

`UPSTREAM/plugin.json` reports pstack 0.15.36. The parent supplied upstream commit `2776ddd2355d6d6c8747d3964600f28daf62f049`; I did not independently resolve that commit.

## Important compatibility boundary

**pi-loop's orchestration does not target the requested pi-subagents package.** `LOOP/docs/USAGE_GUIDE.md`, section "Async subagent orchestration", explicitly requires `@tintinweb/pi-subagents` protocol v2. Shipped `LOOP/dist/index.js:8088` requires `probe.version === 2`, and line 9026 probes `subagents:rpc:ping`. `LOOP/dist/rpc/channels.d.ts` identifies that package by name.

The requested `npm:pi-subagents` is Nico Bailon's package. `SUB/src/extension/rpc.js:17-20` serves protocol 1 on `subagents:rpc:v1:request`, with corresponding ready and reply channels. Searching its shipped JavaScript found no responder for pi-loop's channels. `LOOP/dist/rpc/cross-extension-rpc.d.ts` separately exports generic `PROTOCOL_VERSION = 3`; that is not its orchestration compatibility requirement.

Recommendation, inferred from these contracts: use pi-loop for `/loop`, ordinary controllers, native tasks, workflows where appropriate, and monitors. Use `subagent` for all child execution. Do not route ported delegation through `OrchestrationCreate`, pretend the packages share an RPC, or add an implicit compatibility bridge. Installing both does not establish interoperability for that feature.

## Package composition and discovery

Pi packages expose `pi.extensions`, `pi.skills`, `pi.prompts`, and `pi.themes`. Paths resolve from the package root. `resources_discover` can add skill, prompt, and theme paths after `session_start`; it cannot add agent definitions. Static bundled skills normally need only the manifest. Sources are `PI/docs/packages.md`, `PI/docs/extensions.md`, and `PI/examples/extensions/dynamic-resources/index.ts`.

The supported agent manifest is `"pi": { "subagents": { "agents": ["./agents"] } }`; `"pi-subagents": { "agents": ["./agents"] }` also works. pi-subagents owns this discovery, not Pi core. Definitions load above builtins and below user/project agents. Project trust controls project agents and package configuration. Source is `SUB/docs/agents.md`, confirmed in `SUB/src/agents/agents.js:264-392`. There is no need to copy bundled agents into `~/.pi/agent/agents` during installation.

Separate dependency installation is **a packaging choice, not a universal requirement**:

- A documented three-package installation is the simplest composition. Each dependency must be configured as a Pi package so its extension loads.
- Ordinary npm `dependencies` install JavaScript dependencies, but do not automatically activate their Pi resources. `PI/docs/packages.md`, section "Declare dependencies", documents composition through dependencies included in the published tarball and explicit `node_modules` resource paths. That route needs an isolated tarball-loading test.
- Independently installed Pi packages have separate module roots. One package cannot assume a runtime import of another independently installed package resolves. `SUB/docs/extension-api.md` explicitly recommends its event contracts for this case. Type-only development dependencies are optional.
- Host packages belong in `peerDependencies`, not runtime `dependencies`, and must not be bundled. Pi maps the `@earendil-works/*` host packages and legacy `@mariozechner/*` aliases to its own copies. Local package dependencies remain the developer's installation responsibility. Sources are `PI/docs/packages.md` and `PI/docs/extensions.md`.

## Persistent mode and skill aliases

Pi's native invocation is `/skill:name`. Skills advertise metadata and load full instructions on demand. `disable-model-invocation: true` hides automatic discovery but preserves explicit invocation. `allowed-tools` is experimental metadata, not proof of restricted execution. Native skill frontmatter has no alias field. Sources are `PI/docs/skills.md` and `PI/docs/extensions.md`.

A short `/how` or `/poteto-mode` alias needs an extension command, an input transformation, or a prompt template. Registered commands run before `input`; skill expansion runs after `input`. A command can send `/skill:name ...` with `pi.sendUserMessage(..., { expandPromptTemplates: true })`. Expansion defaults to false, and busy-session delivery requires deliberate steering or follow-up handling. Sources are `PI/docs/extensions.md` and the complete examples `input-transform.ts` and `send-user-message.ts` under `PI/examples/extensions/`.

Recommendation: make persistent mode explicit state, not a promise in a skill. Persist a versioned enabled/disabled entry with `pi.appendEntry()`. Reconstruct from `ctx.sessionManager.getBranch()` on `session_start` and `session_tree`. Include the disabled state so resume cannot resurrect an earlier enable. Add instructions through `before_agent_start` structured `systemPromptOptions.sections`, including runs started by background custom messages. Structured sections compose with pi-subagents' catalog and avoid whole-prompt replacement. Sources are `PI/docs/extensions.md`, sections "State Management", "before_agent_start", and "pi.appendEntry".

The full examples `pirate.ts`, `preset.ts`, and `plan-mode/index.ts` illustrate toggles and persistence. They are not drop-in production designs: pirate state is memory-only, and the latter examples restore from all entries rather than the active branch. Follow the documented branch-aware contract instead.

Native `/skill:poteto-mode` also needs an activation path if it promises persistent behavior. A mode extension can observe that raw input before native expansion. Toggling with no task can remain model-free. No Cursor-style Option+Enter custom-mode mechanism is documented in the inspected Pi APIs.

Collisions matter. Skill names keep the first discovered definition and warn. Duplicate extension commands receive numeric suffixes. Use `pi.getCommands()` and `sourceInfo` for provenance; do not silently bind an alias to another package's same-named skill. Sources are `PI/docs/skills.md` and `PI/docs/extensions.md`.

## Models and child launch contracts

Pi model selection and role routing are different configuration domains:

- Core startup settings use `defaultProvider`, `defaultModel`, and `defaultThinkingLevel`. `enabledModels` scopes startup and cycling. `models.json` defines provider catalogs and endpoints, not pstack roles. Sources are `PI/docs/settings.md`, `models.md`, and `models-configuration.md`.
- CLI and child launch selectors use `provider/model-id:thinking`. Preserve exact registry identifiers, including model IDs containing slashes. Do not translate Cursor slugs such as `claude-opus-5-5-xhigh` mechanically. Prefer exact available catalog values. Source is `PI/docs/cli.md` and `SUB/docs/models.md`.
- The current `subagent` tool dispatch ignores the standalone `thinking` field. Put effort in the `model` suffix. Agent frontmatter and settings may use `thinking`; the structured delegation API has its own supported thinking field. Sources are `SUB/docs/tool-reference.md`, `SUB/docs/extension-api.md`, and `SUB/src/extension/schemas.js:176,249`.
- Omission preserves configured resolution, which eventually falls back to the parent model. It does not force parent inheritance over operator overrides. `model: "inherit"` is documented for agent frontmatter and role overrides. Port-specific `inherit-parent` and `auto` must be normalized intentionally, not passed as model IDs. Source is `SUB/docs/models.md`.
- `subagents.agentOverrides.<name>` and provider-scoped overrides support role models. Per-run selectors have highest precedence. Workflow-specific panels can remain a port-owned role table because several pstack roles may use the same underlying agent. This last sentence is a design inference.
- `fast: true` means the native OpenAI-Codex priority service tier, not a generic Cursor fast mode. It may cost more and fails for unsupported providers. Source is `SUB/docs/models.md`.

The shipped public schema has no per-launch `tools` allowlist. Configure restrictions in agent frontmatter, supported settings, or an extension-owned capability ceiling. `acceptanceRole: read-only` changes acceptance inference, not permissions. A read-only sentence is not a sandbox; unrestricted `bash` can mutate files. Sources are `SUB/src/extension/schemas.js`, `SUB/docs/agents.md`, and `SUB/docs/extension-api.md`.

Fresh children default to narrow prompts. Explicit `skills`, `skillPath`, inheritance fields, and extension providers determine their resources. Naming an MCP tool does not load its provider. Foreground children do not inherit ambient extensions; background children normally do. Explicit extensions and capability ceilings can narrow this. Source is `SUB/docs/agents.md`.

## Native execution and continuity

Pi owns JSONL session trees, model history, compaction, forks, and resume. Extensions should use `SessionManager`, not invent transcript formats or search Cursor transcript directories. `getEntries()` includes abandoned branches; `getBranch()` follows active history. Commands have session-switch methods; ordinary tool/event contexts do not. Replacements tear down extensions and require fresh bindings. Sources are `PI/docs/sdk.md`, `sessions.md`, `session-format.md`, and `extensions.md`.

pi-subagents owns native foreground SDK sessions, detached SDK runners, result artifacts, control, and completion delivery. Its public event-bus RPC is async-only. Structured delegation is foreground-only. Current workflow composition uses `runs.run` and `runs.all`; ordinary top-level legacy `chain/tasks/parallel` calls are not the default API. Sources are `SUB/docs/extension-api.md` and `tool-reference.md`.

pi-loop persistence is not an always-on daemon. Ordinary buffered wakes and monitor handles are memory-only. Project scope has no scheduler owner election. Resume reconciles intent but does not prove exactly-once execution. Workflow completion deletes the controller; it is not an archival audit trail. Workflow terminal pauses also require trusted blocker admission, and there is no built-in user-authority provider. Sources are `LOOP/docs/RUNTIME_CONTINUITY.md`, `REFERENCE.md`, and `USAGE_GUIDE.md`.

A port should not create standalone tasks that mirror workflow phases. pi-loop explicitly assigns one owner to each goal. Native tasks suit independently completable backlog items; workflows suit ordered phases and conditional transitions. Source is `LOOP/docs/USAGE_GUIDE.md`.

## Real Pi tests without paid calls

Feasible, but not executed in this read-only investigation.

1. Load the actual port and installed dependency entry points with `DefaultResourceLoader` and `createAgentSession`. Use isolated `cwd`, `agentDir`, settings, credentials, and stores. Call `session.bindExtensions()` for startup/resource events. Inspect resource diagnostics and command provenance. Sources are `PI/docs/sdk.md`, `PI/dist/core/resource-loader.d.ts`, and `PI/examples/sdk/04-skills.ts`, `06-extensions.ts`, and `12-full-control.ts`.
2. Register a deterministic scripted provider through `pi.registerProvider` with custom `streamSimple`. Capture the actual normalized transcript and return valid assistant/tool-call events. This exercises real Pi orchestration without network inference. `PI/docs/custom-provider.md` specifies stream events and transcript helpers. `LOOP/docs/TESTING.md`, section "Native code mode", documents an existing real SDK scripted-provider suite that makes no remote calls.
3. Test mode on/off, ordinary next prompts, `/skill:` activation, arguments, custom-message wakes, reload, resume, fork, and tree navigation. Assert the actual provider-visible instructions and persisted branch state, not only registered callbacks. Include command collisions and unavailable skills/models.
4. Exercise genuine pi-subagents discovery and a native child with the scripted provider. For detached coverage, load a file-backed fixture provider explicitly in the child and keep the parent alive through completion delivery. Assert child session/artifact output and model/effort selection. This is a proposed integration test, not a demonstrated pass.
5. Run a separate CLI/RPC smoke against the real executable entry at `PI/dist/bundle/cli.js`. Isolate `PI_CODING_AGENT_DIR`, use `--offline`, disable ambient resources, and add only explicit test extensions/resources. Verify `get_commands`, `get_state`, `get_entries`, model selection, and command prompts. For prompts with disposition `handled`, do not wait for a nonexistent settle event. For actual runs, subscribe before prompting and wait for `agent_settled`, not `agent_end`. Sources are `PI/docs/cli.md`, `environment-variables.md`, `rpc.md`, `rpc-commands.md`, and `PI/examples/rpc-client.ts`.
6. Disable cache warming, automatic compaction, retries, and unneeded discovery/network activity in deterministic tests. Remove real provider credentials from the test process. `--offline` disables automatic network activity; it is not a sandbox or a prohibition on explicit provider calls. Bound requests and clean up sessions, timers, and children. Sources are `PI/docs/settings.md`, `cli.md`, and `custom-provider.md`.

Scripted tests prove API behavior, not whether a model follows the ported prose. A separate optional live-model evaluation is still needed for routing quality and judgment.

## Cursor capabilities without a direct equivalent

`UPSTREAM/README.md` explicitly identifies Cursor custom modes, Cursor Automations/Benny, Bugbot, and Cursor-provided skills/tooling. The inspected Pi core and these dependencies do not provide direct equivalents for the Cursor cloud automation service, Bugbot service, Cursor editor context, or Cursor custom-mode gesture. pi-loop is an active-process scheduler, not a substitute cloud service.

`deslop`, `control-cli`, and `control-ui` are external Cursor team-kit resources, not bundled pstack capabilities. Pi's inspected APIs do not establish that these exist. Browser/UI verification needs a separately installed provider or project verification tooling. Preserve a clear unavailable-capability branch instead of claiming parity. Sources are `UPSTREAM/README.md` and the Pi extension/tool documentation above.

## Verification and handoff

I read `extensions.md`, `skills.md`, `sdk.md`, the supporting Pi docs cited above, and the named examples in full. I read both dependency manifests and their relevant packaged documentation, then checked shipped source/declarations for agent discovery, RPC channels, orchestration gating, model arguments, and tool restrictions. No packages were installed, no agents were spawned, no upstream code was executed, and no product files were changed. Only this requested report was written.

No runtime checks were run. Installation composition, fresh-environment dependency loading, persistent-mode behavior, and child execution remain unverified until the proposed tests run.

Principles applied: **Prove It Works** changed the interoperability claim from a README assumption to a check of shipped channels and guards. **Type System Discipline** changed the API recommendations to follow published declarations and schemas rather than guessed parameter shapes.
