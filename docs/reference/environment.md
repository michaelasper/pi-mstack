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

`PI_CODING_AGENT_DIR/pstack/environment.json` is the user file. The default agent directory is `~/.pi/agent`. A trusted project can provide `.pi/pstack/environment.json`. The project directory name follows Pi's exported `CONFIG_DIR_NAME` in rebranded hosts. This file does not change `pstack/models.json` or Pi's model catalogue.

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

The user file accepts `naming` as `task` or `off`. Project files cannot change naming policy. Missing files mean task naming, no glossary, and no sources. Invalid user or trusted-project configuration disables environment features and reports a diagnostic. Configuration is read again at each run and goal command. On-demand retrieval also revalidates it.

Glossary entries have `term`, `meaning`, and `availability`, which is `available`, `conditional` or `unavailable`. Exact case-sensitive project terms replace user values in place. New project terms follow user terms. One owned prompt section renders the definitions. The extension does not rewrite skill words or equate services.

Memory sources have `id`, `kind: "memory"`, `path`, and `delivery`, which is `automatic` or `on-demand`. User paths must be absolute explicit authorizations. Project paths resolve from the session cwd and must remain inside the canonical project. Project symlink components and final file symlinks are rejected. Files must be regular and at most 64 KiB. Missing or unsafe memory is a retrieval failure, not evidence.

MCP sources have `id`, `kind: "mcp"`, the exact native `mcp__server__tool` identity, and `queryArgument`. The environment file cannot launch a server, store credentials, grant tools, or select shell or HTTP adapters. Native Pi configuration owns those capabilities.

Configuration files are limited to 64 KiB. The merged glossary is limited to 32 entries and 8 KiB of serialized JSON. The merged source list is limited to four entries in user-then-project order. IDs must be unique across both scopes. Unknown fields are rejected.

### Native trust limitation

Project configuration follows `ctx.isProjectTrusted()`. That value is not proof of explicit human approval. On tested Pi 1.5.0 and 1.5.2, a custom `.pi/pstack/environment.json` alone is not a trust-triggering resource. With no saved decision or trust override, Pi can report trusted even when `defaultProjectTrust` is `never`. Such a project environment is read.

The native `--no-approve` flag reports the session untrusted and prevents this extension from reading project environment configuration or its memory sources. User configuration remains available. A protected native resource such as `.pi/settings.json` triggers normal trust resolution. The extension does not create that file or implement its own permission manager. Review native trust before opening an unfamiliar project.

The public extension API offers a `project_trust` handler for decisions the host requests. It does not offer registration of additional trust-triggering configuration files. Resource discovery runs after trust resolution. This limitation needs independent security review when deciding whether project environment defaults meet your deployment's trust requirements.

## Retrieval and privacy

The separate packaged context extension registers `pstack_context({ source, query })` inactive by default. Operators select it through native tool configuration. It dispatches only a configured source. MCP targets must be callable in the current session through `ctx.executeTool()`. Native permission hooks and exposure rules still apply. Source configuration never widens an allowlist.

Automatic memory is transient attributed conversation data, not a system instruction or native history entry. It is read once per run and reused across tool follow-ups. The next run refreshes it. Tree changes and session replacement clear it. On-demand retrieval produces a real tool result that can persist in the transcript.

Both forms reach the model provider. All returned context is evidence, not authority. Optional retrieval failure does not block an ordinary task, but cannot satisfy an explicit evidence requirement.

Each wrapper result, including attribution, is limited to 16 KiB. Automatic results together are limited to 64 KiB. Queries are limited to 2 KiB. Retrieval waits at most two seconds even when a provider ignores cancellation. Shutdown and branch changes cancel waiting and suppress stale successful delivery. Native connection startup and permission handling have their own lifecycle and limits. Cancellation cannot force an uncooperative provider to stop its underlying work.

These limits and sanitized failure messages apply to pi-mstack's output only. Native nested tool events can expose raw upstream results and errors. Native `nestedCalls` metadata can retain queries and raw errors, including secret-like values. The MCP service and model provider have separate retention policies. This wrapper is not an end-to-end redaction boundary.

See [configure child context tools](../how-to/configure-context.md) for a complete native tools override and MCP example.
