# Goals, naming and context reference

## Branch goals

`/goal` shows the current branch intent. `/goal <text>` sets it without a model request. `/goal --clear` clears it. `/goal -- <text>` escapes reserved arguments. Text is limited to 4 KiB of UTF-8. Control characters other than newline and tab are rejected. Mutations refuse while Pi is busy. Repeating the same value does not append another event.

Goals use native `pi-mstack/goal` custom entries with `{ "version": 1, "text": "intent" }`, or `null` for a clear. Active ancestry determines the goal, independently of mode and compaction. An unsupported event disables the older goal until an explicit set or clear replaces it.

Pi owns persistence. Metadata-only changes in a fresh session remain in memory until Pi persists a conversation. The extension does not force a flush, create a sidecar, or fabricate a user message. Goal text reaches the model in an owned prompt section on later runs. A fresh child receives its goal in the parent's task brief, not through access to the parent's session.

Goal ownership is independent of mode ownership. A competing extension command, suffixed command or prompt named `goal` blocks this package's goal mutation and automatic naming. A skill named `goal` uses `/skill:goal` and does not collide. Bare ambiguous `/goal` is consumed with a diagnostic, not sent to the provider. Foreign suffixed commands remain foreign.

## Session names

The default policy names a never-named session from its first accepted plain task, canonical mode task or nonempty goal. A single distinct uppercase Jira-style identifier wins, for example `TEAM-123`. Otherwise the normalized task text becomes the title. Titles stop at 80 Unicode code points. No naming model or Jira lookup runs.

Task text is captured as delivered to mstack's input handler, before skill expansion. Earlier input extensions can already have transformed that text. Pi does not expose the original text at this hook, so a name can reflect an earlier transformation. Naming waits for the matching accepted run after native authentication checks. Input consumed or changed after capture, busy input, unknown slash commands, mode-only commands, custom wakes and extension-origin input do not name sessions. Bundled child sessions do not load parent naming behavior.

The versioned `pi-mstack/naming-attempt` entry is written before the native name. Any prior attempt or native `session_info`, on any branch, seals automatic naming. Explicit names and clears are preserved. An interrupted attempt is not retried.

## Environment configuration

`PI_CODING_AGENT_DIR/pstack/environment.json` is the user file. The default agent directory is `~/.pi/agent`. An explicitly authorized, natively trusted project can provide `.pi/pstack/environment.json`. The project directory name follows Pi's exported `CONFIG_DIR_NAME` in rebranded hosts. This file does not change `pstack/models.json` or Pi's model catalogue.

```json
{
  "version": "pi-mstack/environment/1",
  "naming": "task",
  "glossary": [
    { "term": "Jira", "meaning": "Our issue tracker. No Jira provider is configured here.", "availability": "unavailable" }
  ],
  "sources": [
    { "id": "notes", "kind": "memory", "path": "/absolute/path/to/notes.md", "delivery": "automatic" },
    { "id": "docs", "kind": "mcp", "tool": "mcp__docs__search", "queryArgument": "query" }
  ]
}
```

The user file accepts `naming` as `task` or `off`. Project files cannot change naming policy. Missing files mean task naming, no glossary, and no sources. Invalid user or authorized project configuration disables environment features and reports a diagnostic. Configuration is read again at each run and goal command. On-demand retrieval also revalidates it.

Glossary entries have `term`, `meaning`, and `availability`, which is `available`, `conditional` or `unavailable`. Exact case-sensitive project terms replace user values in place. New project terms follow user terms. One owned prompt section renders the definitions. The extension does not rewrite skill words or equate services.

Memory sources have `id`, `kind: "memory"`, `path`, and `delivery`, which is `automatic` or `on-demand`. User paths must be absolute explicit authorizations. Project paths resolve from the session cwd and must remain inside the canonical project. Project symlink components and final file symlinks are rejected. Files must be regular and at most 64 KiB. Missing or unsafe memory is a retrieval failure, not evidence.

MCP sources have `id`, `kind: "mcp"`, the exact native `mcp__server__tool` identity, and `queryArgument`. The environment file cannot launch a server, store credentials, grant tools, or select shell or HTTP adapters. Native Pi configuration owns those capabilities.

Configuration files are limited to 64 KiB. The merged glossary is limited to 32 entries and 8 KiB of serialized JSON. The merged source list is limited to four entries in user-then-project order. IDs must be unique across both scopes. Unknown fields are rejected.

### Project authorization

Project environment loading requires both native project trust and an exact grant in the user agent directory's `pstack/environment-grants.json`.

```json
{
	"version": "pi-mstack/environment-grants/1",
	"projects": ["/absolute/canonical/project"]
}
```

Each entry is an absolute canonical directory path, as reported by `pwd -P` inside that project. Grants match only that exact root. They do not cover parents, children, siblings, path prefixes, or globs. A symlink alias for the current working directory resolves to its canonical root before matching. Grant entries themselves must be canonical, existing directories.

The grant file accepts only `version` and `projects`. It is limited to 64 KiB, 256 entries, and 4096 characters per path. Missing, malformed, unreadable, or unsafe grants authorize no project. One invalid entry invalidates the grant file. Grant files must be regular files without symlink components below the user agent root. Storage inside the current canonical project cannot authorize that project. Project-local grant files and self-approval fields have no authority.

Native trust alone is not authorization. Pi can implicitly trust a directory that contains only custom environment configuration. Conversely, native denial, including `--no-approve`, overrides an exact grant. Saved native approvals and CLI approval do not replace the grant file.

Ignored project configuration is detected through path metadata without reading its contents or discovering its sources. Malformed ignored content cannot disable valid user configuration. A diagnostic names the JSON-quoted ignored path once per session and path across both extension entry points. The diagnostic goes to the UI or stderr, never model context. An absent project configuration produces no diagnostic. Diagnostic keys remain in memory for the process lifetime.

Grants authorize future content at the same canonical path, not a reviewed content digest. Grants are read again at startup, each run, each goal command, and each on-demand retrieval. Startup does not retrieve sources. Removing a grant denies the next load. Adding it again permits the next load if native trust remains active. Revocation cannot retract previous provider requests or historical tool results, and does not cancel an in-flight retrieval. File checks do not provide a sandbox against concurrent filesystem changes by another process running as the same user.

See [authorize project context](../how-to/configure-context.md#authorize-project-context) for manual grant editing.

## Retrieval and privacy

The separate packaged context extension registers `pstack_context({ source, query })` inactive by default. Operators select it through native tool configuration. It dispatches only a configured source. MCP targets must be callable in the current session through `ctx.executeTool()`. Native permission hooks and exposure rules still apply. Source configuration never widens an allowlist.

Automatic memory is transient attributed conversation data, not a system instruction or native history entry. It is read once per run and reused across tool follow-ups. The next run refreshes it. Tree changes and session replacement clear it. On-demand retrieval produces a real tool result that can persist in the transcript.

Automatic memory and on-demand results reach the model provider. Legacy retrieval results are evidence, not authority. Role mutation receipts below are not evidence. Optional retrieval failure does not block an ordinary task, but cannot satisfy an explicit evidence requirement.

Each wrapper result, including attribution, is limited to 16 KiB. Automatic results together are limited to 64 KiB. Queries are limited to 2 KiB. Retrieval waits at most two seconds even when a provider ignores cancellation. Shutdown and branch changes cancel waiting and suppress stale successful delivery. Native connection startup and permission handling have their own lifecycle and limits. Cancellation cannot force an uncooperative provider to stop its underlying work.

These limits and sanitized failure messages apply to pi-mstack's output only. Native nested tool events can expose raw upstream results and errors. Native `nestedCalls` metadata can retain queries and raw errors, including secret-like values. The MCP service and model provider have separate retention policies. This wrapper is not an end-to-end redaction boundary.

See [configure child context tools](../how-to/configure-context.md) for a complete native tools override and MCP example.

## Context roles

The optional `roles` field maps `docs`, `memory`, `tracker`, and `wiki` to named operations. Role names describe intent, not provider capabilities. Each role accepts at most eight operations after user and authorized project configuration are combined. Duplicate role-operation pairs invalidate the aggregate. Project trust and exact user grants apply unchanged.

```json
{
	"version": "pi-mstack/environment/1",
	"roles": {
		"tracker": {
			"update": {
				"effect": "write",
				"target": { "tool": "mcp__tracker__update", "selector": "tracker/update" },
				"inputs": { "key": { "type": "string" }, "state": { "type": "string" } },
				"template": { "key": { "$arg": "key" }, "state": { "$arg": "state" } }
			}
		}
	}
}
```

An operation requires `effect`, `target`, `inputs`, and `template`. `effect` is `read` or `write`. `target.tool` is the exact native MCP tool name, limited to 256 UTF-8 bytes. Native punctuation collisions can add hashes. The optional `target.selector` is a raw `server/tool` identifier, also limited to 256 bytes. It accepts letters, digits, underscores, and hyphens in server names, plus periods in tool names. Wildcards, prefixes, modifiers, and additional path segments are rejected. The dispatcher uses `tool` without deriving it from `selector`. A selector is unverified operator data, not identity proof or a grant.

Inputs are a closed map of at most 16 required scalar declarations. Each declaration contains only `type`, which is `string`, `number`, or `boolean`. Operation and input names start with a letter and contain at most 64 letters, digits, underscores, or hyphens. Unknown fields and prototype-sensitive keys are rejected. Missing, extra, mistyped, undeclared, and unused arguments are rejected.

Templates are finite literal JSON objects. An exact `{"$arg":"name"}` leaf substitutes the whole supplied scalar value. Repeated references are allowed. No interpolation, evaluation, environment expansion, dynamic target, or arbitrary object input exists. Literal objects containing `$arg` cannot be represented. Templates allow depth four below the root, 256 total nodes, 16 fields per object, and 16 items per array. Strings are limited to 8 KiB of UTF-8 and numbers must be finite. Request arguments and rendered target arguments each have an independent 8 KiB serialized UTF-8 limit. Repeated substitution can exceed the rendered limit even when a request fits. Native target schema validation remains authoritative.

The inactive-by-default `pstack_context` tool accepts either the existing `{source, query}` form or `{role, operation, args}`. Mixed forms are rejected. For example, the operation above accepts `{"role":"tracker","operation":"update","args":{"key":"TEAM-123","state":"done"}}`. The selected operation must still equal the discovery snapshot when execution reloads configuration. A changed mapping or revoked project grant refuses dispatch until a fresh run.

Read operations return attributed evidence or an unavailable result. Write operations return mutation receipts, never evidence. Before native invocation, failures report `not-dispatched`. After invocation, native errors, permission denials, cancellation, timeout, and lost responses report `unknown-outcome`. A successful native response reports `reported-success`, not independently verified remote state. Mutation receipts include the parent call ID and exact target after dispatch. The call ID is correlation data, not an idempotency key. Pre-dispatch validation failures contain only a bounded diagnostic. Call IDs over 1 KiB refuse dispatch rather than exceed the receipt bound.

Reads wait at most two seconds and writes wait at most 30 seconds. These are wrapper deadlines, not approval-latency guarantees. Cancellation stops waiting, not remote effects. There is no automatic retry, rollback, or exactly-once guarantee. Startup, automatic context, and doctor never invoke role operations. Writes require a currently callable target whose public `sourceInfo.path` is `builtin:mcp`. Alternate adapters are unsupported for writes. Legacy sources retain their existing behavior.

The wrapper declares conservative mutating annotations. Operator effect labels do not prove semantic read-only behavior. Native permissions apply to every nested call, and target grants authorize the entire native tool rather than the template's argument subset. Unclassified legacy sources are not approved future explorer grants. This feature adds no child grant enforcement.

Wrapper text, including receipt metadata, remains limited to 16 KiB. Receipt JSON stays parseable when summaries are truncated. These bounds do not redact native nested records, upstream services, or provider requests. Do not put credentials in templates or arguments.

`/pstack doctor` reports each operation's effect, exact native target, selector status, and current availability. Availability distinguishes unregistered, hidden, model-only, inactive-direct, and callable-snapshot states. A missing selector is not grant-ready. A configured selector remains unverified. Doctor performs no tool calls, activates no tools, and promises neither authentication nor future permission.
