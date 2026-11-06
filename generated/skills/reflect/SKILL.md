---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect.
disable-model-invocation: true
---


Read [the Pi adapter](../../docs/harness/pi.md) before following these instructions. Its native mappings take precedence over host-specific source vocabulary. Mandatory evidence and authority gates remain blocking.


# Reflect

Mine the current conversation for durable learnings, then route them into skill edits.

Invoke when the user says "reflect" or "/reflect". Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## 1. Locate the active transcript

Use the Pi adapter's session acquisition procedure before reading history. Scope reads to the current Pi session or exact authorized retained session paths supplied by the operator or a retained native run record. Cross-chat mining without an authorized corpus is blocked. Never search a sessions tree or use Cursor transcripts as a fallback. If no transcript is available, a digest of the visible current conversation may support labeled provisional findings, not transcript verification.

## 2. Spawn three reviewers in parallel

One message, three `Task` calls, `subagent_type: generalPurpose`, agent mode (`readonly: false`). Reviewers need MCP access to look up the tickets, chat threads, and observability traces the transcript references, and readonly strips MCPs.

Use `reflect tooling` and `reflect judgment, divergent, synthesizer`. Read the native pi-mstack role-data section. Pass its exact effective selector as `model`, including thinking. Missing configuration inherits the active parent explicitly. Unavailable or rejected explicit selections block this step. Never translate a slug, omit a rejected selector, or substitute a family default.

| Lens | Role line | Default `model` | Prompt template |
|---|---|---|---|
| Judgment | `reflect judgment, divergent, synthesizer` | Exact native role-data selector | `references/judgment-reviewer.md` |
| Tooling | `reflect tooling` | Exact native role-data selector | `references/tooling-reviewer.md` |
| Divergent | `reflect judgment, divergent, synthesizer` | Exact native role-data selector | `references/divergent-reviewer.md` |

Pass each template verbatim, substituting the transcript path or digest where marked. Reviewers return findings in the `Task` response body.

## 3. Synthesize

Run one native child using the exact `reflect judgment, divergent, synthesizer` selector. Its agent definition must load the MCP providers needed to verify citations. Pass `references/synthesizer.md` and bind its output. It returns an Accepted / Rejected / Backlog list.

## 4. Structural enforcement check

Move any Accepted item that a lint rule, script, metadata flag, or runtime check would enforce more reliably to Backlog. See the **encode-lessons-in-structure** principle skill.

## 5. Apply

Present the synthesizer's full Accepted / Rejected / Backlog output and wait for explicit approval before applying any Accepted edit. The user picks the subset and may redirect routings. Skill changes affect every future agent in the org. Do not auto-apply.

File each Backlog item to your team's devex or backlog tracker without waiting. Only the Accepted list waits for approval.

Never edit a skill under `plugins/cache/`. Before approval, show its destination, `.agents/skills/<skill>/` or `~/.agents/skills/<skill>/`. After approval, copy the skill folder there and edit the copy. Never open a PR or push.

Follow each approved row's Routing exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): the parent does it directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): hand to the Pi authoring procedure in `poteto-mode/playbooks/authoring-a-skill.md` under the generated skills directory and run its draft / test / iterate loop.
- `tune description: <skill path>` (the skill exists but didn't trigger when it should have): hand to the Pi authoring procedure in `poteto-mode/playbooks/authoring-a-skill.md` under the generated skills directory and run its description-optimization loop.
- `new Pi skill: <kebab-name>`: hand creation to the Pi authoring procedure in `poteto-mode/playbooks/authoring-a-skill.md` under the generated skills directory. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done.

## 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.
