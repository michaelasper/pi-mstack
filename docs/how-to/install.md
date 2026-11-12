# Install or update the package

Version 0.1.0 is available with `pi install npm:pi-mstack@0.1.0`. This guide covers installation from the public GitHub checkout, which may contain unreleased changes. Multiline mode prompts and saved defaults require version 0.2.0 or later; they are not included in npm 0.1.0. See the [release guide](release.md) for registry verification.

## Install

Prerequisites are Git, npm, Node.js 22.19 or later, and Pi 1.5.0. See [compatibility](../reference/compatibility.md) for the tested versions and platform limits.

```sh
git clone https://github.com/michaelasper/pi-mstack.git
cd pi-mstack
npm ci --ignore-scripts
pi install npm:@trevonistrevon/pi-loop@0.7.19
pi install npm:pi-subagents@0.86.0
pi install "$PWD"
```

Keep the checkout in place. Pi loads this local package from its registered path. Start a new Pi session, then run `/pstack doctor`.

If another pstack package is enabled, disable or remove that competing package through Pi's package configuration first. Do not remove unrelated packages. A resource collision blocks this port's mode activation rather than choosing a winner silently.

## Update an existing checkout

Finish active work and inspect local changes first:

```sh
cd /path/to/pi-mstack
git status --short
```

If the checkout has changes, preserve and resolve them before updating. Do not reset them automatically. For a clean checkout:

```sh
git pull --ff-only
npm ci --ignore-scripts
npm run check
```

Restart Pi and run `/pstack doctor`. Updating the package does not approve a new upstream pstack revision by itself. Maintainers follow the separate [upstream review procedure](../maintenance.md).

## Diagnose a blocked start

- **Resource collision:** disable the competing mode or skill resource, restart Pi, and inspect doctor again.
- **Invalid model configuration:** preserve the existing file, then correct it using the [configuration reference](../configuration.md). Setup refuses to overwrite invalid files.
- **Missing native tools:** confirm pi-loop and pi-subagents are installed and enabled. Tool presence alone does not prove launch eligibility.
- **Busy mode request:** wait for settlement, then retry. The refused task was not queued.

Do not bypass an unavailable reviewer, native policy rejection, or required verification by changing to an unapproved model or treating a gap notice as success.
