# Sol design review

The goal is a maintainable, source-faithful Cursor pstack port to pi using pi-loop and pi-subagents. Users need workflows that preserve their verification requirements. Maintainers need one auditable adaptation policy and reproducible updates.

**REVISE.** Four design-contract gaps need small documentation repairs. These are inferred failure scenarios, not observed implementation defects. No runtime verdict is claimed.

Evidence roots used below:

- `D` is `/Users/asper/source/pi-mstack/docs/design.md`.
- `U` is `/Users/asper/source/pi-mstack/.cache/cursor-plugins/pstack`.
- `PI` is `/Users/asper/.pi/agent/install/releases/1.5.0/node_modules/@earendil-works/pi-coding-agent`.
- `SUB` is `/Users/asper/.pi/agent/npm/node_modules/pi-subagents`.
- `LOOP` is `/Users/asper/.pi/agent/npm/node_modules/@trevonistrevon/pi-loop`.

## Findings

### P1. Specify what an unavailable capability does to a mandatory gate

**Exact sections.** `D`, "Maintainable adaptation strategy", lines 69-83, and "Missing capabilities", lines 138-142.

The adapter promises precedence and vocabulary coverage, but does not specify whether unavailable steps block dependent actions or can be skipped. This matters because its stated precedent has a materially unsafe rule to inherit. `U/docs/harness/claude-code.md`, "Cursor-only features", says to skip unavailable steps, continue, and leave placeholders for their outputs.

**Failure scenario, inferred.** Shipping needs an independent verifier to run the product and produce a verdict before any merge is armed. Cursor cloud execution and the named control tools are unavailable. A generated adapter follows the precedent's skip behavior, records a capability notice, and proceeds toward merging without equivalent verification. A gap notice does not preserve the prerequisite in `U/skills/poteto-mode/playbooks/shipping.md:5-8`.

**Smallest repair.** Add a normative adapter rule distinguishing optional omissions from required evidence and authority gates. A supported substitute must satisfy the original requirement. Otherwise dependent irreversible work remains blocked, and no placeholder counts as a verdict. Explicitly reject the Claude adapter's blanket skip-and-continue rule. Add Shipping and missing UI verification as acceptance examples. This is prose policy, not a request for an executor or service replacement.

### P2. Define role configuration independently of sticky mode

**Exact sections.** `D`, "Runtime contract / Mode", lines 112-118, and "Runtime contract / Roles", lines 122-128.

The effective role table is described inside the mode instruction. The design does not explicitly say whether that table is present when mode is disabled and a role-using skill runs directly. Standalone `/skill:how` is advertised in the consumer contract.

**Failure scenario, inferred.** A user configures `how explorer`, leaves Poteto Mode off, then invokes `/skill:how`. If the table follows the mode section's enabled state, the skill cannot see its configured selection. Its retained source says to use Cursor defaults when a role line is missing and to omit the model for inheritance. Those instructions appear in `U/skills/how/SKILL.md:11`. The latter permits native agent overrides instead of exact parent inheritance under `SUB/docs/models.md`, "Models". An adapter must define the source of the effective values, not merely rename the old rule path.

**Smallest repair.** Separate the role-data instruction from the enabled-mode instruction. Make validated role data available to direct skills, nested skill reads, and custom wakes without enabling Poteto Mode. State that adapter role resolution overrides upstream missing-role defaults and fallback instructions. An unavailable explicit role remains blocked as already required. Test `/skill:how` with mode off and a conflicting native agent model override.

### P2. Specify the setup picker's model scope

**Exact section.** `D`, "Runtime contract / Roles", lines 124-126.

"Available registry" does not distinguish the authenticated catalog from the current session's scoped model set. Pi documents both and explicitly tells model pickers to use `ctx.scopedModels` when nonempty. See `PI/docs/extensions.md:1214-1218`.

**Failure scenario, inferred.** A user starts pi with `--models` or `enabledModels` selecting a limited model set. Setup enumerates the whole available registry and offers an out-of-scope expensive model as an ordinary choice. The port then passes that exact selector. Pi's picker scope is not automatically a child restriction. Native child restrictions are separately described in `SUB/docs/models.md`, "Model scope enforcement". Registry validity therefore cannot establish either adherence to the user's selection scope or native launch eligibility.

**Smallest repair.** Define setup choices as the nonempty session scope, otherwise the available registry. Preserve and diagnose persisted explicit choices that fall outside the current scope rather than silently rewriting them. Document that this is picker behavior, while native `subagents.modelScope` and thinking ceilings remain authoritative launch policy. Do not duplicate their enforcement. Include scoped, unscoped, persisted-out-of-scope, and native-rejection tests.

### P2. Apply provenance checks before native activation, not only forwarding

**Exact sections.** `D`, "Runtime contract / Mode", line 112, and "Diagnostics and provenance", line 134.

The ownership check is required "before forwarding", while native `/skill:poteto-mode` changes persistent state before expansion without forwarding. Those are different paths. Pi expands skill commands after `input` handlers, as documented in `PI/docs/extensions.md:313-318` and its "input" section.

**Failure scenario, inferred.** Another installed port wins discovery of `skill:poteto-mode`. This port observes that raw text and enables its own sticky mode, then pi expands the other package's skill. With the exact `off` argument, this port may consume input intended for the other skill. The caller receives mixed behavior despite the stated collision-refusal contract.

**Smallest repair.** Require the same exact-resource ownership check before every native activation, disable, or input consumption, before writing a mode event. On mismatch, leave state unchanged and return the actionable collision diagnostic. Cover both `/skill:poteto-mode <task>` and `/skill:poteto-mode off`. Also test when an extension command shadows that skill command, because extension commands run before `input`.

## Assessment of the remaining design

The raw snapshot plus generated adapter approach is suitable. It avoids maintaining rewritten copies while retaining executable fixtures and historical resources. I independently confirmed the cache's full pinned commit and its 573 tracked pstack files using `git rev-parse` and `git ls-tree`.

The import contract correctly separates proposal, acceptance, and offline generation. Hash-bound patches, mode preservation, review-digest validation, partial-publication detection, and explicit repair are appropriate design requirements. I found no additional definite update-safety blocker in the written contract. Implementation tests must establish those guarantees, including shared-writer races and stale-lock recovery.

The command-lifetime issue is honestly left as a prototype gate in line 118. That is acceptable for this design-only stage. It is not evidence that command forwarding works. Keep the advertised short command conditional on the real CLI gate, or document the native route selected by that gate.

The three-package installation and rejection of an OrchestrationCreate bridge preserve the requested execution ownership. No new scheduler, child executor, or cloud service is needed.

## Residual test gates

All eight verification groups in `D` remain unexecuted. In particular:

- Prove active-branch mode restoration, custom wakes, and the native collision cases above through provider-visible prompts and persisted entries.
- Prove TUI, RPC, print, and JSON task delivery and one-shot lifetime. Treat handled commands separately from actual agent turns.
- Exercise scoped setup, mode-off role use, exact selector and thinking attribution, repeated ordered panels, unavailable roles, and native policy rejections.
- Test concurrent acceptance and generation, concurrent generation, crash recovery at publication boundaries, stale locks, stale review digests, manual generated edits, and byte-identical regeneration.
- Check the packed inventory, frontmatter visibility, dormant Benny exclusion, executable modes, licenses, local links, and included maintenance commands.
- Demonstrate a real native child with retained output and completion delivery. Demonstrate monitor completion causing a provider-visible follow-up, not merely buffered output. Adapter tests should include dynamic-loop continuation, cleanup, and restart limits from `LOOP/docs/USAGE_GUIDE.md`, "Dynamic goal loops" and "Background monitors".
- Keep optional live-model evaluation separate. Scripted providers prove dispatch contracts, not whether arbitrary models obey adapter precedence or preserve mandatory gates.

## Checks and review boundary

I read the design, brief, both research reports, the pinned upstream mode and affected skills/playbooks, the upstream Claude adapter, and the cited pi/dependency documentation. I used read-only source searches, numbered file reads, Git inventory checks, and repository status inspection. I ran no bundled scripts, tests, model calls, or runtime sessions. I launched no children and edited no repository files. Only this requested report was written.

Boundary Discipline shaped the repairs by putting ownership and model interpretation at explicit host boundaries rather than adding scattered execution hooks. Make Operations Idempotent shaped the crash, retry, and writer-race gates. Prove It Works kept source-observed contracts separate from runtime acceptance. Each principle's leaf skill was read in full. No-comments is not applicable to this design-only review.
