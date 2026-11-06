# Verification audit

## ISSUES

The goal is faster delivery of a maintainable full Cursor pstack port to pi. This early audit checks whether the frozen tests prove the packaged consumer behavior. It is not final approval.

Snapshot manifest SHA256 is `62b285c5d2ffe0e66b97cc32ff2309d4473633a453bb004dabcef837513a5bc2`. No Git HEAD was used. `shasum -a 256 -c SNAPSHOT.sha256` passed for every listed file.

I read the requested Poteto skill, `docs/design.md`, all seven test modules, `tests/helpers.mjs`, `tests/pty-smoke.py`, and both provider/prototype fixtures.

## Isolation and commands

Before testing, I copied the snapshot with `tar --exclude=node_modules --exclude=.pi -cf - .` into `/tmp/pi-mstack-verification.qKpGlG`, abbreviated below as `$A`. Only this private copy received test outputs. Its `node_modules` symlink points to the existing dependencies. macOS `sandbox-exec` enforced read-only access to `/Users/asper` and the frozen snapshot, denied all network operations, and denied reads of the ambient `.pi`, `.aws`, `.ssh`, `.config`, `.npmrc`, and `.gitconfig` paths. No source or live-repository files changed.

The test launcher used this environment and sandbox prefix:

```sh
env -i HOME="$A/audit-home" TMPDIR="$A/audit-tmp" \
 PATH="/Users/asper/.local/share/mise/installs/node/26.1.0/bin:/Users/asper/.local/share/mise/installs/python/3.14.4/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
 PI_OFFLINE=1 npm_config_offline=true npm_config_audit=false \
 npm_config_update_notifier=false MSTACK_KEEP_TEST_ARTIFACTS=1 \
 /usr/bin/sandbox-exec -f "$A/audit.sb" python3 -
```

The Python launcher ran the following commands sequentially with a 240-second limit per command and process-group termination on timeout. None timed out.

| Exact command within `$A` | Result |
| --- | --- |
| `node tools/upstream.mjs check` | Exit 1. Acceptance digest mismatch. |
| `node node_modules/typescript/bin/tsc` | Exit 0. |
| `node --test --test-concurrency=1 tests/importer.test.mjs tests/native.test.mjs tests/packed.test.mjs tests/runtime.test.mjs tests/sdk.test.mjs tests/setup.test.mjs tests/update.test.mjs` | Exit 1. 24 tests, 20 passed, 3 failed, 1 skipped. |

Versions actually loaded were Node 26.1.0, pi-ai 1.5.0, pi-coding-agent 1.5.0, pi-subagents 0.86.0, and pi-loop 0.7.19. No paid provider ran. Only fixture-controlled native children launched.

Logs remain in `$A/audit-logs/{check,typecheck,tests}.log`. The sandbox profile remains at `$A/audit.sb`.

## Observed failures

`check`, deterministic generation, tarball maintenance checking, and abandoned-lock repair all stop at `Adaptation inputs changed or acceptance invalid; propose and accept a fresh review digest`.

Stored acceptance is `f826b6ceaffeeb425af01474863e858bf2602de74006b342b0527715f6387624`. Computing `digest(process.cwd(), readJSON('upstream/manifest.json'))` gives `72e7dcfaf519de615ea2480161c19752820be1a06d6aef57559d95be3605b804`. Snapshot integrity still passes. This is a frozen-input mismatch, not a test-output collision. I did not rewrite acceptance to make tests green.

The skipped test requires `MSTACK_GIT_TESTS` and an absent upstream checkout. The passing local Git fixture separately proves inventory ignores working-tree edits.

## What the tests genuinely exercised

`packed()` executes real `npm pack --json --ignore-scripts --pack-destination`, then extracts the tarball. SDK, RPC, CLI, PTY, and native discovery load that package path. Native extensions come from the pinned installed dependencies, not mocks. The scripted provider replaces inference, not extension dispatch or child execution.

Retained evidence is `$A/audit-tmp/mstack-packed-oO4R3S/native/native-evidence.json`. Independent inspection confirmed parent PID 28467 and child PID 32737, the child's `script/model` selection despite the conflicting agent override, and `child.md` containing `native-child-retained`. Separate parent-provider requests ended with the actual `monitor:done` wake and native `subagent-notify` completion notice. Both included role data while mode was off. Both processes subsequently exited.

I also ran the packed maintainer implementation directly, bypassing only the earlier failing test's sequencing:

```sh
node audit-tmp/mstack-packed-oO4R3S/package/tools/upstream.mjs export \
 --root audit-tmp/mstack-packed-oO4R3S/package \
 --destination audit-tmp/exported-source
python3 audit-evidence.py
```

Export ran under the sandbox and exited 0. The audit-only checker passed all 573 reconstructed paths, hashes, executable bits, LICENSE, reserved `.gitignore` mapping, actual provider wakes, and process-exit checks. Results are in `audit-logs/evidence-check.log`. An initial inline checker had an escaped-quote matching error. The corrected checker matches literal completion text.

Print and JSON prototype forwarding recorded one request but no completed output. Native skill invocation completed. PTY, RPC busy follow-up, resume/fork, collision refusal, SDK navigation/reload, and setup tests passed.

## Minimal test improvements

1. **Require an actual monitor wake.** `native.test.mjs:36` first matches the assistant's `MonitorCreate` tool call because its arguments contain `MONITOR_PROVIDER_WAKE`. Line 44 searches the entire conversation, which also contains those arguments. Match `message.role === 'custom'`, `customType === 'pi-loop'`, and `details.trigger.source === 'monitor:done'`. Then require a new parent-PID provider request whose final message contains that wake. Removing wake delivery must fail the test.
2. **Assert enable and launch results.** The retained run contains `Tool subagents_enable not found`, yet the test passes. Branch on actual tool availability, and assert every expected tool result. Require successful launch, correlate completion with its run ID, and inspect the retained output after terminal completion.
3. **Wait for the final wake turn to settle.** Replace the native test's fixed 300 ms sleep with event-based completion plus `agent_settled`. Assert child termination during cleanup, including failure paths.
4. **Separate artifact checks.** `packed.test.mjs:19` aborts export, frontmatter, and license assertions when maintenance checking fails. Make those independent tests. Use the packed importer or CLI for export, rather than importing the checkout helper. Assert every advertised script references shipped files and exclude caches, credentials, and orchestration state explicitly.
5. **Strengthen PTY and CLI semantics.** PTY checks only the generic `scripted-complete` token. Also assert the captured task, absolute packaged skill path, and mode section. Parse JSON completion events. Keep unsupported short-command behavior distinct from the experimental forwarding probe.
6. **Add missing design-gate cases.** No tests exercise adapter acceptance examples for missing independent shipping verification, required UI control, or unavailable explicit reviewers. Add deterministic artifact assertions for those blocker instructions, clearly labeled as prose checks rather than proof of model compliance.

## Recommendation

Review the changed adaptation inputs before refreshing acceptance. Then implement the narrow assertion fixes and rerun the isolated packed suite. Scripted tests cannot establish arbitrary-model workflow compliance or Cursor service parity.

Throughput checkpoint is n/a, read-only investigation. Separate Before Serializing Shared State drove the private copy. Prove It Works drove retained-artifact inspection. Test Behavior, Not Implementation drove the wake-correlation recommendations. No production edits were made.
