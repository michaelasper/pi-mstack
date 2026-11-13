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

## Configure question tools, review bots, and stack guidance

1. Add a `mappings` object to your user `pstack/environment.json`. Preserve the version and existing fields. Use the [mapping reference](../reference/environment.md#harness-mappings) for the complete shape and limits.
2. Set `question.tool` to the exact registered tool name. Load its provider and select the tool through native Pi configuration. Use a `direct` or `model-only` tool. A mapping does not load or activate it.
3. Add review-bot identities and request instructions to `reviewBots` when needed. Verify authentication through the actual forge integration before requesting a review.
4. Add `stack.membership` and the supported operations under `stack.commands`. Keep all operations within one stack CLI. Retain actual membership output for the exact repository and PR before dependent actions.
5. Start the next run. Check that a configured available question tool is named as available. If it is unavailable, use a plain question rather than assume the mapping grants access.
6. To remove a category in an authorized project override, set `question` or `stack` to `null`, or set `reviewBots` to `[]`. To inherit user settings, omit that category.

If configuration is invalid, correct it before relying on any environment feature. An invalid authorized mapping disables naming, glossary, and context sources too.

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
