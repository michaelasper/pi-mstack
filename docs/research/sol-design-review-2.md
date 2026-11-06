# Sol second-round design review

The goal is a maintainable full Cursor pstack port to pi using pi-loop and pi-subagents. Users retain workflows and mandatory verification gates. Maintainers retain an auditable snapshot and adaptation policy.

## ACCEPT

No remaining design blockers found. This accepts the design, not an implementation or runtime compatibility claim.

The repairs resolve the prior findings without duplicating native execution policy.

- Mandatory evidence and authority gates cannot be skipped. Unsupported required verification blocks dependent actions, with explicit acceptance examples in `docs/design.md:88` and `docs/design.md:172`.
- Mode-independent role data, scoped setup choices, exact parent selection, and honest native eligibility diagnostics are specified in `docs/design.md:131` and `docs/design.md:137-145`. Native preflight remains authoritative. Registry validity is not presented as launch readiness.
- Collision checks precede state changes and input consumption. Startup notices, suffixed commands, native on/off, and agent provenance are covered in `docs/design.md:151-153`.
- Short-command task forwarding remains conditional on a real-host prototype across all named execution modes and busy delivery in `docs/design.md:133`.
- Preservation, discovery, contradictory fallback removal, digest inputs, exclusive publication, crash recovery, and packed link targets now have explicit contracts in `docs/design.md:54-72`, `docs/design.md:90-96`, and `docs/design.md:113-121`.

Ownership is explicit in `docs/design.md:72`. Required generator, runtime, SDK, CLI, dependency, packaging, and adapter checks are specified in `docs/design.md:165-173`, supplemented by the concrete cases in the contracts above. Implemented tests are not required for this design verdict.

## Checks and limits

Read the complete current design, both first-round reviews, and `docs/research/pi-capabilities.md`. Checked the repairs against that capability report, particularly execution separation, resource discovery, branch-local state, exact selectors, provenance, and real-host verification. A read-only inventory check also confirmed 58 top-level upstream skill files.

Prove It Works shaped the verdict by separating inspected design requirements from unexecuted runtime guarantees. No runtime tests, model calls, or child launches were performed. Only this report was written. Product and repository files were not edited. Implementation acceptance remains subject to the specified gates.
