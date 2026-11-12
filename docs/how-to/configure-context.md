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

Pi's built-in MCP supports foreground children with configured `mcp:` selection. An ambient adapter such as `pi-mcp-adapter` requires background execution with `async: true`. Native policy controls availability, trust and permission checks in both cases. Hidden tools remain unavailable. Project MCP and environment files load only when Pi trusts the project.

Keep credentials in Pi's native credential configuration, not `environment.json`. Review the [privacy and limits](../reference/environment.md#retrieval-and-privacy) before authorizing memory files or remote sources.
