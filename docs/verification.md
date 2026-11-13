# Verification reference

The contract suite uses a local scripted provider with no network implementation. CLI child environments replace the ambient environment and use isolated home, agent, session, and dependency-state directories. SDK tests use explicit local auth and model files. Native child tests explicitly load the scripted provider, bundled context and required native supervision extensions. Context integration tests also load a nonce tool and a local stdio MCP fixture.

These tests establish host API behaviour. They do not establish that arbitrary models obey every prose instruction.

## Reproduce the checks

```sh
npm ci --ignore-scripts
npm run check
npm run typecheck
npm test
```

The optional `MSTACK_GIT_TESTS=1 npm test` check also inventories the pinned commit from `.cache/cursor-plugins`. The default suite inventories a hermetic Git fixture with nested paths, spaces, Unicode, and executable modes, without fetching or requiring a cached upstream repository. `MSTACK_KEEP_TEST_ARTIFACTS=1 npm run test:native` retains native completion records, provider requests, the child output, and native run state at the directory printed by the test.

The suite requires Git, tar, Python 3, a POSIX terminal, and installed development dependencies. It uses standard `npm pack --ignore-scripts` without changing tarball contents.

## CLI and SDK attribution

`node scripts/attribution.mjs --output attribution.json` records separate CLI and SDK identity observations. Without `--output`, the script prints JSON to stdout and writes no manifest file. Run it from the repository root.

The CLI path follows `tests/helpers.mjs`, including `MSTACK_PI_CLI`. Package metadata and sanitized `--version` output remain separate. SDK identity comes from module resolution, without importing the SDK. Missing identities appear as unavailable values, not fallback versions. The version probe uses a temporary home, a ten-second timeout, and a 4096-byte output limit.

If scratch cleanup fails, the script preserves the manifest and prints a fixed warning to stderr without error details or scratch paths. Temporary files may remain.

Git probes receive only `PATH` from the ambient environment, so ambient `GIT_*` overrides cannot redirect repository observations away from the working directory. The manifest includes repository, Node, and OS observations. It records only presence booleans for ambient `MSTACK_PI_CLI` and `PI_PACKAGE_DIR`, not an environment dump or credentials. Absolute paths can contain local usernames. Treat the manifest as local evidence and review it before sharing.

The test job generates one manifest before checks. CI is configured to upload it separately with `if: always()` and 14-day retention, even when later tests fail. Actual failure retention remains unproven until a real CI run demonstrates it. The manifest does not enter the release artifact.

These are identity observations before tests, not execution attestation, proof that tests ran, a compatibility claim, or a verdict.

## Evidence by contract

| Contract | Executable evidence |
| --- | --- |
| Pinned source | `tests/importer.test.mjs` checks 573 records, 58 top-level skills, six executable source files, hashes, and modes. |
| Update review | `tests/update.test.mjs` stages Git additions, removals, content changes, and mode changes. Template-only edits invalidate the review digest. |
| Maintenance diagnostics | CLI tests reject malformed commands before filesystem changes. Acceptance tests report added, removed, and changed input paths and reject legacy or tampered inventories. |
| Recovery | Importer tests cover caught owner-write faults, replacement-lock preservation, retained proposals, lost-proposal recovery, live-lock exclusion, dead and foreign lock repair, two source-publication interruptions, generated backup recovery, metadata drift, and refusal to remove unowned files. |
| Rejection | Tests reject unsafe paths, arbitrary storage remaps, duplicate destinations, unsupported modes and schemas, missing mappings, stale roles, stale exact hashes, escaped template paths, and surviving model fallbacks. |
| Standard package | `tests/packed.test.mjs` unpacks the ordinary tarball and runs its shipped offline check. Export reconstructs all original source paths, hashes, and modes, including `.gitignore`. Names, visibility, MIT attribution, and dormant exclusions are checked. |
| Config and setup | `tests/runtime.test.mjs` and `tests/setup.test.mjs` exercise invalid config, full model IDs, ordered repeated panels, scope diagnostics, unsupported thinking, cancellation, declined confirmation, restrictive file mode, and stale-write refusal. The setup flow runs through actual RPC dialogs. |
| Mode and role prompts | Packed SDK and RPC tests capture provider-visible prompts with mode on and off, standalone skills, custom wakes, new and resumed sessions, forks, tree navigation, and reload. |
| Collision refusal | RPC exercises a competing extension command and a competing user skill. The foreign skill's `off` argument is not consumed, and no mode event is written. |
| Native dependencies | `tests/native.test.mjs` correlates an async child run ID with completion delivery and its bound output. A separate `monitor:done` custom wake must reach a later parent provider request. Captures assert role data and mode off on both native wakes. Enabled-mode custom wakes have separate SDK coverage, not enabled-mode native monitor/completion evidence. Cleanup checks require parent and child processes to exit. |
| Native policy | Native tests observe rejected global scope, strict inheritance, per-agent scope, and thinking-ceiling requests. Explicit parent selection defeats a conflicting native agent model override. `tests/runtime-regressions.test.mjs` also observes trusted project policy replacement despite conflicting user settings. Doctor labels merged settings as observations. |
| Runtime regressions | Real packed RPC tests preserve literal extension messages, leave near-match commands untouched, and refuse busy mode/default changes without persistence or queuing. Empty files and colon-bearing model IDs have targeted regressions. Custom slash and URL provider IDs have real SDK prompt tests for explicit and inherited selections. Unit tests block ambiguous combined IDs without substitution. |
| Adapter prose | `tests/adapter.test.mjs` checks mandatory gate wording and exact replacement outcomes. These are prose regressions, not model-compliance evaluations. |
| Statechart | `tests/statechart.test.mjs` runs the upstream offline CLI and recorded-output tests, then runs broken and fixed fixtures through a packed `node_modules` installation, directly and through symlinks in paths containing spaces. These default checks replay TLC output; they do not run Java. |

## Statechart execution and live verification

The Node launcher loads `pi-loader.mjs` before the TypeScript entry point. Its type-stripping hook applies only to the bundled statechart directory, allowing execution inside `node_modules` without changing the handling of other packages. The worker inherits the loader. Source remains pinned; the launcher and symlink-fixture adaptations are hash-bound in `port/patches.json`.

The offline regression suite is included in `npm test`. Run it separately with:

```sh
node --test tests/statechart.test.mjs
```

`.github/workflows/statechart.yml` tests npm-layout execution on Linux and macOS, including the minimum supported Node 22.19.0. Its separate live job uses Temurin 17.0.15+6 and TLC 1.7.4, verifying the jar's SHA-256 before execution:

```text
936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88
```

With `TLA2TOOLS` set to that verified jar's absolute path and `JAVA` set to the Java executable, reproduce the live checks with:

```sh
node --test generated/skills/statechart/scripts/test/corpus.test.ts generated/skills/statechart/scripts/test/tlc-out.test.ts
MSTACK_LIVE_TLC=1 node --test --test-name-pattern='live TLC' tests/statechart.test.mjs
```

The corpus tests compare real TLC results with retained reports and charts. The installed-package check requires the broken MediaPlayer model to exit 1 and the fixed model to exit 0. This establishes model-checking and packaging behavior, not equivalence between an arbitrary model and product code. Renderer validation remains separate.

## Mode input routing

`tests/mode-input.test.mjs` verifies short and multiline requests (including a space before the newline), removal of the `potete-mode` alias, completion-resource discovery, saved defaults across new sessions and process restart, explicit-off precedence across resume and fork, invalid-config refusal, image attachment preservation, foreign prompt collisions, and completed output in print, JSON, RPC, and a real TUI under a PTY. Role settings survive default changes. Native input transformation keeps the original run's lifetime rather than creating an unawaited forwarded run.

The following older forwarding probe remains as a regression demonstrating why mode routes now use the input hook instead of an extension command. The prototype uses actual Pi 1.5.0 entry points. Its command calls `sendUserMessage` with a native skill invocation and uses follow-up delivery when busy.

| Entry point | Forwarding command | Native `/skill:poteto-mode <task>` |
| --- | --- | --- |
| TUI under a PTY | Completed output observed. | Completed output observed. |
| RPC | Completed run observed. | Completed run observed. |
| Busy RPC follow-up | Prototype task reaches a later provider request. | Refused without a mode change or queued task. Idle retry completes. |
| Print | Provider request starts, but completed output is lost. | Completed output observed. |
| JSON | Provider request starts, but completed output is lost. | Completed output observed. |

Task-bearing short routes now bypass that prototype: the input hook transforms them to native `/skill:poteto-mode <task>` within the original prompt. Bare mode and off requests remain model-free. Busy activation, toggles, and default writes refuse explicitly. The prototype's void `sendUserMessage` return remains unsuitable as a lifetime guarantee.

## Adapter acceptance examples

These are reviewed instruction contracts with prose-only regression checks, not claims of a live-model evaluation. The governing text is in [the generated Pi adapter](../generated/docs/harness/pi.md), and contradictory Cursor fallback paragraphs have source-hash-bound replacements.

| Situation | Required disposition |
| --- | --- |
| Shipping has green CI but no independent real-product verification. | Block before arming or merging. CI is not the missing verdict. |
| A required UI verification has no control tool or demonstrated equivalent. | Block the dependent verification and shipment. Do not replace it with a placeholder. |
| An explicitly configured reviewer is unavailable. | Keep that reviewer and its dependent review blocked. Do not choose a nearby slug, family default, or omitted model. |
| Optional evidence is unavailable and no mandatory gate depends on it. | Label it missing. Do not invent coverage. Unrelated work can continue. |
| Two inherited panel entries resolve to the same model. | Preserve two samples without claiming cross-family review. Required diversity remains blocked. |

## Unverified areas

No renderer, Java, TLC, forge, paid-model, cloud-service, or external bot integration runs in the default suite. The separate live statechart job described below runs Java and TLC. Source hashes and lexical checks do not prove semantic equivalence for every workflow. The PTY test proves completed output, not human visual quality. Setup uses an exclusive models.json.lock, an optimistic stale-write check, and atomic rename. A pre-existing lock blocks setup rather than being silently removed.

Dependency tools can be present while native agent provenance or package versions remain unobservable to the extension. Doctor says unverified in those cases. The tests observe the pinned versions through the development installation and native package metadata, not by inferring versions from tool names.

The parent owns fresh independent implementation reviews and any final shipping decision. No publication, global package installation, remote PR, or commit is part of this verification.

## Skill authoring and session acquisition

Packed prose regressions scan active skill Markdown for surviving Cursor authoring dependencies and destinations. They check the self-contained authoring procedure, verification-skill paths, exact-path transcript scope, and cross-chat blocking rule. These checks catch known instruction defects. They do not establish that a model follows the procedure or discovers a skill from a natural-language prompt. Fresh model acceptance remains parent-owned.

The session acquisition command is verified against installed Pi 1.5.0 documentation and source. `docs/environment-variables.md` defines `PI_SESSION_FILE` for LLM-callable shell tools, not user-entered `!` commands. `docs/extensions.md` documents the opt-out and `sessionManager.getBranch()`. `dist/core/tools/bash.js` clears inherited session variables and injects the current session file only when a session context provides one. `docs/session-format.md` defines the header and branch entries. These paths are relative to `node_modules/@earendil-works/pi-coding-agent`.

The adapter test executes the documented `printf` and header-read commands through the installed Pi shell definition with a retained SessionManager. It also checks ephemeral sessions and disabled environment exposure. This proves that acquisition API contract, not arbitrary overridden or remote shell behavior. When the variable is absent, the workflow requires an exact authorized path and never scans private session directories. No `/session` path-discovery assumption is needed.

## Goals and context execution

`tests/goal-native.test.mjs` runs packed SDK goal ancestry, compaction, reload, idempotence, busy refusal, naming and authentication-rejection checks. RPC checks command provenance, suffixed collisions, foreign prompts and noncolliding skills. `tests/mode-input.test.mjs` includes real PTY goal, naming and removed-alias cases.

`tests/model-naming-native.test.mjs` runs the packed title tool through RPC. It covers title validation, duplicate calls, policy and rename races, cancellation, actual retry, navigation, compaction, resume, and forks. The scripted provider records actual declarations with Pi's `getCurrentTools(context.messages)` alongside raw request messages. Pi passes providers a `TranscriptContext`, whose tool declarations live in system messages rather than a `context.tools` property. These tests prove native behavior without paid inference, not model compliance. Ordinary post-tool continuation requests are counted separately from the absence of dedicated naming inference.

`tests/context-native.test.mjs` invokes a real local stdio MCP server and a custom tool inside native children. Nonces agree between server logs, tool results and provider requests. It checks relative extension loading, duplicate suppression, unchanged default allowlists, foreground and background context, and missing-provider, missing-tool, hidden-tool and declined-trust failures. It also distinguishes sanitized wrapper errors and bounded output from raw native events and `nestedCalls` metadata. The fixture contains a synthetic secret-like sentinel, not a credential.

Retain those records with:

```sh
MSTACK_KEEP_TEST_ARTIFACTS=1 node --test tests/context-native.test.mjs tests/goal-native.test.mjs tests/model-naming-native.test.mjs tests/mode-input.test.mjs
```

`tests/context.test.mjs` separately checks an uncooperative provider deadline and branch invalidation. `tests/environment.test.mjs` checks scoped merging, size bounds and file containment. These tests do not establish protection against hostile local processes with the same filesystem permissions.

The dependency tree pins Pi 1.5.0. To rerun subprocess RPC, PTY and native-child checks against an already installed compatible host without changing dependencies, set `MSTACK_PI_CLI` to that host's absolute `dist/bundle/cli.js`. The helper also directs native children to that host package. SDK imports and TypeScript checks still use the pinned dependency tree.

```sh
MSTACK_PI_CLI=/absolute/path/to/pi-coding-agent/dist/bundle/cli.js MSTACK_KEEP_TEST_ARTIFACTS=1 node --test tests/context-native.test.mjs tests/mode-input.test.mjs
MSTACK_PI_CLI=/absolute/path/to/pi-coding-agent/dist/bundle/cli.js node --test --test-name-pattern='packed RPC' tests/goal-native.test.mjs
```
