# Configuration reference

The extension owns `pstack/models.json` inside Pi's agent directory. `PI_CODING_AGENT_DIR` changes that directory. This file does not configure provider credentials or Pi's model catalogue.

## Shape

The version is the literal string `pi-mstack/1`. Optional `potetoModeDefault` is a boolean, defaulting to `false` when omitted. `roles` maps labels from [the role registry](../port/roles.json) to scalar selectors or ordered nonempty panels. Unknown labels, invalid versions, and wrong scalar or panel shapes reject the file.

This is an illustrative configuration, not a claim that these provider models are available.

```json
{
  "version": "pi-mstack/1",
  "potetoModeDefault": true,
  "roles": {
    "how explorer": "provider/owner/model:high",
    "arena runners": ["inherit-parent", "inherit-parent"]
  }
}
```

A selector is `provider/full-model-id` with an optional supported thinking suffix. Provider names and model IDs can contain slashes and colons, including URL-shaped provider names. Resolution compares the exact combined `provider/model` string against the authenticated registry, without guessing the provider boundary. If multiple registry entries share that combined string, the role is blocked as ambiguous. Only a recognized final thinking suffix is stripped. For a literal model ID ending in `:high`, use an additional explicit suffix such as `provider/model:high:off`. `auto` and `inherit-parent` both mean the current parent. The injected role table resolves either to an exact effective selector for each run. The workflow passes that explicit selector to native delegation so an agent override cannot replace inheritance accidentally.

Missing scalar roles inherit the parent. Missing panel roles use two ordered parent samples. Repeated entries remain repeated samples. They do not establish cross-family diversity.

## Validation and availability

The file parser preserves an unavailable explicit selector. The role table marks it blocked if it cannot resolve against authenticated available models or requests unsupported thinking. It never translates Cursor slugs or chooses a near match.

The interactive picker uses the session's scoped models when that list is nonempty. Otherwise it uses authenticated available models. A persisted choice outside the picker scope remains in the file and receives a diagnostic. Picker scope is not child-launch permission.

Native policy remains separate. Doctor reports public merged settings as observations, not effective enforcement. Native policy can replace whole project objects rather than recursively merge them. Observed thinking-ceiling conflicts are therefore potential conflicts. Effective precedence and scope matching remain unverified here, not reimplemented. Native preflight can reject a registry-valid selector. A rejection blocks the step without a retry that omits or substitutes its model.

## Setup transaction

`/setup-pstack` edits an in-memory draft and confirms the complete effective role table before saving. Panels use an ordered JSON array of offered selectors. Cancellation, invalid input, or declining confirmation leaves the file unchanged. A changed file detected before publication rejects a stale write.

Saving uses a same-directory temporary file and atomic rename with mode `0600`. The configuration directory uses mode `0700` when newly created. These checks prevent accidental clobbering, not coordinated writes by malicious local processes.

An incompatible preexisting file, including an empty or whitespace-only file, is never overwritten automatically. A missing file alone receives defaults. An existing configuration lock refuses writes with recovery instructions. Confirm no setup writer is running before manually removing a stale lock. Headless setup reports the location and current state without choosing or saving models. RPC supports the host's select, input, and confirm dialog protocol.

## Commands and mode

Multiline short prompts, the `potete-mode` alias, and saved defaults require version 0.2.0 or later.

| Route | Effect |
| --- | --- |
| `/poteto-mode` | Enables branch-local mode without inference. |
| `/poteto-mode off` | Disables mode without inference. |
| `/skill:poteto-mode` | Enables mode without inference. |
| `/skill:poteto-mode off` | Disables mode without consuming another package's conflicting skill. |
| `/skill:poteto-mode <task>` | Enables mode and uses native skill expansion for the task. |
| `/poteto-mode <task>` | Enables mode and runs the task through native skill expansion. Spaces, tabs, LF, and CRLF can separate the name and task. |
| `/potete-mode` | Alias for `/poteto-mode`, including tasks and `off`. |
| `/pstack default on` / `/pstack default off` | Saves the default for branches without an explicit on/off choice; preserves role settings. |
| `/pstack default` | Reports the saved default without changing it. |
| `/setup-pstack` | Opens transactional setup, or reports instructions headlessly. |
| `/pstack doctor` | Reports mode, roles, collisions, and observable dependency tools. |

Mode requests and default-setting writes while the agent is busy are refused. No mode entry or default change is persisted and no task is queued. Retry after settlement. Short and native skill routes accept same-line and multiline tasks; the input hook normalizes them before native skill expansion, without forwarding another user message. Extension-origin messages are left untouched and do not activate persistent mode, even when an extension opts into skill expansion.

The extension commands are `setup-pstack` and `pstack`. Mode routes use the input hook, with packaged prompt resources for command completion. Disabling prompt templates hides those completion entries but does not disable the input hook. The diagnostic command also accepts bare `/pstack`. Other skill names use `/skill:name`.

Mode entries use custom type `pi-mstack/mode` with version `1`. The latest explicit mode entry among active-branch ancestors determines the current state; otherwise the saved default applies. Even an explicit off while already off is recorded, so enabling the default later cannot undo it. Default changes affect new sessions and existing branches without explicit entries. Invalid configuration never enables the default or gets overwritten by the toggle. The extension sets separate system-prompt sections for mode and role data. It does not replace the host prompt, launch children, or intercept unrelated delegation.

Doctor reports tool presence or inactivity from public metadata. Dependency versions and resolved agent provenance remain unverified where that metadata is unavailable. Native agent overrides are operator choices. A workflow must inspect native list or get metadata before claiming the bundled definition's restrictions.
