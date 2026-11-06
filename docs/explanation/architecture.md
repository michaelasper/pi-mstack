# Why source, adaptation, and execution are separate

pi-mstack ports pstack's workflows without becoming another agent runtime. Its main maintenance problem is keeping a large upstream collection recognisable while changing the parts that assume Cursor.

## The source is evidence, not an editable fork

`upstream/pstack/` preserves the pinned source. The manifest records every original path, content hash, mode, and disposition. That lets a maintainer distinguish a real upstream change from a local adaptation.

There is one storage exception. Standard npm packing omits `.gitignore`, so the snapshot stores that file under `__npm_reserved_gitignore__`. Its original identity and bytes remain in the manifest, and export reconstructs the original path. The package does not need a custom tarball format.

## Adaptation is a reviewed input

`port/` owns the mappings, templates, role registry, and exact patches. `tools/` turns those inputs into `generated/`. The review digest binds both the source manifest and adaptation inputs. A template-only change therefore needs renewed acceptance even when the upstream commit stays the same.

Exact patches deliberately fail when their source hash or expected paragraph changes. This creates maintenance work at the point where a human needs to examine new upstream meaning, instead of silently applying an old assumption to new prose.

Lexical scanning complements that boundary but cannot replace semantic review. It catches registered host vocabulary and known protocol shapes. It cannot prove that every paragraph is a faithful Pi workflow.

## Pi owns execution

The extension owns branch-local mode state, role configuration, and diagnostics. It injects instructions and exact model selections. Native pi-subagents still owns child execution and policy enforcement. Native pi-loop owns scheduling and monitors.

The requested versions have incompatible optional delegation RPC contracts. The port avoids that bridge rather than building another execution protocol. Loop scheduling and native subagent calls remain separate responsibilities.

This boundary also explains conservative diagnostics. Public merged settings are observations, not necessarily native effective policy. A model can be authenticated and still fail native preflight.

## Explicit limits are part of the port

A skill can describe a service the host does not supply. Copying that description is not an implementation. Cursor-only services therefore become explicit gaps, and a missing capability cannot count as evidence for a required gate.

The same principle applies to history. A current session or an explicitly authorised retained path is evidence the workflow can use. The existence of other local transcript files is not permission to read them.

## Busy changes refuse rather than pretend

Queued work may already carry prompt state. Persisting a new mode while that work still receives the old prompt would make the diagnostic state misleading. The extension instead refuses busy mode requests before persistence and leaves the task unqueued. An idle retry has an observable, consistent result.

The [design record](../design.md) preserves the detailed decisions. The [maintenance guide](../maintenance.md) is the operational route for changing them safely.
