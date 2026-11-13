# Changelog

Versions use [Semantic Versioning](https://semver.org/). A heading records prepared release contents, not proof that the version has been published. Git tags and npm registry metadata identify published releases.

## [Unreleased]

### Added

- `--pstack-plan` registers a default-off `pstack_plan` tool for one validated, ordered plan per session branch, with an opaque compare-and-append revision, explicit absent, cleared, and unsupported states, and provider-visible restoration built per request.
- `--pstack-idle-compact` compacts once at 80 percent context usage when the agent settles idle, rearms at or below 70 percent, and disarms after a failure or ineffective summary.

### Limits

- Plan state persists with native session persistence, so a conversation-less session can remain memory-only. Compare-and-append is single-runtime and is not a cross-process transaction.
- Idle compaction is admitted by context usage, not cache age. It makes no cache-hit, cost, or latency promise, and native manual compaction still aborts internally.

## [0.3.0]

### Added

- `/goal` to inspect, set, and clear branch intent without starting model work.
- One-time session names from accepted task text or Jira identifiers, with manual names and clears preserved.
- Versioned environment configuration for local terminology, automatic memory context, and on-demand MCP retrieval.
- Explicit context-extension loading in bundled children, with native tools and MCP configuration retaining control of access.

### Changed

- Remove the accidental `/potete-mode` alias. Use `/poteto-mode` or `/skill:poteto-mode` instead.
- Resolve resource ownership through canonical paths on supported Pi hosts.

### Limits

- Fresh metadata-only goals follow native session persistence and remain memory-only until a conversation is saved.
- Custom environment files alone do not trigger Pi project trust. Native trusted status does not prove explicit human approval.
- Retrieval output limits do not redact native tool events, nested-call metadata, or provider records.

## [0.2.1]

### Changed

- Make npm the default installation path, with a refreshed README and separate Diátaxis tutorial, how-to, reference, and explanation navigation.
- Update the tested pi-subagents version to 0.87.0, TypeScript to 7.0.2, and Node.js types to 26.6.6. The minimum runtime remains Node.js 22.19.0.
- Update pinned checkout, setup-node, setup-java, and upload-artifact GitHub Actions.
- Require protected pull requests and CI for `main`, protect release tags from modification, and enable Dependabot security updates.

## [0.2.0]

### Added

- Same-line and multiline `/poteto-mode` tasks in TUI, RPC, print, and JSON modes, plus `/potete-mode` as an alias.
- `/pstack default on|off` to save Poteto Mode's default, with explicit branch choices taking precedence.

## [0.1.0]

### Added

- Reproducible port of pstack 0.15.36 with all 573 source records accounted for and 58 generated skill names.
- Branch-local Poteto Mode, exact model roles and panels, and native pi-loop/pi-subagents integration.
- Pi-native skill-authoring and privacy-bounded transcript workflows.
- Digest-bound upstream updates, schema-2 adaptation inventories, and explicit recovery operations.
- Diátaxis documentation and packaged CLI, PTY, SDK, RPC, and native contract tests.
- CI and manually dispatched, version-checked npm release preparation.

### Fixed

- Statechart execution inside npm installations and macOS symlink fixtures, with offline and live TLC verification.
- Bounded statechart replay test timeouts sized for hosted macOS runners.

- Exact custom-provider selectors, including slash-bearing and URL-shaped provider names.
- Busy-mode state handling, literal extension messages, empty configuration files, and colon-bearing model IDs.
- Maintenance argument validation, owned lock-write cleanup, and input-level drift diagnostics.
