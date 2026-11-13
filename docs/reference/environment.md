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

The user-only `model` policy offers `mstack_set_session_title` to the current model after an eligible accepted task. The tool starts inactive and is model-only. Its instruction asks for one call after the task is clear. It accepts 3-8 whitespace-separated words without ticket identifiers, controls, or format characters. The extension prefixes one distinct uppercase ticket from the accepted input. Multiple distinct tickets produce no prefix. The final title, including its prefix, must fit 80 Unicode code points. Invalid titles leave the attempt available for repair.

Model naming rechecks policy, session identity, cancellation, and naming history at execution. The attempt starts immediately before the native name write, not when the tool is offered. A failed write keeps the seal. Offers expire when the run settles or on navigation, reload, or session replacement. Retry and compaction recovery within the same run preserve the offer. A fork inherits only its copied history, so a fork before the seal can name its new session.

Under `model`, `/goal` still makes no model request and does not name the session. No dedicated naming inference or tracker lookup runs. An ordinary tool continuation can make another provider request to continue task work. The model may decline to call the tool, leaving the session unnamed.

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

The user file accepts `naming` as `task`, `model`, or `off`. Project files cannot change naming policy. Missing files mean task naming, no glossary, and no sources. Invalid user or authorized project configuration disables environment features and reports a diagnostic. Configuration is read again at each run and goal command. On-demand retrieval also revalidates it.

Glossary entries have `term`, `meaning`, and `availability`, which is `available`, `conditional` or `unavailable`. Exact case-sensitive project terms replace user values in place. New project terms follow user terms. One owned prompt section renders the definitions. The extension does not rewrite skill words or equate services.

Memory sources have `id`, `kind: "memory"`, `path`, and `delivery`, which is `automatic` or `on-demand`. User paths must be absolute explicit authorizations. Project paths resolve from the session cwd and must remain inside the canonical project. Project symlink components and final file symlinks are rejected. Files must be regular and at most 64 KiB. Missing or unsafe memory is a retrieval failure, not evidence.

MCP sources have `id`, `kind: "mcp"`, the exact native `mcp__server__tool` identity, and `queryArgument`. The environment file cannot launch a server, store credentials, grant tools, or select shell or HTTP adapters. Native Pi configuration owns those capabilities.

Configuration files are limited to 64 KiB. The merged glossary is limited to 32 entries and 8 KiB of serialized JSON. The merged source list is limited to four entries in user-then-project order. IDs must be unique across both scopes. Unknown fields are rejected.

### Harness mappings

The optional `mappings` object contains declarative question-tool, review-bot, and stack guidance. It does not execute commands, activate tools, load providers, request reviews, or grant authority.

```json
{
	"version": "pi-mstack/environment/1",
	"mappings": {
		"question": { "tool": "ask_operator" },
		"reviewBots": [{ "identity": "review-service[bot]", "request": "Request review through the installed forge integration." }],
		"stack": {
			"membership": "Inspect the stack CLI output for this exact repository and PR. Retain its stack identity.",
			"commands": { "push": "Use the installed stack CLI push operation." }
		}
	}
}
```

Each authorized project category replaces the entire user category. Absent categories inherit. An empty `mappings` object inherits all categories. `question: null`, `stack: null`, and `reviewBots: []` clear their categories. Stack operations never merge across scopes. Missing operations remain unsupported. The supported keys in `commands` are `create`, `link`, `rebase`, `push`, and `merge`. `membership` and `commands` are required when `stack` is present.

Tool names are limited to 256 characters. Bot identities are limited to 128 characters, with at most eight unique case-sensitive identities. Request, membership, and command strings are limited to 2048 characters each. Strings must be nonempty. Control characters other than newline and tab are rejected. Unknown keys are rejected at every level. Effective mappings are limited to 16 KiB of UTF-8 serialized JSON after category replacement. The existing 64 KiB input-file bound also applies.

Malformed user or authorized project mappings disable the entire environment aggregate, including naming, glossary, and context sources. Unauthorized project mappings are not read. Exact user grants and native project trust still apply.

One owned `pi-mstack-mappings` prompt section refreshes each run. Empty or invalid configuration removes the section. Operator values use JSON encoding with escaped angle brackets to preserve the host's section delimiters. This encoding does not prevent prompt injection. Mapping text reaches the model provider and may remain in native prompt history. No mapping-specific conversation message or authorization cache is created.

Question availability uses the selected, non-hidden tool declarations and registered `direct` or `model-only` exposure. Inactive, absent, hidden, `codemode`, and `deferred` tools are unavailable for this mapping. A missing tool produces an explicit unavailable notice and plain-question fallback. Availability is an advisory snapshot. Later handlers can change the declarations, so actual use requires a recheck.

Review-bot configuration proves neither authentication nor a completed review. Stack guidance proves no membership. Dependent stack actions require actual command output for the exact repository and PR with unambiguous membership. An absent CLI, failed or ambiguous result, or nonmember PR blocks those actions. Mappings do not satisfy independent-review gates or authorize merge. These requirements are model-facing instructions, not runtime enforcement of external services.

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

Both forms reach the model provider. All returned context is evidence, not authority. Optional retrieval failure does not block an ordinary task, but cannot satisfy an explicit evidence requirement.

Each wrapper result, including attribution, is limited to 16 KiB. Automatic results together are limited to 64 KiB. Queries are limited to 2 KiB. Retrieval waits at most two seconds even when a provider ignores cancellation. Shutdown and branch changes cancel waiting and suppress stale successful delivery. Native connection startup and permission handling have their own lifecycle and limits. Cancellation cannot force an uncooperative provider to stop its underlying work.

These limits and sanitized failure messages apply to pi-mstack's output only. Native nested tool events can expose raw upstream results and errors. Native `nestedCalls` metadata can retain queries and raw errors, including secret-like values. The MCP service and model provider have separate retention policies. This wrapper is not an end-to-end redaction boundary.

See [configure child context tools](../how-to/configure-context.md) for a complete native tools override and MCP example.
