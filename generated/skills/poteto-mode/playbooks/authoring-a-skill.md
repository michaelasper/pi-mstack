Read [the Pi adapter](../../../docs/harness/pi.md) before following these instructions. Its native mappings take precedence over host-specific source vocabulary. Mandatory evidence and authority gates remain blocking.

### Authoring or modifying a skill

**You own the skill's voice.**

1. Choose the scope before writing. Use `.agents/skills/<name>/SKILL.md` in the project or `~/.agents/skills/<name>/SKILL.md` for a personal skill. Preserve an existing Pi-discovered destination. Never edit package caches or generated package resources. Show the destination and honor the calling workflow's approval gate.
2. Write YAML frontmatter with `name` and `description`. Use a lowercase hyphenated name matching the directory, at most 64 characters. Keep the description a single YAML scalar, at most 1024 characters, stating what the skill does and when to use it. Use `disable-model-invocation: true` for explicit-only skills.
3. Write direct, ordered instructions with concrete inputs, commands, expected results, failure handling, and retained evidence paths. Keep supporting files beside the skill and link them relative to its directory. Apply the **unslop** skill. Do not invent unavailable tools or weaken mandatory gates.
4. Validate frontmatter, referenced files, and cross-skill links. Run `/reload` in Pi from the project, inspect discovery warnings, and invoke `/skill:name` with a representative task. Resolve name collisions before claiming the intended skill loaded.
5. For structural workflows, run a positive case and a negative or missing-capability case. Retain actual tool results and fix failures before repeating. For description tuning, try matching and non-matching prompts and inspect whether the skill was loaded. Lexical checks are not model-compliance evidence. Subjective mode prose needs the user's review rather than a fabricated benchmark. Report unrun cases as limitations.
6. Follow the calling workflow's delivery and approval rules. Run **Opening a PR** only when authorized. Reflect's no-push rule still applies.

When in doubt, delete. Keep only prose that changes a decision. Tell it to do the thing and skip the reason. Explain only when the rule is confusing without one. Match tone to scope. Point at structural sources (types, READMEs, config) per the **encode-lessons-in-structure** principle skill. Delegate to other skills by path. Don't restate. A workflow you keep hitting but isn't captured → propose a new skill.

**Reply:** summary of the skill, key design decisions, validation notes.
