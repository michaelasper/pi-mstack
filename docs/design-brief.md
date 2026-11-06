# Pstack port design brief

## Goal

Create a maintainable port of Cursor pstack to pi. Preserve upstream workflows and resources, use npm:@trevonistrevon/pi-loop for scheduling and npm:pi-subagents for child execution, and expose missing capabilities honestly. Do not implement a replacement cloud platform without the operator's decision.

## Grounding

Upstream lives at `.cache/cursor-plugins/pstack`, commit `2776ddd2355d6d6c8747d3964600f28daf62f049`, plugin version `0.15.36`. It contains 573 files, 58 top-level skills, 23 playbooks, 24 principle skills, two agents, and the dormant Benny pack. Preserve executable bits and test fixtures. The MIT notice names Lauren Tan.

Read the full investigation artifacts before designing.

- `/Users/asper/.pi/agent/sessions/--Users-asper-source-pi-mstack--/subagent-artifacts/outputs/06b559dd-80ad-43c8-b210-533a5f65b5e9/grounding.md` contains the upstream inventory and reference-port assessment.
- `/Users/asper/.pi/agent/sessions/--Users-asper-source-pi-mstack--/subagent-artifacts/outputs/ea724fd4-5bf7-4044-a321-99363d2afbbe/pi-capabilities.md` contains the native API investigation.

The installed `@zenspc/pi-pstack` is a reference, not a parity baseline. It omits upstream resources, changes discoverability, and contains stale delegation advice. Do not copy it wholesale.

## Design requirements

Write caller-facing usage first, then derive types, function signatures, and module ownership. The central data shape is an upstream resource record with source path, hash, Git mode, and an explicit import/adaptation/gap disposition. Keep raw upstream distinguishable from generated resources. An update must identify new and changed content that needs adaptation review. A no-op regeneration must produce no diff. No network or upstream code execution on extension load.

Provide native persistent poteto-mode, setup and model-role configuration, skill invocation, agent discovery, dependency diagnostics, and explicit mapping documentation. Preserve panel order and exact model selectors. Never silently substitute an unavailable required model. Respect branch-local mode state, custom-message wakes, and command/skill collisions.

pi-loop 0.7.19 and pi-subagents 0.86.0 have incompatible optional orchestration RPC contracts. Use loop tools for scheduling and monitors. Use subagent for delegation. Do not use OrchestrationCreate as a bridge. Prefer a documented three-package installation unless a bundled dependency design demonstrably avoids duplicate extension loads.

Cursor cloud agents, always-on automations, bot webhooks and secret storage, editor context, and external Cursor team-kit tools have no established replacement here. Account for them and avoid pretending that worktrees are VMs. Preserve dormant source without accidentally exposing its three skills.

The importer must preserve licensing, permissions, relative links, skill frontmatter policy, and runnable scripts. It must not globally rewrite executable fixtures. Tests must cover upstream drift, deterministic output, package contents, real pi loading, model configuration, persistence, loop behavior, and native child invocation. Keep offline tests distinct from network-dependent upstream tests.

## Candidate contract

Produce one design package as a report, not implementation. Include usage, type sketch, module map, import/update algorithm, capability table, validation plan, alternatives and tradeoffs, and the first implementation step. Read the architect runner prompt and design red flags in the installed pstack skill directory. Consider at least two whole-shape alternatives within your analysis. Prefer a small implementation a future maintainer can audit.

No repository writes. No child delegation. Reports have separate managed output files. Both candidates receive this same brief and can make different choices.

## Parent comparison rubric

Score each candidate on upstream fidelity, update determinism and drift visibility, native pi integration, honest capability boundaries, and reproducible runtime verification. Prefer fewer independently maintained representations when tied.
