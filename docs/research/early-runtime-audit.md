# ISSUES

The goal is faster delivery of a maintainable Cursor pstack port using native Pi, pi-loop, and pi-subagents. This early audit found four runtime issues. It is not final acceptance.

Audited frozen snapshot `/tmp/pi-mstack-swarm.gOVVUb`. SHA256 of `SNAPSHOT.sha256` is `62b285c5d2ffe0e66b97cc32ff2309d4473633a453bb004dabcef837513a5bc2`. Its listed file checksums passed again after testing. No Git HEAD was assumed or queried. Source and the node_modules symlink were not modified.

Host source paths below are relative to `node_modules/@earendil-works/pi-coding-agent`. Native pi-subagents paths are relative to `node_modules/pi-subagents`.

## Proven findings

### 1. P2. Literal extension messages change mode and disappear

`extensions/pstack/index.ts:58-65` treats every matching input as a native command without checking `event.source`.

Pi 1.5.0 explicitly makes `sendUserMessage` expansion opt-in. The installed host's `dist/core/agent-session.js:1928-1955` defaults `expandPromptTemplates` to false but still emits input with source `extension`. Therefore resource ownership alone does not establish invocation intent.

Reproduction used a temporary extension command whose handler calls `pi.sendUserMessage('/skill:poteto-mode off')` without options. After enabling mode, invoking that command produced a disabled custom entry, zero provider requests, and no literal message. An unrelated extension's non-expanding user message was consumed as a mode command.

The same parser also accepts delimiters the host does not. `/skill:poteto-mode\tTAB_TASK` enabled mode, but the provider received that literal text without a skill block. Pi's `_expandSkillCommand`, at `agent-session.js:1745-1761`, splits only on an ASCII space.

Smallest fix is to restrict interception to approved invocation sources and match the host's command grammar. Leave literal extension traffic alone unless an explicit activation contract exists. Add source and tab/newline tests, including preservation of the literal message.

### 2. P2. An existing empty config silently becomes inheritance

`extensions/pstack/config.ts:35-38` tests the file contents for truthiness instead of testing whether the file exists. An existing zero-byte `pstack/models.json` returns a valid default config. This suppresses the required invalid-config diagnostic and permits setup to replace it through `extensions/pstack/index.ts:99-128`.

Reproduction created an empty file. `loadConfig` returned `{"kind":"valid","original":"","config":{"version":"pi-mstack/1","roles":{}}}`. Passing that state through `saveConfig` replaced the empty file with inheritance defaults. Thus a truncated file can silently lose its previous explicit model restrictions.

Smallest fix is to default only when `original === undefined`. Parse every existing file, including an empty one. Add tests that empty files block role use and setup without changing bytes.

### 3. P2. Doctor reports a native policy that does not exist

`extensions/pstack/index.ts:81,92` passes `pi.getSettings()` into `policyStatus`. `extensions/pstack/config.ts:101-105` then presents that object's scope fields as native policy.

These settings have different merge contracts. Pi recursively merges nested settings in installed `dist/core/settings-manager.js:19-32,95-99`. Native pi-subagents replaces the complete user `modelScope` with the project object, as documented in `docs/models.md:223` and implemented in `src/agents/agents.js:2579`.

Reproduction configured a user scope with strict inheritance and a `comment-sicko` restriction allowing only `mstack-test/other`. The trusted project scope contained only enforcement and an allow list for `mstack-test/script/model`. Doctor reported strict inheritance enabled and retained the user per-agent restriction. Native execution successfully ran `comment-sicko` with `mstack-test/script/model:off`. Those reported restrictions were not effective.

Smallest fix is to label the public merged settings as observations whose native precedence is unverified, rather than calling their fields effective policy. Use public native metadata if available. Add a trusted project-over-user replacement test with HOME separate from the project directory.

### 4. P2. Busy disable leaves mode enabled for queued follow-ups

`extensions/pstack/index.ts:43-46,58-64` persists and acknowledges toggles immediately, including while streaming. The instruction section changes only in `before_agent_start`, at lines 76-81.

Reproduction enabled mode, started `BUSY_ON`, submitted `/skill:poteto-mode off` as a follow-up, then queued `AFTER_OFF`. The off request returned `handled` and wrote disabled state. Both provider requests, including the request processing `AFTER_OFF`, still contained `<pi-mstack-mode>` and its assertion that mode was enabled. Queued follow-ups do not start another host run, so this hook does not refresh their prompt.

Smallest fix is to propagate a mode change before processing queued follow-ups, or explicitly defer/reject busy toggles rather than claiming they have taken effect. Extend `tests/packed.test.mjs:96-100` to assert provider-visible state, not only delivery text.

## Validation and passing behavior

All execution used isolated copy `/tmp/mstack-runtime-audit.1KIoxl`. Commands were `npm run typecheck` and `node --test tests/runtime.test.mjs tests/setup.test.mjs tests/sdk.test.mjs tests/packed.test.mjs tests/native.test.mjs`. Typecheck passed. Twelve tests passed and one failed.

The failure was `tests/packed.test.mjs:19`. Packed `tools/upstream.mjs check` rejected stale adaptation acceptance with `Adaptation inputs changed or acceptance invalid`. This frozen package is not ready for acceptance. Review and renew the bound digest after fixes, without bypassing that gate.

Passing tests exercised real branch-local reduction, resume, fork, tree navigation, reload, native collision refusal, role data with mode off, custom wakes, transactional cancellation, restrictive config permissions, native policy rejection, retained scripted child output, and monitor delivery. Print/JSON forwarding started one request but retained no completed output. The documented native skill route completed in both modes and through the PTY. Keeping task-bearing short commands unsupported is justified.

Evidence is retained in `tests.log`, `probes-2.log`, `empty-save.log`, and `probe-results/*-2/evidence.json` under the isolated copy. `audit-probes.mjs` records the reproductions. These deterministic-provider results prove host contracts, not real-model compliance with workflow prose.

**Principles applied.** Prove It Works changed the verdict to actual provider transcripts and native results. Type System Discipline changed the input review to use Pi's declared source and expansion contracts.

Recommended next step is a narrow runtime fix round with these regressions, followed by fresh artifact acceptance and independent review.
