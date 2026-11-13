# Configure child context tools

Bundled `poteto-agent` and `comment-sicko` definitions load the packaged context extension through `subagentOnlyExtensions`. Automatic memory and glossary definitions reach them without extra tools. Their default tool allowlists are unchanged.

To enable on-demand retrieval in a child, configure both the source and native tool selection.

1. Add a source to your agent directory's `pstack/environment.json`.

```json
{
  "version": "pi-mstack/environment/1",
  "sources": [
    { "id": "docs", "kind": "mcp", "tool": "mcp__docs__search", "queryArgument": "query" }
  ]
}
```

2. Configure your existing MCP search server in the agent directory's `mcp.json`. Replace the example executable with your server's executable and arguments. The server must expose a tool named `search` with a `query` argument.

```json
{
  "mcpServers": {
    "docs": {
      "command": "/absolute/path/to/docs-mcp-server",
      "args": [],
      "exposure": "direct"
    }
  }
}
```

3. Add a complete replacement `tools` override in the agent directory's `settings.json`. Merge this property with your existing settings rather than replacing the whole file.

```json
{
  "subagents": {
    "agentOverrides": {
      "poteto-agent": {
        "tools": ["read", "bash", "edit", "write", "grep", "find", "ls", "pstack_context", "mcp:docs/search"]
      },
      "comment-sicko": {
        "tools": ["read", "grep", "find", "ls", "pstack_context", "mcp:docs/search"]
      }
    }
  }
}
```

4. Reload Pi. Inspect the native agent definition before launching. Ask the child to call `pstack_context` with `source: "docs"` and the search query. Verify the actual tool result, not just a discovery listing.

For the parent session, add `"defaultTools": ["+pstack_context"]` to settings if you want the wrapper available by default. This uses Pi's additive parent tool selection. Child `tools` overrides are complete lists, not additive lists.

For a custom child tool, include its name in the child's `tools` list and load the extension that registers it through `extensions` or `subagentOnlyExtensions`. If you replace `subagentOnlyExtensions`, retain an absolute path to the installed package's `extensions/pstack/context.ts` when you still want bundled context behavior. A tool name alone does not load its provider. Do not pass `options.tools` or invent a preflight management action.

Pi's built-in MCP supports foreground children with configured `mcp:` selection. An ambient adapter such as `pi-mcp-adapter` requires background execution with `async: true`. Native policy controls availability, trust and permission checks in both cases. Hidden tools remain unavailable. Project MCP files require native project trust. Project environment files also require an exact user grant.

Keep credentials in Pi's native credential configuration, not `environment.json`. Review the [privacy and limits](../reference/environment.md#retrieval-and-privacy) before authorizing memory files or remote sources.

## Authorize project context

1. Review the project's `.pi/pstack/environment.json` and its memory and MCP sources. A grant permits future content changes at that path.
2. Run `pwd -P` inside the project to obtain its canonical directory.
3. Add that exact path to `pstack/environment-grants.json` in your user agent directory, normally `~/.pi/agent`. Keep this file outside the project. Preserve any existing grants.

```json
{
	"version": "pi-mstack/environment-grants/1",
	"projects": ["/absolute/canonical/project"]
}
```

4. Allow the project through Pi's native trust controls. A native denial still blocks project environment loading.
5. Start the next run to load the authorized configuration. To revoke access, remove the path from `projects`. The next run or on-demand retrieval applies the change.

Do not put grants in the checkout. Do not use a parent directory or a glob to authorize several projects. See [project authorization](../reference/environment.md#project-authorization) for limits and revocation behavior.

## Configure a role operation

1. Add a role operation to `pstack/environment.json` using the [context role schema](../reference/environment.md#context-roles). Map scalar inputs to the native tool's arguments with whole-value `$arg` leaves.
2. Configure the server through Pi's native MCP settings. For writes, use the built-in MCP adapter.
3. Select `pstack_context` and the exact target through native tool configuration. Do not treat a role label or template as a permission grant.
4. Run `/pstack doctor` to inspect the passive availability snapshot. Confirm the exact native target, including any collision suffix.
5. Call `pstack_context` with `role`, `operation`, and `args`. Use `{source, query}` only for legacy sources.
6. Inspect the result. A mutation receipt is not evidence of remote state. If the result is `unknown-outcome`, inspect the remote state through an authorized read before deciding whether to make another explicit attempt.

Do not retry uncertain writes automatically. Native nested records can retain raw arguments and results even when wrapper text is bounded.
