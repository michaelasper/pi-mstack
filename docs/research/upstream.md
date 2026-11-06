# Pstack port architectural grounding

## Overview

The goal is a maintainable full port of Cursor pstack to Pi, with reproducible upstream updates, `npm:@trevonistrevon/pi-loop` for loops, and `npm:pi-subagents` for delegation. Users should retain pstack's engineering workflows without being told that Pi implements Cursor services it does not have. Maintainers need an accounting of upstream resources and explicit, testable adaptations.

This report is read-only architectural grounding, not an approved implementation design. No child agents or bundled executables were launched. No repository files were edited. The report artifact is the only file written.

Throughput checkpoint: n/a, read-only investigation.

Evidence roots used below:

- `U` is `/Users/asper/source/pi-mstack/.cache/cursor-plugins/pstack`, pinned at `2776ddd2355d6d6c8747d3964600f28daf62f049`.
- `P` is `/Users/asper/.pi/agent/npm/node_modules/@zenspc/pi-pstack`, installed version `0.9.0`.
- `L` is `/Users/asper/.pi/agent/npm/node_modules/@trevonistrevon/pi-loop`, installed version `0.7.19`.
- `S` is `/Users/asper/.pi/agent/npm/node_modules/pi-subagents`, installed version `0.86.0`.
- `H` is `/Users/asper/.pi/agent/install/releases/1.5.0/node_modules/@earendil-works/pi-coding-agent`, the managed Pi installation selected by `install/current-version`.

`U/.cursor-plugin/plugin.json` and `U/plugin.json` both declare pstack `0.15.36`. The installed port's README records the same version but a different commit, `c742dd61706fbacc1b95f1a20b7b988cf096ce6c`. Matching version strings do not establish matching content.

The repository had no `HEAD` at initial inspection, confirmed by `git rev-parse --verify HEAD`. Other work changed its untracked files during this investigation. This report does not claim that the shared repository stayed unchanged, only that this investigator did not edit it.

Pstack is primarily an executable engineering policy expressed in Markdown. Its main runtime is the host agent interpreting skills, selecting playbooks, and calling host tools. It also includes substantial runnable software, especially the statechart verifier. A port cannot be reduced to slash-command renaming.

## Key Concepts

### Skills, playbooks, and principles have different roles

`U/skills/poteto-mode/SKILL.md` is the entry point and routing policy. The receiving chat owns the playbook and delegates individual steps. The 23 playbooks live beneath that skill rather than registering as separate skills. The 24 principle skills are leaf rules that other workflows read when applicable.

There are 58 top-level skills, but 61 `SKILL.md` files across the complete plugin. The extra three belong to the dormant Benny automation pack. They must not accidentally become ordinary discoverable slash skills. `U/automations/benny/README.md` and `FOR_AGENTS.md` explicitly preserve that distinction.

Visibility is part of behavior. At the pinned upstream revision, 57 of the 58 top-level skills have `disable-model-invocation: true`. Only `setup-pstack` lacks that flag. The reference port changes that policy to four discoverable skills, `how`, `why`, `unslop`, and `typescript-best-practices`, with 54 hidden skills. These counts come from the actual frontmatter, not the README alone.

### Policy is not enforcement

A request for read-only work, a role name, and a restricted tool definition are separate controls. A child with Bash can still mutate files. This run's API does not support a per-call tools allowlist, so read-only behavior here is an explicit instruction, not a claimed sandbox.

`S/docs/agents.md` puts tool selection and extension loading in agent definitions. `S/docs/tool-reference.md` distinguishes acceptance roles from tool access. A `worker` is a writer by default. Setting acceptance to none changes evidence requirements, not filesystem permissions.

The reference port's `P/skills/poteto-mode/references/pi-delegation.md` recommends `options.tools` and workflow-child tools overrides. That advice must not be copied into a runtime where the schema does not accept them.

### Model selection is runtime configuration

Cursor uses model slugs and a global `.mdc` rule. `U/skills/setup-pstack/SKILL.md` writes `~/.cursor/rules/pstack-models.mdc`; its defaults include Grok and Opus models with effort and speed suffixes.

The Pi reference has a typed configuration boundary in `P/extensions/pstack/config.ts`. It defines 17 roles, four list-valued roles, versioned JSON, safe selector parsing, partial-load diagnostics, atomic file replacement, and legacy Markdown migration. Its default is parent-model inheritance, not Cursor's model mix. Configuration lives beneath `PI_CODING_AGENT_DIR`, or `~/.pi/agent`, at `pstack/models.json`.

A repeated parent model is multiple samples, not a multi-model panel. Different reasoning suffixes also do not establish different model families. `P/README.md` and `formatPanelStatus` explicitly disclose that distinction.

### Scheduling, delegation, and workflow policy have separate owners

The requested dependencies already own scheduling and child execution. `L/README.md` documents `/loop`, `LoopCreate`, `LoopList`, `LoopUpdate`, `LoopDelete`, and command monitors. `S/docs/tool-reference.md` documents async children, workflow scripts, models, retained runs, worktrees, and control messages.

A pstack adapter should translate workflow intent to those contracts rather than create another scheduler or child-process manager. This is an architectural recommendation, not a decision to adopt pi-loop's optional task or orchestration subsystems. Those optional features overlap with other possible workflow owners and need deliberate selection.

## How It Works

### Upstream execution flow

1. Cursor discovers skills and the two agents through `U/.cursor-plugin/plugin.json`.
2. The user invokes `poteto-mode`, optionally as a persistent Cursor Custom Mode. The skill chooses a playbook and opens its steps as a todo list.
3. Workflow steps read relevant skills and principle leaves. Design and review workflows may fan out across model roles.
4. The parent invokes Cursor `Task`, with fields such as `subagent_type`, `model`, `run_in_background`, and sometimes cloud environment controls. A `poteto-agent` reads the full mode skill before its assigned work.
5. Verification uses project tooling, the bundled scripts, or external control skills. PR workflows use GitHub CLI by default and Origin when available.
6. Long-running playbooks use Cursor `/loop` and watcher completion to resume work. They record decisions and require evidence before reporting success.

Evidence is in `U/skills/poteto-mode/SKILL.md`, its `autonomous-run.md`, `babysit.md`, `orchestrate.md`, and `shipping.md` playbooks, and `U/agents/poteto-agent.md`.

### Existing Pi port execution flow

The installed port is a useful reference with real implementation, not just rewritten prose.

`P/package.json` exposes one extension entry point, the skills directory, and two pi-subagents agent definitions. `P/extensions/pstack/index.ts` registers `/poteto-mode`, `/setup-pstack`, and `/pstack`.

Sticky mode is a session event rather than a rewritten copy of every prompt. The extension appends `pstack-mode` entries, restores state from the active session branch, and adds a small instruction containing the absolute skill path. It restores on session start and tree navigation. The instruction tells the model to reload the skill after compaction when necessary.

`before_agent_start` changes the structured prompt options. It inserts a `pstack` section and can filter this package's skills out of the catalog. `/pstack off` hides catalog entries but does not revoke explicit skill invocation. `/poteto-mode off` is a separate session-mode control.

`/setup-pstack` queries scoped or available models and offers supported thinking levels. It refuses to overwrite invalid or partially rejected configuration. Default scalar inheritance inserts no role table. The extension does not itself dispatch delegates. The skills interpret the injected role table and invoke pi-subagents.

These are source-observed capabilities, not live-test results. The managed Pi 1.5.0 declarations in `H/dist/core/extensions/types.d.ts` include `before_agent_start`, `systemPromptOptions`, `session_tree`, and `sendUserMessage`. The installed reference README targets Pi 1.4.0 and warns that stock one-shot forwarding can exit before `/poteto-mode <task>` finishes. A new package still needs real TUI, RPC, print, and JSON validation against its declared host version.

### Classification of the porting work

Here, supported means that an inspected package or resource supplies the mechanism. It does not mean this investigation executed it. Adaptable means the workflow can use Pi mechanisms with explicit changes. Missing means that no equivalent was established in the required dependencies.

| Capability | Classification | Evidence and boundary |
| --- | --- | --- |
| Principle text, writing standards, TDD, benchmark guidance | Supported as resources | `U/skills/principle-*`, `unslop`, `technical-writing`, `tdd`, and `benchmark-checklist` are primarily instructions. Runtime verification still depends on the target project. |
| Skill discovery and explicit commands | Adaptable | `P/package.json` and skill frontmatter demonstrate Pi registration. `/skill:<name>` replaces ordinary Cursor skill command syntax. Visibility changes must be intentional. |
| Sticky Poteto Mode | Adaptable | `P/extensions/pstack/index.ts` implements branch-aware session state. This is not the Cursor Custom Modes UI. |
| Setup and per-role models | Adaptable | `P/extensions/pstack/config.ts` provides a usable boundary. Preserve panel order, inheritance, unavailable-model errors, and actual-run attribution. |
| Async delegation and panels | Supported mechanism, adaptable policy | `S/docs/tool-reference.md` supports direct runs and workflow scripts. Cursor Task fields are not valid Pi arguments. |
| Cloud isolation | Missing parity | Pi worktrees isolate source changes, not a fresh VM, credentials, processes, or network. Cursor cloud dashboards and URLs have no established equivalent here. |
| Recurring and dynamic loops | Supported mechanism, adaptable policy | `L/README.md` provides real wake tools. The reference port instead documents a generic scheduler prerequisite. |
| Restart-proof unattended execution | Missing guarantee | `L/docs/RUNTIME_CONTINUITY.md` says Pi must remain active and separates persisted intent from delivery and execution. |
| GitHub PR watching | Supported executable with dependencies | `U/skills/poteto-mode/scripts/watch-pr` reads GitHub through `gh`. Completion delivery to Pi still needs a monitor or child. |
| Origin PR workflows | Adaptable, optional | `babysit.md` and `shipping.md` have an Origin branch. The bundled watcher remains GitHub-specific. |
| Bugbot comments | Adaptable | Existing forge comments are ordinary evidence. Starting, configuring, or promising a Bugbot review requires the external service. |
| UI and CLI verification | Adaptable, externally supplied | `control-ui` and `control-cli` are in `cursor-team-kit`, not pstack. Project verification tools can replace them only with real checks. |
| MCP-backed research | Adaptable, conditional | `why` discovers source integrations. Pi children need explicit tools and loaded providers. Missing sources remain gaps. |
| Transcript recall and session pickup | Adaptable | Use exact Pi session and retained-run records, verify workspace and branch, and avoid global private-history scans. |
| Formal model checking and statecharts | Supported executable with dependencies | The complete compiler, runner, fixtures, and tests are bundled under `statechart/scripts`. |
| Video catch-up | Adaptable with a presentation gap | `ketchup-video` specifies rendering and inspection but ships no renderer. Pi video embedding parity was not established. |
| Benny automations | Missing runtime parity | Slack triggers, Cursor Automations, project-scoped setup, tracker access, and control adapters are external requirements. Preserve and account for its source pack. |
| Bot UI routines and secret requests | Missing runtime parity | `make-bot-ui` uses Cursor `update_state`, `SendToUser`, webhook routines, and secret storage. pi-loop is not a replacement for those services. |
| Deterministic upstream import | Missing in the new repo at grounding time | The installed reference advertises an importer but does not publish it in its npm artifact. |

## Where Things Live

### Complete upstream resource inventory

The pinned Git tree contains 573 files under `pstack/`. A filesystem traversal independently produced the same total. There are no separate pstack hooks, rules directories, MCP server manifests, or executable extension entry points in that tree. Those capabilities are host facilities or described dependencies.

| Resource kind | Count | Evidence |
| --- | ---: | --- |
| Top-level skill definitions | 58 | `U/skills/*/SKILL.md`, including 24 principle leaves and 34 other skills. |
| Playbooks | 23 | `U/skills/poteto-mode/playbooks/*.md`. |
| Skill reference resources | 30 | `U/skills/*/references/**`, including prompt templates, source investigation playbooks, render guidance, and a TSV decision-log template. |
| Script-tree resources | 424 | 18 under `poteto-mode/scripts`, one under `show-me-your-work/scripts`, and 405 under `statechart/scripts`. This includes code, tests, manifests, locks, and recorded fixtures. |
| Agent definitions | 2 | `U/agents/poteto-agent.md` and `comment-sicko.md`. |
| Documentation | 18 | Eleven guide Markdown files, six guide JPEGs, and `docs/harness/claude-code.md`. |
| Dormant Benny pack | 12 | Two entry documents, three skill definitions, four references, two automation prompt templates, and one YAML configuration template. |
| Plugin manifests | 2 | `.cursor-plugin/plugin.json` and `plugin.json`. |
| Branding asset | 1 | `assets/logo.png`. |
| Root support files | 3 | `README.md`, `LICENSE`, and `.gitignore`. |
| Total | 573 | The four skill-related rows sum to 535 files. |

The 34 non-principle skills are `architect`, `arena`, `automate-me`, `benchmark-checklist`, `blast-radius`, `bro`, `correct`, `create-formal-verification-skill`, `create-verification-skill`, `figure-it-out`, `how`, `in-your-own-words`, `interrogate`, `ketchup`, `ketchup-video`, `maintain-formal-verification-skill`, `maintain-verification-skill`, `make-bot-ui`, `no-comments`, `poteto-help`, `poteto-mode`, `recall`, `reflect`, `setup-pstack`, `sharpen`, `show-me-your-work`, `statechart`, `swarm`, `tdd`, `teach`, `technical-writing`, `typescript-best-practices`, `unslop`, and `why`.

The script-tree bulk matters. `statechart/scripts/test` contains 376 files, including 356 corpus files in 33 model directories. The whole plugin has 39 TLA files, 34 CFG files, 36 Mermaid files, 33 DOT files, 134 OUT files, and 44 EXIT files. These are verification fixtures and expected results, not disposable generated clutter. There are 14 `*.test.ts` files upstream.

### Executable integrations

Git records six executable files. Their presence and modes are part of the import contract.

| Entry point | Behavior and dependencies |
| --- | --- |
| `skills/poteto-mode/scripts/check-plan.mjs` | Node CLI that validates a specific program-plan structure and prose rules. It is not a generic validator for every file named plan.md. |
| `skills/poteto-mode/scripts/watch-pr/watch-pr` | Bun launcher for the GitHub PR watcher. `bootstrap.ts` hashes package metadata and the Bun lock, installs dependencies when necessary, and restarts the process. |
| `skills/poteto-mode/scripts/worktree-audit.sh` | Bash inventory using Git, `gh` or Origin, `jq`, `rg`, and system utilities. It fetches refs and writes temporary files despite its read-only description. |
| `skills/show-me-your-work/scripts/log.sh` | Bash CLI that creates or appends a TSV decision log and neutralizes spreadsheet-formula prefixes. |
| `skills/statechart/scripts/statechart` | POSIX launcher selecting Node 22.18 through 22.x, Node 23.6 or newer, Bun 1.1.5 or newer, or Deno 2 or newer. |
| `skills/statechart/scripts/test/java.ts` | Test support executable for the Java/TLC verification path, not an end-user workflow command. |

Statechart also runs non-executable-marked TypeScript modules and dynamically imports view modules. `statechart.ts` stages output and supervises a detached worker. `run.ts` finds or installs TLC 1.7.4 with a pinned SHA-256 and Java `temurin-25` through mise, unless `TLA2TOOLS` and optional `JAVA` are supplied. `frontends`, `passes`, `ir.ts`, and `backends` implement parsing, graph transformations, Mermaid output, and reports. Views execute local code and must be trusted.

### External dependencies

Dependencies fall into distinct groups.

- The Pi host and the two requested packages provide runtime APIs. `L/package.json` requires Node at least 22.19.0 and Pi, TUI, and TypeBox peers. `S/package.json` declares Pi-related peers and runtime dependencies on `@js-temporal/polyfill`, `acorn`, `jiti`, `undici`, and `yaml`.
- `U/skills/poteto-mode/scripts/package.json` pins `commander` 14.0.0 and uses Bun plus TypeScript tooling. Its `bun.lock` is included. Bootstrap installation currently lacks `--ignore-scripts`.
- Statechart requires an appropriate JS runtime, a Java/TLC installation or mise and network access, and POSIX process utilities. Its development manifest pins `fast-check` 4.5.3. Upstream has no statechart lockfile at this revision.
- `statechart/scripts/test/render.test.ts` installs `pele@1.9.0`, `mermaid@11.16.0`, and `jsdom@26.1.0` into the user cache. Upstream's installation command permits lifecycle scripts. The reference port adds `--ignore-scripts`, an offline test runner, a pnpm lockfile, and explicit TypeScript development dependencies.
- Forge workflows need authenticated Git and GitHub CLI, or optional Origin. Graphite is explicitly not required in `babysit.md`.
- `why/references/sources` documents code archaeology, Linear, Notion, Slack, Datadog, Sentry, Databricks, and incident-postmortem evidence. These are optional integration categories, not installed pstack dependencies.
- `cursor-team-kit` supplies `deslop`, `control-cli`, and `control-ui`. Cursor supplies `/create-skill`, `/loop`, Custom Modes, cloud agents, and automation services. The port must distinguish missing tools from unavailable credentials.
- Benny needs Slack thread access, a tracker adapter, a control adapter, a feature map, a repository, and external trigger execution. `make-bot-ui` additionally depends on Cursor secret requests and routine webhooks, a local HTTP server, and Tailscale. Its instructions include privileged Tailscale installation, which is not part of safe package loading.
- Video rendering is intentionally unspecified by `ketchup-video`; a renderer and a usable user-facing presentation path remain environment requirements.

No installation, network fetch, Git fetch, watcher, Java check, renderer test, or model call was performed in this investigation.

### Existing-port coverage and reuse risks

A relative-path and byte comparison gives the following measured result.

| Comparison | Count |
| --- | ---: |
| Upstream files | 573 |
| Installed port files | 547 |
| Common paths | 537 |
| Byte-identical common files | 477 |
| Different common files | 60 |
| Upstream-only paths | 36 |
| Port-only paths | 10 |

The 36 upstream-only paths are the 18 docs, 12 Benny files, two manifests, `.gitignore`, the logo, `make-bot-ui/SKILL.md`, and `check-plan.test.ts`. The last test is replaced by `check-plan.test.mjs` in the port, so it is not simply lost coverage.

The ten port-only paths are two extension source files, `package.json`, `deslop/SKILL.md`, three Pi reference documents, the renamed plan test, the statechart pnpm lockfile, and `test-offline.mjs`.

Thus both trees report 58 skills while shipping different skill sets. The port adds `deslop` and drops `make-bot-ui`. All 24 principles and all 23 playbooks are present. Its 547 files are not a complete import of the 573-file pinned upstream tree.

The npm artifact excludes its advertised `scripts/reground-from-cursor.mjs`, importer tests, extension tests, monorepo CI, and `docs/patches` verification evidence. `P/README.md` describes these, but they cannot be audited from this installed artifact. The package's top-level test command references absent paths. Do not describe those tests as passing or copy the package as if it includes a maintainable update pipeline.

A concrete unsafe reuse is `P/skills/poteto-mode/scripts/worktree-audit.sh`. Lines 18, 26, and 66 respectively fetch `origin/main`, select the entire `~/.pi/agent/sessions` tree, and recursively search it for worktree paths. This contradicts the workspace-scoped privacy rules in `P/skills/poteto-mode/references/pi-runtime.md`. It also retains BSD-specific `stat` and `date` assumptions. Pinned upstream now supports an explicit base, discovers default branches, handles GNU/BSD utilities, and has an Origin path. Preserving the older Pi fork wholesale would lose those upstream improvements.

Other reuse requires judgment. The sticky-mode implementation, typed configuration boundary, statechart compatibility correction, and renderer installation hardening are useful candidates. Default model policy, discoverability changes, plan-checker forks, and omitted functionality are product choices, not automatic correctness improvements.

## Gotchas

### Full accounting is achievable; full Cursor service parity is not established

The plan's done predicate is the right interpretation of full port. Every pinned resource needs an import, explicit adaptation, or documented gap. Unsupported resources can remain preserved and clearly marked without registering broken commands. Dropping Benny, docs, assets, and bot UI because the existing port omitted them would fail that predicate.

The upstream repository already provides a useful synchronization precedent. `scripts/generate-pstack-harness-trees.mjs`, read through `git show` because the checkout is sparse, generates the Claude Code tree from source. It classifies Cursor terms, checks adapter coverage, preserves executable bits, rewrites selected links, and has a `--check` drift mode. `scripts/check-pstack-docs.mjs` validates documented names, links, counts, and models. `.github/workflows/validate-plugins.yml` checks generated trees and script tests.

These scripts sit outside `pstack/` and will be missed by a folder-only copy. Their design is informative, but their Claude Code omissions and skip semantics are not the Pi port's approved policy.

### Required maintenance contract

The following is a recommendation for the design phase, not an implemented system.

1. Pin the source repository, full commit, and plugin subtree. Record every tracked path, content hash, executable mode, and disposition. Version text alone is insufficient.
2. Keep upstream bytes distinguishable from Pi adaptations. Generate repetitive edits and fail when an expected source anchor changes. Do not silently overwrite local forks or rewrite executable fixtures as prose.
3. Account for added, changed, removed, and renamed upstream files. New resource kinds should fail review rather than disappear through a glob.
4. Regenerate deterministically and compare a second run byte-for-byte. Preserve executable modes and validate local links and frontmatter names.
5. Check for unresolved Cursor tool names, model slugs, paths, service calls, and command references. Allow intentional mentions in historical docs or explicit gap records rather than applying global replacement.
6. Pin compatible Pi, pi-loop, and pi-subagents contracts and test the packaged artifact, not only source directories. Confirm skill and agent discovery, command collisions, host-mode forwarding, session-tree restoration, and invalid-config behavior.
7. Verify loop delivery and cancellation in an active Pi session. Record controller IDs, lifetime, stop conditions, and recovery limits. Monitor output alone does not prove that the agent was reawakened.
8. Validate delegation with real model selection, async completion, retained reports, explicit tool-provider loading, and intended acceptance policy. Worktree launches need a commit; the repository initially has none.
9. Keep offline corpus tests separate from network-dependent renderer and live TLC tests. Test both success and failure paths without treating unavailable external services as a pass.
10. Reconcile protocol and privacy rules with executable scripts on each sync. The worktree-audit contradiction demonstrates why prose-only review is insufficient.

### pi-loop continuity limits are part of the user contract

`L/docs/RUNTIME_CONTINUITY.md` explicitly states that persisted intent does not execute while Pi is absent. Ordinary pending wake notifications and monitor handles/output are process-local. Event subscriptions need recovery handling. Shared project storage does not provide scheduler owner election. Some orchestration attention intent is durable, but delivery can be at-least-once and does not prove work occurred.

A port can promise supported loops while the required runtime remains active. It cannot infer an always-on daemon, exactly-once side effects, monitor reattachment, or safe automatic replay after a crash.

### Licensing and attribution

`U/LICENSE` is MIT, copyright 2026 Lauren Tan. `P/LICENSE` retains the same notice. Both upstream manifests and the reference package declare MIT. The notice and permission text must accompany copies or substantial portions, including imported documentation and scripts.

`L/package.json` and `S/package.json` also declare MIT. Their dependencies, fetched renderers, Java distribution, and TLC distribution have separate license and redistribution considerations. This investigation inspected manifests, not a complete transitive-license inventory. Installing a tool at runtime and bundling its binary are different distribution choices. The upstream logo and guide images have no separate license file in the inspected pstack tree; preserve provenance and do not infer a trademark grant from the MIT code license.

If reference-port code is reused, record its source version and provenance as well as preserving its supplied license. Its differing defaults and private compatibility patches must remain reviewable rather than being presented as upstream behavior.

### Verification boundary and next step

The Prove It Works principle shaped this report by separating source-observed mechanisms from executed behavior. Its leaf skill was read in full. The report does not claim runtime parity, passing tests, scheduler delivery, or model availability. The Principles index, `how`, Investigation, `unslop`, and `technical-writing` instructions were also read. The task's no-delegation requirement took precedence over `how`'s usual explorer fan-out.

Inventory checks used `git rev-parse`, `git ls-tree -r HEAD pstack`, filesystem traversal, exact byte comparisons, executable-mode inspection, and direct source reads. Counts can be reproduced with `Path.rglob` grouped by relative directory and suffix, and `git ls-tree` supplies the tracked-file and mode authority. Bundled tests were intentionally not run because several install packages, write outputs, fetch refs, or launch processes.

The next step is to compare the plan's two design candidates using this inventory, then obtain the named reviews before implementation. The key decision is how to preserve upstream source while expressing a small, explicit Pi adaptation layer. The installed port is a source of candidate implementations and failure examples, not a parity baseline.
