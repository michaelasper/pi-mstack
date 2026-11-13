# Install or update the package

Use the npm package for normal use. Use a checkout only when contributing or testing unreleased changes.

## Install from npm

Prerequisites are npm, Node.js 22.19 or later, and Pi 1.5.0. See [compatibility](../reference/compatibility.md) for tested versions and platform limits.

```sh
pi install npm:@trevonistrevon/pi-loop@0.7.19
pi install npm:pi-subagents@0.88.1
pi install npm:pi-mstack
```

Start a new Pi session, then run `/pstack doctor`. These commands register packages in your personal Pi configuration. Use `pi list` to inspect the installed sources.

For a reproducible installation, check `npm view pi-mstack version` and install an explicit published version, for example `pi install npm:pi-mstack@0.2.0`. Multiline mode prompts and saved defaults require 0.2.0 or later.

If another pstack package is enabled, disable or remove that competing package through Pi's package configuration first. Do not remove unrelated packages. A resource collision blocks this port's mode activation rather than choosing a winner silently.

## Update an npm installation

Finish active work, then run:

```sh
pi update --extensions
```

This reconciles configured extension packages, not just pi-mstack. Exact version pins stay pinned. To change a pin, use `pi install npm:pi-mstack@VERSION` with the intended published version. Restart Pi and run `/pstack doctor`.

## Install from a checkout

Install the two execution extensions shown above, then use Git and npm:

```sh
git clone https://github.com/michaelasper/pi-mstack.git
cd pi-mstack
npm ci --ignore-scripts
pi install "$PWD"
```

Keep the checkout at this path; Pi loads it directly. If switching from npm, use `pi list` and remove only the old pi-mstack source with `pi remove <source>` before loading the checkout. Do not load both copies.

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
