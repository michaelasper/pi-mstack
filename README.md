# pi-mstack

Use pstack's task playbooks in Pi without replacing Pi's native child agents or scheduling.

[Documentation](docs/index.md) · [First session](docs/tutorials/first-session.md) · [Configuration](docs/configuration.md) · [Maintenance](docs/maintenance.md)

## Why

If you use Cursor pstack's review and implementation workflows but work in Pi, this package ports the skills and their host instructions. It preserves the pinned upstream source for inspection and repeatable updates.

- Invoke 58 upstream skill names, with an explicit notice for the unsupported bot workflow.
- Keep Poteto Mode on for one session branch, or invoke a skill on its own.
- Choose exact authenticated models and ordered review panels without Cursor model aliases.
- See missing capabilities and blocked model choices before relying on them.

This is a public source package, installed from a checkout. It is not published to npm. It does not provide Cursor cloud agents, Benny automation, Bugbot, or a replacement for required product verification.

## Install

Use Node.js 22.19 or later and Pi 1.5.0. Install the execution extensions separately, then install this checkout. These commands are an installation example, not a claim that anything was installed globally during verification.

```sh
git clone https://github.com/michaelasper/pi-mstack.git
cd pi-mstack
npm ci --ignore-scripts
pi install npm:@trevonistrevon/pi-loop@0.7.19
pi install npm:pi-subagents@0.86.0
pi install "$PWD"
```

The tested combination is Pi 1.5.0, pi-loop 0.7.19, and pi-subagents 0.86.0. Other versions are unverified. Disable competing pstack ports before loading this package. A conflicting mode or setup resource blocks activation rather than choosing another package silently.

## Quick start

In Pi, use these distinct operations.

- `/skill:poteto-mode Fix the parser bug and prove the regression.` starts a task under the playbook.
- `/setup-pstack` chooses role models and ordered panels, then asks for confirmation before saving.
- `/pstack doctor` reports mode, configuration, resource collisions, and observable native tools.

## Usage

Bare `/poteto-mode` enables persistent mode without inference. `/poteto-mode off` disables it. Forks inherit only their ancestors' mode entries. A new session starts with mode off.

Use `/skill:how Explain this parser` for a standalone skill. Configured role data remains available with mode off.

Use `/skill:poteto-mode <task>` for tasks in the TUI, RPC, print, and JSON modes. Busy mode requests refuse without changing state or queuing the task. Retry after settlement. The short `/poteto-mode <task>` form is deliberately unsupported. Actual one-shot CLI tests show that command forwarding can start a request without retaining its completed output.

## Configuration and limits

Configuration lives in `pstack/models.json` under Pi's agent directory, normally `~/.pi/agent`. It is separate from Pi's model catalogue. Missing configuration inherits the exact current parent model. Invalid or unavailable explicit choices remain blockers, not silent defaults.

[Configuration reference](docs/configuration.md) describes selectors and native policy checks. [The generated Pi adapter](generated/docs/harness/pi.md) defines tool mappings and mandatory gates. Native preflight remains authoritative. Worktrees are not cloud sandboxes, and pi-loop needs an active host.

## Development

```sh
npm ci --ignore-scripts
npm run check
npm run typecheck
npm test
```

`npm test` includes packed-package CLI, PTY, RPC, SDK, and native dependency contracts with a local scripted provider. It needs Git, tar, Python 3, and a POSIX environment. It does not use paid inference or ambient credentials. It does not run upstream renderer, Java, TLC, or forge integrations.

For changes, edit `port/`, `tools/`, or `extensions/`, not the snapshot or generated resources. [Maintenance](docs/maintenance.md) covers reviewed updates and recovery. [Verification](docs/verification.md) separates API evidence from untested model behaviour.

## Licence

[MIT](LICENSE). The original Cursor pstack attribution and 573 source records come from commit `2776ddd2355d6d6c8747d3964600f28daf62f049`. The manifest records literal-byte hashes and Git modes. Standard npm packaging requires one documented storage-name exception for `.gitignore`.
