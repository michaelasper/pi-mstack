# Choose role models and review panels

Use this guide when you want particular workflows to use exact models or an ordered review panel. Authenticate the intended providers in Pi first. pi-mstack does not store credentials.

1. Start an interactive Pi session with pi-mstack loaded.
2. Run `/pstack doctor`. Resolve configuration errors or resource collisions before changing roles.
3. Run `/setup-pstack`.
4. Choose the role and model from the offered authenticated selections. For panel roles, supply the ordered JSON array requested by the dialogue. Use exact offered selectors rather than Cursor aliases.
5. Inspect the complete effective role table. Confirm only when it matches your intent. Cancelling or declining leaves the file unchanged.
6. Run `/pstack doctor` again to inspect the saved choices and diagnostics.

Missing roles inherit the current parent model. Two inherited panel entries are two samples, not independent model families. If your workflow requires diversity, configure genuinely distinct eligible models and verify that requirement before proceeding.

If setup reports an incompatible file, preserve it and correct its schema before retrying. If a configuration lock remains after an interrupted setup, confirm no setup writer is running before manually removing that lock. Do not delete a live lock.

A registry-valid selection can still be rejected by native subagent policy. Resolve that policy or obtain the required authority. Do not retry by omitting or substituting the model.

See the [configuration reference](../configuration.md) for file location, schema, thinking suffixes, panel shapes, and precedence limits.

## Import a legacy role file

Import replaces all configured roles. It preserves the default-mode setting, not role assignments absent from the source.

1. Rewrite legacy model slugs and space-separated thinking as exact authenticated `provider/model[:thinking]` selectors. Keep `auto` and `inherit-parent` where intended.
2. Remove retired role lines, Markdown fences, and bullets. Set thinking on each selector rather than relying on an ignored `# budget` comment.
3. Run `/setup-pstack import "~/migration notes/pstack-models.mdc"` with your source path.
4. Check the replacement warning, preserved default, configured roles JSON, and complete effective table. Confirm only when all match your intent.
5. If the preview changes during confirmation, retry the command and review the new preview.
6. Run `/pstack doctor` to inspect the saved roles.

See [legacy role import](../configuration.md#legacy-role-import) for the strict grammar and path rules.
