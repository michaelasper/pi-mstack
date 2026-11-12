# pi-mstack

Use pstack's task playbooks in Pi without replacing Pi's native child agents or scheduling.

[Documentation](docs/index.md) · [First session](docs/tutorials/first-session.md) · [Configuration](docs/configuration.md) · [Maintenance](docs/maintenance.md)

## Why

If you use Cursor pstack's review and implementation workflows but work in Pi, this package ports the skills and their host instructions. It preserves the pinned upstream source for inspection and repeatable updates.

- Invoke 58 upstream skill names, with an explicit notice for the unsupported bot workflow.
- Keep Poteto Mode on for one session branch, or invoke a skill on its own.
- Choose exact authenticated models and ordered review panels without Cursor model aliases.
- See missing capabilities and blocked model choices before relying on them.

Version 0.2.0 adds multiline mode prompts and saved mode defaults. Check the npm registry for publication status; this checkout includes these features. [Release preparation](docs/how-to/release.md) covers versioning, CI, and explicit publication approval. It does not provide Cursor cloud agents, Benny automation, Bugbot, or a replacement for required product verification.

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

Bare `/poteto-mode` enables persistent mode without inference. `/poteto-mode off` disables it for the active branch. Forks inherit only their ancestors' mode entries. New sessions default to off unless you save a different preference.

Use `/skill:how Explain this parser` for a standalone skill. Configured role data remains available with mode off.

Put your task after `/poteto-mode` on the same line or a new line:

```text
/poteto-mode
Fix the parser bug and prove the regression.
```

`/potete-mode` is also accepted as an alias. `/skill:poteto-mode <task>` still works. These routes complete in TUI, RPC, print, and JSON modes. Busy mode requests refuse without changing state or queuing the task; retry after settlement.

Save the default with `/pstack default on` or `/pstack default off`. Query it with `/pstack default`. The preference applies to sessions and branches without an explicit mode choice; `/poteto-mode off` always overrides a default of on. Existing branches without an explicit choice also follow the saved default. Preferences are stored alongside role configuration, not in the package installation.

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
