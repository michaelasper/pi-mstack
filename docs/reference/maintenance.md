# Maintenance command and acceptance reference

## Commands

All commands run through `node tools/upstream.mjs`. Every command accepts optional `--root PATH`, which defaults to the working directory. Unknown commands, options, positional arguments, duplicate options, and missing values fail with usage before importer operations run.

| Command | Required options | Optional options |
| --- | --- | --- |
| `propose` | `--repo PATH --commit FULL_SHA` | None |
| `accept` | `--proposal PATH --reviewed DIGEST` | None |
| `export` | `--destination PATH` | None |
| `generate` | None | `--check` |
| `check` | None | None |
| `repair lock` | None | `--acknowledge TOKEN` |
| `repair generated` | None | None |

`generate --check` and `check` both validate without publishing. Values are separate arguments, not `--option=value`. Paths containing spaces require shell quoting. The importer validates source commits and review digests before publication.

## Acceptance schema 2

`upstream/acceptance.json` contains `schema`, `reviewDigest`, and `inputs`. Each input contains a relative `path` under `tools/` or `port/` and a lowercase SHA-256 `sha256` of its bytes. Duplicate paths, unsafe paths, malformed entries, and unsupported schema versions block generation.

The digest remains SHA-256 of the serialized `{ manifest, inputs }` object using the importer's `json` function. Inputs use the deterministic traversal order of `tools/` followed by `port/`. The accepted inventory must reproduce the stored digest with the current manifest before drift diagnostics run. Modified inventory data cannot supply an unverified diagnostic baseline. The digest binds content, not author identity or a cryptographic signature.

Generation compares current input paths and hashes with this validated inventory and reports added, removed, and changed paths. Schema 1 lacks the inventory and requires a fresh proposal, review, and acceptance. There is no automatic schema upgrade or approval transfer.

## Retained state

`.cache/proposal-*` directories retain source snapshots and their manifest and review digest. Acceptance leaves other proposals in place. They are review and recovery evidence, not disposable caches during an update.

`.mstack-pending` contains `{ "reviewed": "DIGEST" }`. It does not contain a proposal path. A pending journal blocks generation. Failed writes can leave `.mstack-source-*` or `.mstack-generated-*` stages and backups. No age-based cleanup removes these artifacts.

The [maintenance guide](../maintenance.md) describes migration, recovery, and explicit manual retention decisions.
