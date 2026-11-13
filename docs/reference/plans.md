# Saved plans and idle compaction

Both features are optional and off by default. They are independent native extension flags, read after native flag loading at session start.

```sh
pi --pstack-plan
pi --pstack-idle-compact
pi --pstack-plan --pstack-idle-compact
```

`/pstack doctor` reports each flag as on or off. That report is passive availability. Doctor never compacts, repairs, or writes plan state. Neither flag requires Poteto Mode, and neither enables the other. The flags are not stored in `pstack/models.json` or `pstack/environment.json`, so a restarted process opts in again. Child subagent runtimes keep the existing exclusion and expose neither feature.

## Saved plan tool

`--pstack-plan` registers one `pstack_plan` tool with three operations.

| Operation | Required arguments | Effect |
| --- | --- | --- |
| `read` | `action` | Returns the current state and revision. |
| `write` | `action`, `expectedRevision`, complete `plan` | Replaces the snapshot when the revision matches. |
| `clear` | `action`, `expectedRevision` | Appends a null-plan tombstone when the revision matches. |

A plan has a `title` and an ordered array of steps. Each step has a stable `id`, `text`, and one of `pending`, `in_progress`, `completed`, or `blocked`. Array position is order. Step IDs do not imply dependencies, and completed steps need not form a prefix.

| Bound | Value |
| --- | --- |
| Steps per non-null plan | 1 to 64 |
| Step ID | `[A-Za-z][A-Za-z0-9_-]{0,63}`, unique per snapshot |
| Title | 1 to 256 UTF-8 bytes |
| Step text | 1 to 1024 UTF-8 bytes |
| Serialized snapshot | at most 16 KiB |
| Escaped serialized plan | at most 18 KiB |
| Revision token | at most 1 KiB |
| Tool response | at most 20 KiB |

At most one step is `in_progress`. Whitespace-only text, unknown properties, and C0 or C1 controls other than newline and tab are rejected. Validation happens in the tool, so native argument coercion does not accept a value these rules reject. Oversized requests are rejected before append, never truncated. Accepted text is preserved exactly. The 16 KiB bound applies to JSON for `{version:1,plan}`. The independent 18 KiB bound applies to JSON for the plan after angle-bracket escaping. The 20 KiB output envelope reserves 2 KiB for state, revision, conflict metadata, or the transient message prefix. This policy also validates saved snapshots. A structurally valid plan can exceed either serialization bound and is then rejected or restored as unsupported.

### Revisions and stale writes

The revision is opaque. It is the SHA-256 base64url digest of a fixed-order JSON object containing version, per-runtime nonce, navigation generation, native session ID, and latest matching plan entry ID. The 43-byte token binds the complete identity, including long native IDs, and is compared exactly. It is neither reversible metadata nor an authorization capability.

Ordinary messages and compaction leave a revision valid because the latest plan entry is unchanged. A successful tree navigation increments the navigation generation. A runtime reload gets a new nonce, and a fork gets a new session ID. A write from any earlier runtime, navigation position, or fork conflicts even when the visible plan text looks the same.

The first valid mutation validates the request, then checks cancellation, feature availability, ownership, and runtime identity. It reads the current state, compares the revision, appends, and reads the branch back to build the next revision in one synchronous section with no intervening await or callback. Two writes with the same revision cannot both commit. There is no automatic merge, retry, force write, or reset.

A conflict returns the current bounded state and revision without appending. Recovery is to read the returned revision and rewrite. An identical write with the current revision succeeds without appending, and a repeated `clear` with the current revision is a no-op. The first `clear` always appends a tombstone, even when no plan existed.

Cancellation before commit writes nothing. An append error is reported as a storage error, not success. A cancellation or lost result after commit does not undo history; read again before retrying. This is compare-and-append inside one runtime. It is not a transaction across separate processes writing the same session file.

The derived state is absent, present, cleared, or unsupported. A malformed or future-version latest entry masks older entries instead of silently selecting an older valid plan. A valid `write` or `clear` with the returned revision replaces unsupported state. The unsupported diagnostic is bounded and never includes the raw invalid payload.

### Branch, compaction, and provider visibility

The latest matching custom entry on the active native branch is authoritative. That ancestry includes entries excluded from the compacted model projection, so compaction does not drop or copy a plan. Tree navigation exposes only the target ancestry, a native fork inherits the snapshots included at its cut rather than necessarily the parent's latest, and a new session starts absent. Fresh delegated children do not read a parent session.

Native tool selection remains authoritative. Deactivating `pstack_plan` stops fresh restoration and its owned prompt section on subsequent runs, without widening the active tool set. Reactivation restores the latest snapshot. Historical tool results and session messages remain in history.

Before each provider request the extension derives the current state and adds one transient owned message, removing duplicates of the same owned type first. It states absent, cleared, and unsupported explicitly so an older summary is not mistaken for current state. Nothing is persisted by this restoration, and no message is sent or step executed automatically. Tool continuations and requests after in-run compaction see the latest state because the message is built per request.

Plan text reaches the provider and is written to the session file when Pi persists the conversation. JSON is escaped for angle brackets, but that does not remove prompt injection or make a model obey the text. The owned prompt section and message say the state is saved working memory, possibly model-authored, and not operator authority, evidence of completed work, or permission to bypass gates.

Pi defers session persistence for conversation-less sessions. A plan written before the first saved conversation can therefore stay memory-only, and native persistence does not guarantee fsync durability. Clearing a plan or disabling the flag does not delete historical tool results or session entries.

## Automatic idle compaction

`--pstack-idle-compact` asks the extension to compact once when context usage crosses a policy threshold at a final idle boundary. It does not replace native automatic or manual compaction, and it does not add a command or tool.

The helper is an explicit state machine with armed, running, disarmed, and closed states. It is evaluated only in `agent_settled`. Startup, reload, navigation, `turn_end`, and `agent_end` never trigger it. Admission requires a non-aborted settlement, an idle session, no pending messages, a present model, finite known usage, matching model and session identity, and no compaction already running.

The trigger is 80 percent context usage. A disarmed helper rearms only after a later settled observation at or below 70 percent. These are policy defaults, not measured optimum values and not replacements for Pi's native compaction settings. A model or session change resets local state, so the next settlement re-evaluates from armed.

Before invoking compaction the helper rechecks idle state, pending messages, identity, and single-flight state. It enters running and calls the native compaction entry point with completion and error callbacks, then awaits a local promise resolved by those callbacks. Holding the settled dispatch keeps newly submitted work behind compaction through native prompt deferral.

Failure, cancellation, or an ineffective summary disarms the helper, so high usage does not start repeated paid attempts. Nothing is retried, resumed, rewritten, or injected. The extension never performs an abort-and-resume sequence, never enqueues a synthetic message, and never starts a timer, polling loop, or background work.

Native manual compaction calls its own internal abort before summarizing, even when it starts from idle. The guarantee is that this extension never manages an abort-and-resume flow, not that native code never calls an abort method. Native cancellation, retry, and `session_before_compact` hooks remain authoritative. Shutdown closes the helper and releases any local waiter, and late callbacks from an obsolete context are ignored.

The helper does not reserve idle state atomically against concurrent SDK or third-party extension activity. Another actor can start its own compaction between the idle check and the native call; native single-flight handling then decides the outcome. Pi 1.5.0 also lacks the newer direct-SDK reload guards, so reload behavior inside one process remains host-defined.

### Cost intent and limits

Compaction is admitted by context usage, not by prompt-cache age. This feature does not know when a provider evicts a cache, does not guarantee a cache hit, and does not promise lower total cost. Summarization consumes tokens and can change later cache reuse, and the helper skips compaction below the threshold even when a cache is about to expire. Native cache warming and native automatic compaction are unchanged. No measured cost or latency claim is part of this behavior; a cost evaluation must compare complete workloads including summary input, output, cache reads, cache writes, and subsequent turns.
