# Local explorer and worker agents

The package ships two general local agents through the same generated resource pipeline as the grounding agents. They supply ordinary local-tool defaults. They do not add a permission system.

| Agent | Tools | Role |
| --- | --- | --- |
| `pstack-local-explorer` | `read`, `grep`, `find`, `ls` | Read local sources and return evidence. |
| `pstack-local-worker` | `read`, `grep`, `find`, `ls`, `bash`, `edit`, `write` | Make and verify a bounded local change. |

Both names resolve from the installed package, so `subagent({ action: "list" })` reports them with `source: package`. The package files are `generated/agents/pstack-local-explorer.md` and `generated/agents/pstack-local-worker.md`. Pi reads the `pi.subagents.agents` directory that `package.json` declares, so no runtime registration is required.

## Invocation

Enable delegation first when the current session has not activated it. Then dispatch either agent directly.

```json
{
  "agent": "pstack-local-worker",
  "task": "Fix the documented auth regression and run its focused tests.",
  "async": true,
  "output": "/absolute/reports/auth-fix.md"
}
```

The agents also work inside workflow scripts through `runs.run` and `runs.all`.

## Defaults

| Field | Value |
| --- | --- |
| `model` | `inherit` |
| `defaultContext` | `fresh` |
| `systemPromptMode` | `replace` |
| `inheritProjectContext` | `true` |
| `inheritGlobalContext` | `false` |
| `inheritSkills` | `false` |
| `allowNestedSubagents` | `false` |
| `acceptanceRole` | `read-only` for the explorer, `writer` for the worker |
| `acceptance` | Explicit policy with stated criteria. The explorer resolves to `attested`; the writer role raises the worker to `checked`. |

Project instructions apply because these agents serve ordinary repository tasks. Global context and automatic skills stay out of a fresh child. Fresh context does not copy the parent transcript.

Native pi-subagents 0.88.1 adds `contact_supervisor` to both child tool lists. That tool is the supervisory channel, not delegation and not an MCP grant. Captured provider declarations on this version are `read`, `grep`, `find`, `ls`, `contact_supervisor` for the explorer, plus `bash`, `edit`, and `write` for the worker. A schema-bound launch adds `structured_output`. No `subagent`, `bg_wait`, or MCP tool appears by default.

Both agents use the fenced child acceptance report that native acceptance injection requests. The worker must supply changed-files, commands-run, and no-staged-files evidence. An async worker launch also infers a required independent reviewer, so its accepted evidence waits at `review-required` until that review exists. A run whose child omits the report is rejected. An acceptance role is evidence policy only.

## Native overrides

Operator settings can replace either tool list. `subagents.agentOverrides.<name>.tools` replaces the default list. A shorter list narrows access. A longer list widens access, including `bash` for the explorer. `"inherit"` removes the explicit list and leaves Pi's default tools. `false` makes the list empty. `excludeTools: false` clears exclusions.

Project settings under `.pi/settings.json` apply after user settings, so a trusted project override wins. Per-call `options.tools` does not exist. pi-subagents rejects that unknown option before any child starts.

An explicit `context: "fork"` launch keeps the parent system prompt and tool declarations, including tools the child cannot execute. A fork can therefore declare a parent-only tool to the provider while a call to it returns a not-found error. Explicit `context: "fresh"` wins over a global `defaultSubagentContext: "fork"` preference.

## Limits

These are tool defaults, not enforced grants. The package adds no grant compiler, grant file, dynamic MCP revalidation, or filesystem sandbox.

- The explorer can read any local file the Pi process can read, including sensitive operator files.
- Worker `bash` runs with the process user's filesystem and network access.
- Native runtime output persistence can write an explorer report even though the explorer has no write tool.
- Background children can load ambient extension code. An extension can run its own code even when its tools are not declared to the child.
- Operators can widen the defaults, including by adding MCP tools or delegation through native override fields.
- Enforced MCP grants and an allowlist that native policy cannot bypass are deferred to a follow-up change.

See [compatibility](compatibility.md) for the tested versions and [verification](../verification.md) for the native matrix.
