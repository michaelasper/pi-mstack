# Pi host adapter

This adapter takes precedence over Cursor-specific vocabulary in generated pstack resources. Read it once per session and again after losing its context. Source instructions in upstream/pstack are preserved history, not native runtime entry points.

## Mandatory gates

A substitute must satisfy the original requirement with retained evidence. Missing independent real-product verification blocks Shipping before merge. Missing control-ui blocks required UI verification until a demonstrated equivalent exists. An unavailable explicit reviewer blocks that review and dependent actions. Do not label placeholders as verdicts. Optional unavailable evidence stays labeled missing and may be skipped only when no mandatory gate depends on it.

## Native mappings

### Task

Use native subagent with agent, task, async, model, cwd, worktree, output, action, id, and message. Other documented controls go in options. Enable subagents_enable first when needed. Never pass options.tools.

### AskQuestion

Use the question mapping in the pi-mstack-mappings section when present. Recheck that the tool is actually declared and available before use. Otherwise use an available user-interaction tool or ask a plain question. Do not invent or activate a tool.

### todolist

Use the available todo tool or a Markdown checklist. Keep required steps and blocking gates. Do not mirror a workflow in standalone native tasks.

### generalPurpose

Use the resolved native worker agent. Check its actual definition before claiming restrictions.

### poteto-agent

Use the native poteto-agent definition with the absolute generated Poteto Mode path in the task. Overrides are operator choices; inspect native agent get/list metadata.

### comment-sicko

Use the native comment-sicko agent. Inspect its actual provenance.

### readonly

Select an agent definition with appropriate tools and extensions. acceptanceRole read-only is evidence policy, not filesystem permissions. Bash can mutate files.

### environment

There is no cloud VM. Native worktree isolates source only, not secrets, processes, or network. Block a task requiring VM isolation.

### cloud_base_branch

Use worktree true and options.baseRef with a native-supported named ref. A clean committed repository is required. Never promise uncommitted changes are copied automatically.

### run_in_background

Use async true. Keep the parent alive for completion delivery. Inspect retained run IDs and attribution; do not poll while completion delivery suffices.

### resume

Use action steer with id/message for a running child, action resume for an eligible retained child, and action stop for an async child. Resume is authoritative and may reject. No silent execution-mode fallback.

### file_attachments

Pass absolute file pointers in the task and explicit output bindings. Confirm child access. Native subagent has no file_attachments field.

### claude-

Cursor model slugs are historical vocabulary. Use only exact effective native role selectors. Never translate slugs or reasoning budgets.

### grok-

Use exact native role data, not Cursor family defaults.

### gpt-

Use exact native role data, not Cursor family defaults.

### inherit-parent

Role data resolves inheritance to the active parent provider/model:thinking. Pass that exact value so agent overrides cannot change it. If native policy rejects it, stop without retrying an omitted selector.

### pstack-models.mdc

Use the native role-data section and /setup-pstack. Configuration is PI_CODING_AGENT_DIR/pstack/models.json, not Pi model catalog configuration.

### .cursor/skills/

Invoke bundled skills by their absolute generated path or /skill:name. Author project skills at .agents/skills/<name>/SKILL.md or personal skills at ~/.agents/skills/<name>/SKILL.md. Preserve existing Pi-discovered locations. Do not edit package caches or search Cursor installation directories.

### ~/.cursor/plugins/

Use Pi package resource provenance. The snapshot is historical, never a discovery root.

### .cursor/rules/

Use native branch mode and the separate role-data section. Do not create Cursor rules.

### agent-transcripts

Acquire the current session path in Pi's local built-in bash tool with `printf '%s\n' "${PI_SESSION_FILE:-}"`. Pi 1.5.0 injects PI_SESSION_FILE into its shell tools, not arbitrary terminals. It is unset for ephemeral sessions and can be disabled or absent in overridden or remote tools. If absent, request an exact retained path from the operator or a retained native run record. Do not guess a path. Read only the first JSONL line initially, for example `head -n 1 -- "$PI_SESSION_FILE"`, and verify the session header type, id against PI_SESSION_ID when available, and cwd against the authorized workspace before reading entries. For operator-provided paths, substitute the exact quoted path and confirm its session identity and scope. A cwd match alone does not authorize other sessions. Pi JSONL entries form a tree through id/parentId. The whole file is not necessarily the current branch. When an extension exposes sessionManager, use getBranch() for the active branch; otherwise label file-based findings as session-wide and do not guess the active leaf. Cross-chat mining without an authorized corpus is blocked. Never recursively search or glob global sessions, follow parentSession pointers without authorization, or silently use Cursor transcripts. Pass only exact authorized paths to children. The audit script separately requires an explicitly authorized workspace history directory with its workspace marker.

### Cursor-only features

No Cursor service parity. The pi-mstack-mappings section may supply review-bot and stack guidance, not capabilities, authentication, review verdicts, or merge authority. Before dependent stack actions, retain actual membership evidence for the exact repository and PR. An absent CLI, failed or ambiguous result, or nonmember PR blocks those actions. Existing forge comments remain evidence. Benny triggers, cloud VMs, bot webhooks, secret storage, SendToUser, editor selection, and video rendering need external services.

### Run another pstack skill

Read the corresponding generated SKILL.md or invoke /skill:name. pstack and setup-pstack are extension commands. poteto-mode is handled by the input hook and accepts same-line or multiline tasks; prompt resources supply completion.

### loops

Use pi-loop LoopCreate/List/Update/Delete for scheduled work and MonitorCreate/List/Stop for command completion. Record controller IDs, stop conditions, and maxFires. Pi must stay active. Ordinary wakes and monitor handles are process-local; never promise exactly-once or unattended daemon execution. Never use OrchestrationCreate as a delegation bridge to npm:pi-subagents.

### MCP

Inspect actual tool/provider availability. Load providers in the agent definition. A tool name in the task does not grant access. Foreground children do not inherit ambient extensions.

### gates

Missing mandatory verification or authority blocks dependent actions. An equivalent must actually satisfy the original gate. Optional unavailable evidence can be labeled missing only if no gate depends on it.

### subagent_type

Use the native agent field with the resolved agent name. Inspect its actual definition before claiming restrictions. Do not pass subagent_type to native subagent.

### .cursor/worktrees/

Use native worktree metadata or git worktree list. Cursor paths in examples are historical, not native discovery roots.

### create-skill

Read skills/poteto-mode/playbooks/authoring-a-skill.md in this generated package. It provides the complete Pi-native authoring procedure, project and user destinations, frontmatter, discovery checks, and test steps. No Cursor built-in is required.

## Role data

Read the separate native pi-mstack role-data section even when mode is off. Invalid configuration is a blocker for affected workflows, not permission to inherit silently. Pass exact effective selectors. Preserve ordered panel entries. Repeated inheritance is multiple samples, not multiple families. Required cross-family review stays blocked without a verified eligible reviewer. Runtime diagnostics distinguish registry validity from native eligibility. Native preflight is authoritative.

- feature, refactoring is a scalar role.
- bug-fix is a scalar role.
- perf-issue is a scalar role.
- hillclimb is a scalar role.
- judgment and prose is a scalar role.
- hardest tasks is a scalar role.
- how explorer is a scalar role.
- how explainer is a scalar role.
- why investigators is a scalar role.
- why synthesizer is a scalar role.
- reflect tooling is a scalar role.
- reflect judgment, divergent, synthesizer is a scalar role.
- arena runners is an ordered panel.
- arena cross-judge pool is an ordered panel.
- swarm workers is a scalar role.
- architect runners is an ordered panel.
- interrogate reviewers is an ordered panel.

## Native execution

Inspect the installed subagent guide before constructing workflow calls. Use awaited runs.run and runs.all inside native workflow scripts. Bind output on each child when downstream work needs a retained report. Read actual attribution and completion status. Tool names alone do not verify agent provenance or package versions.

For a command monitor, use MonitorCreate with command and onDone, retain monitorId, and stop through MonitorStop when no longer needed. A completion log alone does not prove a provider-visible wake. Keep the host active. Do not start duplicate controllers after restart without inspecting native state.
