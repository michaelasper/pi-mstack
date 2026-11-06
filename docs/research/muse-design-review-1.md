# Muse design review of the pstack port design

## Verdict

REVISE.

The goal is a maintainable full Cursor pstack port to pi with pi-loop for scheduling and pi-subagents for child execution. The consumer keeps upstream workflows, persistent Poteto Mode, and exact model roles. The maintainer keeps a pinned snapshot, reviewed updates, and no manually maintained workflow fork. This review judges `docs/design.md` against `docs/design-brief.md`, `docs/research/upstream.md`, `docs/research/pi-capabilities.md`, `docs/research/muse-design.md`, and `docs/research/sol-design.md`. It also inspected pinned upstream files and the installed Pi, pi-loop, and pi-subagents documentation and type declarations where a contract was uncertain. This is a design review only. It claims no runtime verdict.

The synthesis picks the right base. Sol's raw snapshot plus generated resources beats Muse's single shipped tree on fidelity and drift review, because only the snapshot and policy are maintained inputs. The synthesis is also right to reject Sol's mandatory tagged child launches and model-enforcement hook, to reject Muse's mixed update-and-publish flow, and to keep `make-bot-ui` discoverable as a gap notice instead of deleting its name. Those choices do not yet close the blockers below. Several of them sit exactly on the seams the parent asked this review to judge, namely source fidelity, shared host-adapter completeness, update safety, native command lifetime, model scope, and collision behavior.

Principles that shaped this review, each read in full this session:

- **Model the Domain** changed two findings from wording complaints into type repairs. The preservation disposition and the role resolution input both allow states the design elsewhere forbids.
- **Boundary Discipline** changed the model finding. Scope, thinking ceilings, and scoped-model snapshots enter at the pi-subagents launch boundary, so validation belongs in the resolver input, not in workflow prose.
- **Prove It Works** changed the command-lifetime finding. Pi 1.5.0 type declarations show `pi.sendUserMessage` returning `void` on the extension API, so awaiting it cannot be the mechanism that keeps a one-shot run alive. Only a real-surface prototype settles that.
- **Make Operations Idempotent** changed the update finding. A leftover acceptance claim after a crash must be judgeable by the next run, or every interruption becomes manual cleanup.
- **Laziness Protocol** kept every repair at the smallest change. No finding asks for a new executor, a cloud service, a second policy protocol, or a scheduler.

## Blockers

### 1. The shared adapter cannot override contradictory fallback instructions by precedence alone

Severity is Critical.
Section is "Maintainable adaptation strategy", steps 2 to 4, read with "Roles", final paragraph.

The design inserts a prominent adapter instruction after frontmatter and states that the adapter takes precedence for host-specific names, tools, models, paths, and unavailable services. It then retains upstream wording beneath that preamble as source vocabulary interpreted through the mapping. That works for renamed nouns. It does not work for downstream sentences that state the opposite policy as an executable instruction.

Concrete evidence from the pinned snapshot:

- `skills/arena/SKILL.md` line 17 instructs the runner to use Cursor default slugs when the models rule or a line is missing, to run a rejected seat on its family's default, and to fall back to the closest valid slug of the same family. Line 28 repeats family fallback for the cross-judge.
- `skills/how/SKILL.md` line 11, `skills/why/SKILL.md` line 11, `skills/reflect/SKILL.md` line 27, and `skills/swarm/SKILL.md` line 22 carry the same missing-rule default and rejected-slug fallback pattern.
- The design states the opposite in "Roles". There is no fuzzy matching, no Cursor slug translation, and no silent substitution. An unavailable explicit selection remains a visible blocker.

Failure scenario. A user installs the package, never runs setup, and invokes the arena workflow. The role assignment is inherit-parent. The model reads the generated arena skill, reaches line 17 beneath the preamble, and follows the concrete sentence rather than the general precedence claim. It spawns a Cursor slug or a same-family substitute. Status still reports inherit-parent, so the run both disobeys the design and misreports itself. The host-term scanner does not catch this, because the slug is a recognized term with a registry entry. Recognition is not negation.

Smallest repair. Add one registry entry that explicitly negates the missing-config default, the rejected-selector fallback, the same-family fallback, and the budget default, and name the exact replacement behavior. Require the scanner to classify those fallback sentence patterns as adapt-required rather than copy-with-preamble. Give each file that contains them a hash-bound exact patch or replacement disposition that removes or rewrites the fallback paragraph. Keep the patch list bounded to files the scanner flags. Add a generation check that fails when a flagged fallback pattern survives outside a historical allowlist.

### 2. The host mapping registry has no closed inventory, and role references are outside the scanner

Severity is Major.
Section is "Maintainable adaptation strategy", steps 3 and 4 and the scanner paragraph.

The registry list names Cursor Task fields, `generalPurpose`, model slugs, readonly, cloud isolation, file attachments, skill invocation, todo lists, loops, monitors, session history, model setup, and services. The list reads as illustrative rather than closed. It does not name several executable concepts that the pinned upstream uses and that Pi maps differently. `AskQuestion` appears in `poteto-mode/SKILL.md` line 21 and as a structured tool preference in `setup-pstack/SKILL.md` lines 22 and 31 and `automate-me/SKILL.md` lines 17 and 44. Pi gives the model no such tool. Bare skill routing by name, child control actions such as steer and resume, worktree launch fields, and MCP provider loading also need explicit mappings. The upstream Claude Code generator already maintains a 23-key term table in `scripts/generate-pstack-harness-trees.mjs`, including `AskQuestion`, bare skill routing, `resume`, and cloud fields. The design does not require seeding the Pi registry from that table.

Role references have the same hole. Upstream skills address roles by sentences such as the `arena cross-judge pool` line, the `how explorer` line, and the `swarm workers` line in `~/.cursor/rules/pstack-models.mdc`. The design says one role registry serves setup, parsing, status, and injected instructions, but it never names the role set, never derives it from `setup-pstack`, and never scans workflow prose for role references. A registry that omits a referenced role produces exactly the missing-line condition that Finding 1 shows upstream resolves with Cursor defaults.

Failure scenario. An upstream update adds a role line to `setup-pstack` and references it from a new workflow step. The importer accepts the changed files under review. The scanner passes because no host term changed. Setup never offers the role, the injected table lacks it, and the workflow falls back or blocks at runtime. Nothing in the update report names the omission.

Smallest repair. Seed the registry term table from the upstream generator's term list plus Pi-specific terms for skill routing, child control, worktrees, and provider loading. Make the scanner report three sets and fail on the first two. The sets are terms used but unmapped, role labels referenced but absent from the registry, and registry roles no longer referenced upstream. Require that last set to be retired explicitly so a dropped role cannot linger as a phantom setup option.

### 3. The package manifest contract is missing, so discovery can register the wrong tree

Severity is Major.
Section is "Data and ownership" and "Maintainable adaptation strategy", step 6.

The design names three trees. The source tree is `upstream/pstack/`, the accepted manifest is `upstream/manifest.json`, and the generated runtime tree is `generated/`. It never states the package manifest entries that decide what Pi and pi-subagents discover. Pi documentation states that without a `pi` manifest, Pi discovers skill directories from conventional locations, and that directories containing `SKILL.md` are discovered recursively. The snapshot contains 61 `SKILL.md` files, including Benny's three dormant skills and the original `make-bot-ui`.

Failure scenario. An implementer registers both trees, or relies on directory convention, or ships the snapshot where recursive discovery reaches it. Benny's skills become ordinary slash skills, which the brief forbids. The original `make-bot-ui` shadows the generated gap notice because name collisions keep the first discovered skill. Doctor can report the collision after the fact, but the consumer contract already failed at load. The reverse error is also open. An implementer may exclude the snapshot from the tarball to avoid discovery and silently break the offline provenance claim.

Smallest repair. Add a manifest table to "Data and ownership". It states the exact `pi.extensions`, `pi.skills`, and `pi.subagents.agents` entries, each pointing only at generated or extension paths. It states the npm `files` set and whether the snapshot and manifest ship in the tarball. It states that no discovery root reaches `upstream/`. Extend Verification gate 4 so the packed package asserts the exact discovered skill name set, including the `make-bot-ui` notice, the absence of Benny names, and `sourceInfo` paths under `generated/` for mode and setup.

### 4. The preservation disposition conflates provenance, history, dormancy, and gaps

Severity is Major.
Section is "Data and ownership", the `Disposition` definition.

The type is `copy(outputPath) | adapt(outputPath, adapterId) | preserve(gapId)`. Every preserved file must carry a gap identifier. Most preserved files are not capability gaps. `LICENSE` is a legal obligation, the plugin manifests and `.gitignore` are provenance, the guide documents and logo are historical material, and Benny is a dormant pack that must stay unregistered. Forcing each into a `gapId` either invents a gap that the capability table then reports or pushes an implementer to mark them `copy`, which can place a plugin manifest or dormant skill where discovery or packaging treats it as live.

Failure scenario. The importer author must classify `automations/benny/` and `docs/guide/` on day one. With only `preserve(gapId)` available, Benny becomes a gap entry indistinguishable from the `make-bot-ui` service gap, and the dormant exclusion check has no type-level difference to assert. A later maintainer reading the manifest cannot tell whether a preserved path may ever be registered.

Smallest repair. Split preservation into an explicit variant that records a reason and an exposure. The reason set is provenance, historical, dormant, and capability gap. The exposure set is snapshot-only, generated notice, and generated asset. That is one added discriminated variant, not a new subsystem. The manifest completeness check then asserts exposure per reason, and the capability table derives only from the capability gap reason.

### 5. Role validation ignores pi-subagents model scope, thinking ceilings, and override precedence

Severity is Major.
Section is "Roles" and "Diagnostics and provenance".

The design validates a selection against the available registry and host-supported thinking levels. The installed pi-subagents contract has three more gates that act before a child starts. `docs/models.md` in pi-subagents 0.86.0 documents `subagents.modelScope` with global and per-agent allow lists, `enforce` and `strict`, the reserved `inherit` and `scoped` entries, project-over-user precedence gated by project trust, and `subagents.maxThinking` as a hard ceiling. It also documents that an explicitly passed model that falls outside an enforced scope errors and aborts the run, while inherited models only warn unless `strict` is set. That distinction interacts directly with the design's choice to resolve inherit-parent to the parent's exact selector before launch. The choice is sound for beating agent overrides, because a per-run selector has the highest precedence. It also converts an inherited selection into an explicit one for scope purposes, which can change a warning into a hard abort.

Failure scenario. A project sets an enforced scope that allows only `inherit` for `poteto-agent` and sets `maxThinking` to `xhigh`. The user configures a role to an in-registry selector at `max` effort. Doctor reports the role ready because the selector exists and Pi supports `max`. The first workflow launch aborts inside pi-subagents preflight. Status said ready, the child never started, and the workflow has no named diagnosis. The reverse also occurs. A selector passes a registry listing that includes models without credentials and fails only when the child starts.

Smallest repair. Extend the role resolution input, which "Roles" already treats as a validated domain value, with the effective pi-subagents policy snapshot. That snapshot carries the global and per-agent scope, `enforce` and `strict`, the scoped-model set, `maxThinking`, and the current parent selector. Read availability from the authenticated model set rather than the full catalog where the host API distinguishes them. Report scope-blocked and ceiling-blocked as named diagnostics distinct from unavailable. Add Verification gate cases for enforced scope, per-agent scope, strict inheritance, and a selector above the thinking ceiling.

### 6. Collision handling does not bind the native skill route or the suffixed-command case

Severity is Major.
Section is "Runtime contract", Mode, and "Diagnostics and provenance".

The design observes native `/skill:poteto-mode` before expansion and enables mode from it. The ownership check lives in the diagnostics paragraph and is phrased around forwarding. Pi keeps the first discovered skill on a name collision and gives duplicate extension commands numeric suffixes. Both facts come from the Pi capability research and the Pi skills documentation.

Failure scenario one. The reference port and this package are both installed, and the reference skill wins discovery. A user types `/skill:poteto-mode`. The input hook enables this package's mode state, the host expands the other package's skill text, and the injected section then points at this package's generated path. The session now holds two contradictory instruction sources and a mode flag that claims the wrong one.

Failure scenario two. Both packages register `/poteto-mode`, so Pi suffixes one. The user runs the unsuffixed name, which is the other package's handler. This package's handler never runs, so its collision diagnostic never runs either. A doctor subcommand has the same exposure if `pstack` itself is suffixed.

Smallest repair. State that the input hook runs the same ownership check as command forwarding before it writes any mode entry, and that a failed check leaves mode unchanged and reports the winning `sourceInfo`. Require a `session_start` collision notice for the three extension commands and the two skill names, derived from `getCommands()` and skill `sourceInfo`, so a suffix the user never invoked still surfaces. Extend Verification gate 4 to cover the native skill route under collision and invocation through the suffixed command name. Treat a user or project `poteto-agent` override the same way at launch reporting time. The design may accept the override as an operator choice, but a workflow must not claim the package agent's tool restrictions while a shadowing definition is in effect.

### 7. Update safety leaves the review digest input set and the acceptance claim undefined

Severity is Major.
Section is "Import and update contract".

The review digest binds the candidate source manifest and adaptation-policy content. The design never defines which files count as adaptation policy. The adapter registry, exact patches, agent templates, gap notices, the scanner term table, the role registry, and the generator code all shape generated output. If the digest covers only a policy file, a maintainer can review a proposal, edit a generator template, and accept under the old digest. Generation then produces resources nobody reviewed, and `check` passes because it compares against the same changed code.

The same section says acceptance has one checkout writer and refuses a concurrent acceptance. It names no mechanism. A claim taken before publication and left behind by a killed process can block every later acceptance with no stated way to judge it stale, even though the section also promises that repeating acceptance repairs a partial publish.

Failure scenario. A maintainer interrupts acceptance, reruns it, and is refused by a leftover claim whose owner no longer exists. Or two acceptances race a check-then-write claim and both publish. Either outcome breaks the update contract the brief scores highest after fidelity.

Smallest repair. Define the digest input as a sorted, content-addressed list that names every policy input, including generator code and templates, and state that any change to a listed input invalidates the digest. Specify the claim as an atomically created directory or exclusive file that records owner, proposal digest, and start evidence. State how a later run judges the claim stale and what the explicit repair is. Add Verification gate 1 cases for a digest invalidated by a template-only change and for acceptance rerun after an interruption that leaves the claim behind.

### 8. The one-shot command promise is stated before the prototype that can falsify it

Severity is Major.
Section is "Goal and consumer contract" and "Runtime contract", Mode, paragraph three.

The goal section shows `/poteto-mode Inspect and fix the parser.` as ordinary usage. The runtime section correctly makes forwarding in TUI, RPC, print, and JSON modes a prototype gate and allows a documented native invocation route as the fallback. The two statements are in tension. The fallback is a different consumer contract, so the goal section currently promises what the runtime section admits may be false.

The uncertainty is real and source-observed. In Pi 1.5.0, `ExtensionAPI.sendUserMessage` returns `void`. Only the replacement-session context returns a promise. Awaiting the extension call therefore cannot by itself keep a print or JSON process alive. The reference port README records the same failure on Pi 1.4 and routes one-shot users to `/skill:poteto-mode <task>` instead.

Failure scenario. Implementation proceeds against the goal contract, the prototype later shows that a print-mode task exits before the forwarded turn settles, and every workflow that assumed task forwarding needs rework after the runtime has spread.

Smallest repair. Split the consumer contract into the guaranteed part and the conditional part before implementation starts. The guaranteed part is the bare toggle, the off form, and the native skill route. Mark task-bearing `/poteto-mode` forwarding as pending the prototype verdict, with pass evidence required per surface, including the busy follow-up case. Record the chosen route in the runtime section and amend the goal example to match before any forwarding-dependent code lands. Keep Verification gate 5 as the evidence, and name `agent_settled` rather than `agent_end` as the wait target for real runs.

### 9. Generated link targets have no disposition

Severity is Medium.
Section is "Maintainable adaptation strategy", steps 2 and 6, and "Import and update contract", Checks.

Generated resources retain the upstream relative layout where possible. Skills link outside their own directory. `poteto-help/SKILL.md` links to `../../docs/guide/02-poteto-mode.md`. From `generated/` that link needs a deliberate target. It can resolve to a generated guide, to the snapshot path, or to nothing in the tarball. The checks section says local links are covered, but no rule states the intended destination per link class. A check without a stated expectation produces implementer-by-implementer rewrites at the first failure.

Failure scenario. The packed package ships skills whose guide links resolve inside the maintainer checkout but not inside the installed tarball, because the checkout had the snapshot beside `generated/` and the tarball `files` set placed it elsewhere. The link check passed in the wrong tree.

Smallest repair. Add a short link disposition rule. Links inside the generated tree stay relative. Links to preserved source point at the snapshot path as shipped. Links to material excluded from the tarball point at the pinned upstream URL or are removed by an adapt disposition. Run the link check against the packed artifact as well as the checkout, which Verification gate 7 can absorb.

## Cross-judgment of the two candidates against the rubric

| Criterion | Muse | Sol | Judgment on the synthesis |
| --- | ---: | ---: | --- |
| Upstream fidelity | 4 | 5 | Correct. Sol keeps all 573 files and the original names. Muse drops `make-bot-ui` from the registered names, and the synthesis rightly rejects that. |
| Update determinism and drift review | 3 | 5 | Direction correct, closure incomplete. Findings 2 and 7 show the digest inputs and the role inventory still need the same rigor as the byte manifest. |
| Native pi integration | 4 | 3 | Correct with a caveat. Rejecting Sol's binding guard keeps native workflow composition intact. Finding 5 shows the price. Without a guard, exact-selection claims depend on the resolver reading the same scope and ceiling state that pi-subagents enforces at launch. The design must state that the resolver reads that state, since it cannot intercept the launch. |
| Honest capability boundaries | 5 | 5 | Correct. Both candidates refuse cloud and service parity, and the synthesis keeps Benny dormant and the bot UI as a notice. Finding 4 is about typing that honesty, not about the stance. |
| Reproducible verification | 4 | 5 | Correct as a plan, unproven as a result. Gates 4 to 6 are the right shape. Findings 3, 5, 6, and 8 add the cases that decide whether the gates prove the contract or only the happy path. |

One synthesis sentence needs narrowing. The runtime "exposes validated effective role selections" and adapted instructions "check actual results". After Finding 5, that sentence is only true if validation includes the pi-subagents policy snapshot at resolution time and the status check re-reads it, because project trust or a settings edit can change enforcement without any pstack file changing. State that dependency in "Roles" rather than letting the sentence read as a standing guarantee.

## Residual test gates

No gate below was run by this review. Each remains a condition on any later implementation acceptance.

1. The command-lifetime prototype across TUI, RPC, print, and JSON, including a busy session follow-up, with the chosen route written back into the design.
2. Scripted-provider SDK tests in an isolated agent directory for mode on, off, native skill activation, custom-message wakes, reload, resume, fork, and tree navigation, asserting the provider-visible prompt and the branch state.
3. Packed-artifact discovery tests asserting the exact skill set, Benny absence, gap notice presence, agent discovery, and `sourceInfo` ownership under a deliberately colliding fixture package.
4. Native child tests asserting actual model attribution, panel order, retained output, and completion delivery, plus the scope, ceiling, and unavailable-selector cases from Finding 5.
5. Loop and monitor tests proving a provider-visible follow-up turn, bounded fire counts, stop behavior, and no claim of delivery after host restart.
6. Importer fixtures for interrupted acceptance with a surviving claim, template-only digest invalidation, mode-only drift, unknown entry kinds, and a second generation with no diff.
7. A separate optional live-model evaluation for workflow prose quality. Scripted providers prove host contracts. They cannot prove that a model follows the adapted instructions, and the report must keep saying so.

## Scope note

This review proposes no executor, cloud service, daemon, or RPC bridge. It keeps scheduling with pi-loop, child execution with pi-subagents, and this package limited to the snapshot, the adaptation policy, and the small native extension. No-comments is not applicable yet because no implementation comments exist. It remains an implementation-review gate.
