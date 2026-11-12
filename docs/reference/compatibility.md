# Compatibility and capability limits

## Versions

| Component | Contract |
| --- | --- |
| Node.js | Minimum 22.19.0. CI covers 22.19.0, 24, and 26 on Ubuntu 24.04, plus 26 on macOS 15. |
| Pi | Tested with 1.5.0. |
| pi-loop | Tested with `@trevonistrevon/pi-loop` 0.7.19. Scheduling and monitors require an active host. |
| pi-subagents | Tested with `pi-subagents` 0.86.0. Native preflight controls launch eligibility. |
| Upstream pstack | Version 0.15.36 at commit `2776ddd2355d6d6c8747d3964600f28daf62f049`. |
| Package distribution | Published npm package (recommended) and public GitHub source. Multiline mode prompts and saved mode defaults require version 0.2.0 or later. Release automation requires explicit dispatch and account setup. |

The contract suite requires Git, tar, Python 3, and a POSIX terminal. The CI matrix runs on Ubuntu and macOS; consult the commit’s Actions results for pass/fail evidence. Windows and other dependency combinations are unverified.

## Port coverage

The manifest accounts for all 573 pinned upstream source records. The generated package exposes 58 top-level skill names, including an explicit unsupported notice for the bot workflow. Six executable source files preserve executable status. Benny automation remains snapshot-only.

| Capability | Status |
| --- | --- |
| Branch-local mode and standalone skills | Implemented and covered through packed host tests. |
| Exact role models and ordered panels | Implemented; availability and native policy remain separate checks. |
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
