# Repository grounding

`pstack.ground` is a named pi-subagents workflow resource. It gathers one to four repository evidence reports before it requests an explanation. It also supports evidence-only output.

## Installation and invocation

The npm package depends on exactly `pi-subagents` 0.87.0. Pi must load that extension as well as pi-mstack. The resource uses the public `pi-subagents/workflow-resources` import. An unavailable import or absent native owner disables grounding without removing the other pstack commands. `/pstack doctor` reports registration status. Tool presence does not establish owner compatibility.

The supported tested route is an independently installed npm tarball with Pi 1.5.0 or 1.5.2. Other installation layouts and pi-subagents versions are unverified.

A native call has this shape after `subagents_enable` makes `subagent` available.

```json
{
  "workflow": "pstack.ground",
  "args": {
    "task": "Explain how the parser handles invalid input.",
    "angles": ["validation", "error reporting"],
    "mode": "explain"
  },
  "async": true
}
```

Only `task`, `angles`, and `mode` are accepted in `args`. The task is nonblank and at most 8192 UTF-8 bytes. Angles are distinct, trimmed, nonblank strings of at most 256 UTF-8 bytes each. There are one to four angles. Mode is `explain` or `evidence-only`. The serialized request is at most 12288 UTF-8 bytes. Unpaired surrogates are rejected.

Arguments cannot select agents, models, scripts, or host grants. Native outer options and native permission policy remain authoritative.

## Models and agents

The resource snapshots the typed `how explorer` and `how explainer` role selections at session start and before each agent turn. It passes the exact effective selectors, including thinking, to native launches. Missing configuration inherits the parent explicitly. Invalid or unavailable selections block without substitution. Evidence-only does not require an eligible explainer model.

The owned `pstack-explorer` and `pstack-explainer` templates allow `read`, `grep`, `find`, and `ls`. They disable ambient extensions and inherited project, global, and skill context. Native structured output adds its protocol tool. These defaults do not establish an operating-system sandbox.

Native same-name user and project agents can replace the package definitions. Native settings, required extensions, permission checks, and launch resolution remain authoritative. The resource does not freeze agent definitions or guarantee the owned tool list for an override.

Both owned templates declare attested acceptance with `report: on`. Child requests omit acceptance so native launch preserves the resolved agent's default policy. Missing, weaker, or unsupported stronger policies block synthesis rather than being replaced. Such policies can permit child inference before the result gate.

The resource grants no `runs.host` authority and adds no verification command. Native operator-selected agent policies may execute their own verification commands. The templates' instruction not to run commands constrains the agent, not the native owner's post-run verification.

## Evidence and outcomes

Every required explorer must finish before synthesis. A usable result requires native success, a nonreused terminal result, a run ID, one exit-zero result row, and a saved path equal to the native output reference. Its native ledger must record explicit attested acceptance and attested evidence under an attested effective policy. Failed runtime checks, parse errors, review requirements, and parent rejection block it. The child report must supply the satisfied criterion, manual notes, and residual risks without a failed command claim.

The separate domain report is a closed version-1 object. A complete report has one to twelve findings, each with a claim and one to four repository citations, plus up to eight limitations. Citations use repository-relative paths, `working-tree` revision, and inclusive positive safe-integer line intervals. Absolute paths, traversal, empty components, backslashes, control characters, and colon-bearing paths are rejected. Claims are at most 1024 UTF-8 bytes. Paths and limitations are at most 512 UTF-8 bytes. Each report is at most 24 KiB and the evidence packet is at most 128 KiB.

The packet associates validated reports with native run IDs, saved references, and requested selectors. Actual model and thinking attribution are null when native results omit them. Requested attribution never fills missing actual attribution.

| Outcome | Meaning |
| --- | --- |
| `evidence-ready` | All required explorers passed. No explainer ran. |
| `explained` | All required explorers and the explainer passed the same native and domain gate. |
| `blocked` | A launch, acceptance, domain, or output-binding check failed. Partial references or accepted explorer evidence may be present. |

Native request rejection, cancellation, or host failure can instead terminate the enclosing workflow. These outcomes do not authorize synthesis.

Attestation is not independent verification. Citation validation establishes syntax and association, not source existence, truth, byte integrity, immutability, comprehension, or retention. Saved paths remain mutable. No restart, exactly-once, or pre-inference grant guarantee is provided.
