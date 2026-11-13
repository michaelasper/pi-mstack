# Compatibility and capability limits

## Versions

| Component | Contract |
| --- | --- |
| Node.js | Minimum 22.19.0. CI covers 22.19.0, 24, and 26 on Ubuntu 24.04, plus 26 on macOS 15. |
| Pi | Pinned SDK and full suite on 1.5.0. Additional goal, naming, mode, PTY, context, native-child subprocess, local-agent, and grounding checks on installed 1.5.2. The independent grounding matrix also covers both actual CLI and child SDK roots on 1.5.2. Other SDK 1.5.2 checks are not covered. |
| pi-loop | Tested with `@trevonistrevon/pi-loop` 0.7.19. Scheduling and monitors require an active host. |
| pi-subagents | Tested with `pi-subagents` 0.88.1. Native preflight controls launch eligibility. |
| Local agents | `pstack-local-explorer` and `pstack-local-worker` are covered by the native matrix on installed packages. Defaults are not enforced grants. See [local agent limits](local-agents.md). |
| Upstream pstack | Version 0.15.36 at commit `2776ddd2355d6d6c8747d3964600f28daf62f049`. |
| Package distribution | Published npm package (recommended) and public GitHub source. Multiline mode prompts and saved mode defaults require version 0.2.0 or later. Release automation requires explicit dispatch and account setup. |

The contract suite requires Git, tar, Python 3, and a POSIX terminal. The CI matrix runs on Ubuntu and macOS; consult the commit’s Actions results for pass/fail evidence. Windows and other dependency combinations are unverified.

## Port coverage

The manifest accounts for all 573 pinned upstream source records. The generated package exposes 58 top-level skill names, including an explicit unsupported notice for the bot workflow. Six executable source files preserve executable status. Benny automation remains snapshot-only.

| Capability | Status |
| --- | --- |
| Branch-local mode and standalone skills | Implemented and covered through packed host tests. |
| Branch goals and deterministic names | Packed SDK, RPC and PTY coverage. Naming uses local parsing, not Jira or model calls. |
| Glossary, local memory and MCP retrieval | Bundled context extension with native dispatch. See [privacy limits](environment.md#retrieval-and-privacy). |
| Exact role models and ordered panels | Implemented; availability and native policy remain separate checks. |
| Repository grounding | Named resource with native acceptance and bounded sourced reports. See [limits and overrides](grounding.md). |
| Local explorer and worker defaults | Packaged agents with native discovery, foreground, background, workflow, override, context, and mutation coverage. See [defaults and limits](local-agents.md). |
| Native child execution and retained output | Delegated to pi-subagents and exercised by contract tests. |
| Scheduling and monitor wakes | Delegated to pi-loop and exercised with mode off; enabled-mode custom wakes have separate SDK coverage. |
| Skill authoring | Pi-native instructions and discoverable destinations. Prose regressions do not establish arbitrary-model authoring quality. |
| Current-session acquisition | Tested through Pi's local shell API. Overridden or remote shells may need an exact authorised path. |
| Cross-chat recall | Requires an authorised corpus of exact session paths. No implicit global history scan. |
| Cursor cloud VMs and always-on automation | Not provided. Worktrees are not cloud isolation. |
| Benny, bot webhooks, and secret services | Not provided by this port. |
| Bugbot service, editor selection, video rendering | No equivalent service is supplied. |
| External control tools, renderer, Java/TLC, and forge integrations | Not established by the port's contract suite. |

Missing capabilities do not satisfy mandatory workflow gates. A required independent verification, reviewer, UI control, or diversity requirement remains blocked until supported by appropriate evidence.

## Evidence limits

Scripted providers prove host dispatch, state, tool results, and prompt visibility. They do not prove that every model follows every workflow instruction. Lexical checks detect known adaptation defects, not complete semantic equivalence. See [verification](../verification.md) for the individual contracts and reproducible commands.
