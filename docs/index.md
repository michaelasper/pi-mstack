# Documentation

Choose a page for what you need now. The user documentation follows [Diátaxis](https://diataxis.fr/): learning by doing, completing a task, looking up facts, and understanding the design are separate activities.

## Learn by doing

[Your first Pi session](tutorials/first-session.md) walks through installation, checking the loaded extension, and enabling and disabling branch-local mode. The exercise does not send a model request.

## Complete a task

- [Install or update the package](how-to/install.md).
- [Choose role models and review panels](how-to/configure-models.md).
- [Prepare and publish an npm release](how-to/release.md).
- [Update upstream, recover an interrupted write, or export the original source](maintenance.md).

## Look up facts

- [Commands, configuration schema, selectors, and mode state](configuration.md).
- [Maintenance commands, acceptance schema, and retained state](reference/maintenance.md).
- [Repository grounding and native acceptance](reference/grounding.md).
- [Compatibility and capability limits](reference/compatibility.md).
- [Version policy, release commands, and CI](reference/releases.md).
- [Verification contracts and coverage](verification.md).
- [Generated Pi host mappings](../generated/docs/harness/pi.md).

## Understand the design

[Why the port separates source, adaptation, and execution](explanation/architecture.md) explains the update model, native dependency boundaries, and explicit capability gaps.

## Maintainer evidence

[Design](design.md), [implementation notes](implementation-notes.md), and [review reports](research/) preserve the development record. These are historical engineering records, not additional installation instructions. Absolute paths in those records name local, temporary evidence and are not downloadable public artefacts. Use the [verification commands](verification.md#reproduce-the-checks) to produce your own evidence.
