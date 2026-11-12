# pi-mstack

**Bring pstack’s task playbooks to Pi—without replacing its native agents or scheduling.**

[![npm][npm-badge]][npm-url] [![CI][ci-badge]][ci-url] [![MIT licence][licence-badge]](LICENSE)

[Quick start](#quick-start) · [Documentation](docs/index.md) · [Changelog](CHANGELOG.md) · [Report an issue](https://github.com/michaelasper/pi-mstack/issues)

## Why pi-mstack?

If you use Cursor pstack’s review and implementation workflows but work in Pi, this package brings those playbooks into your existing environment. Use a skill for one task, or enable Poteto Mode to keep the playbook active for a session branch.

- Access 58 upstream skill names, including an explicit unsupported notice for the bot workflow.
- Keep mode branch-local, send multiline tasks, and save your preferred default.
- Choose exact authenticated models and ordered review panels instead of Cursor model aliases.
- Diagnose missing capabilities and blocked model choices before relying on them.
- Inspect the pinned upstream source and reproduce reviewed updates.

This is not Cursor cloud agents, Benny automation, Bugbot, or a substitute for required product verification. Native agents and scheduling come from the separately installed extensions below.

## Install

Requires **Node.js 22.19 or later** and **Pi 1.5.0**. Install from npm through Pi’s package manager:

```sh
pi install npm:@trevonistrevon/pi-loop@0.7.19
pi install npm:pi-subagents@0.87.0
pi install npm:pi-mstack
```

Restart Pi after installation. Disable competing pstack ports first; conflicting mode or setup resources block activation rather than silently choosing a package.

See [installation and updates](docs/how-to/install.md) for version pinning, checkout installation, and troubleshooting, or [compatibility](docs/reference/compatibility.md) for tested combinations.

## Quick start

In Pi, run `/pstack doctor` to check that the extension loaded. Then choose your next step:

| Goal | Command |
| --- | --- |
| Configure role models and review panels | `/setup-pstack` |
| Start a task under the playbook | `/skill:poteto-mode Fix the parser bug and prove the regression.` |
| Use a standalone skill | `/skill:how Explain this parser` |

Setup asks for confirmation before saving. Task and skill requests use your configured model and may incur provider charges. For a no-inference walkthrough, follow [your first Pi session](docs/tutorials/first-session.md).

## Usage

Bare `/poteto-mode` enables persistent mode without sending a model request. `/poteto-mode off` disables it for the active branch. Forks inherit their ancestors’ mode choices.

To enable mode and start a task, put the task on the same line or a new line. For example:

```text
/poteto-mode
Fix the parser bug and prove the regression.
```

Only the canonical `/poteto-mode` route is owned. The accidental `/potete-mode` alias is removed. These routes work in TUI, RPC, print, and JSON modes. If Pi is busy, the request is refused without changing mode or queuing the task; retry after settlement.

Use `/pstack default on` or `/pstack default off` to save the default; `/pstack default` shows it. Sessions and branches without an explicit choice follow that preference. An explicit `/poteto-mode off` always overrides a default of on.

Use `/goal <text>` to set branch intent without inference, `/goal` to show it, or `/goal --clear` to clear it. The first accepted task or goal names a never-named session locally, preferring a single Jira-style identifier. Existing names and explicit clears are preserved.

Configure terminology, local memory, and native MCP retrieval in the separate `pstack/environment.json`. See [goals, naming and context](docs/reference/environment.md) for the schema and privacy limits, and [configure child context tools](docs/how-to/configure-context.md) for native tool selection. Context never grants authority.

## Documentation

Choose the kind of help you need:

| Need | Start here |
| --- | --- |
| **Tutorial** — learn by doing | [Your first Pi session](docs/tutorials/first-session.md) |
| **How-to** — complete a task | [Install or update](docs/how-to/install.md) · [Configure models](docs/how-to/configure-models.md) |
| **Reference** — look up facts | [Commands and configuration](docs/configuration.md) · [Compatibility](docs/reference/compatibility.md) |
| **Explanation** — understand the design | [Source, adaptation, and execution](docs/explanation/architecture.md) |

Configuration lives in `pstack/models.json` under Pi’s agent directory, normally `~/.pi/agent`. Missing configuration inherits the exact current parent model; invalid explicit choices remain blockers. Native preflight remains authoritative, worktrees are not cloud sandboxes, and pi-loop needs an active host.

The [documentation index](docs/index.md) also covers maintenance, verification, and releases. The [generated Pi adapter](generated/docs/harness/pi.md) defines tool mappings and mandatory gates.

## Development

```sh
npm ci --ignore-scripts
npm run check
npm run typecheck
npm test
```

Tests cover packed-package CLI, PTY, RPC, SDK, and native dependency contracts using a local scripted provider, without paid inference or ambient credentials. They require Git, tar, Python 3, and a POSIX environment. Upstream renderer, Java, TLC, and forge integrations are separate from `npm test`.

Open a pull request for changes. Edit `port/`, `tools/`, or `extensions/`, not the snapshot or generated resources. Follow [maintenance](docs/maintenance.md) for reviewed updates and recovery, and [verification](docs/verification.md) for evidence limits.

## Licence and attribution

[MIT](LICENSE). The original Cursor pstack attribution and 573 source records come from commit `2776ddd2355d6d6c8747d3964600f28daf62f049`. The manifest records literal-byte hashes and Git modes; npm packaging requires one documented storage-name exception for `.gitignore`.

[npm-badge]: https://img.shields.io/npm/v/pi-mstack
[npm-url]: https://www.npmjs.com/package/pi-mstack
[ci-badge]: https://github.com/michaelasper/pi-mstack/actions/workflows/ci.yml/badge.svg?branch=main
[ci-url]: https://github.com/michaelasper/pi-mstack/actions/workflows/ci.yml
[licence-badge]: https://img.shields.io/github/license/michaelasper/pi-mstack
