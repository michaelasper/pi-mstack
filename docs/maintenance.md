# Update and recover the port

This guide covers an explicit upstream update or adaptation change. Do not edit `generated/` or `upstream/pstack/` directly. Keep a single checkout writer.

## Review and accept an update

1. Obtain a local Git repository containing the candidate full commit. Fetching is a separate operator action. Proposal, generation, and extension load never fetch or run upstream scripts.
2. Edit the required mappings, exact patches, templates, or policy under `port/`. An exact patch names the original source hash and must match its paragraph exactly once.
3. Stage a proposal from Git objects.

   ```sh
   npm run upstream:propose -- --repo /path/to/cursor-plugins --commit FULL_40_CHARACTER_SHA
   ```

4. Read the emitted proposal's `manifest.json` and `review.json`. Review every addition, removal, content change, mode change, and disposition. Renames appear as removal plus addition. Review unchanged-copy policy too.
5. Inspect adaptation changes under `tools/` and `port/`. The review digest binds their sorted paths and hashes as well as the source manifest. A template-only edit invalidates approval. On later drift, generation lists added, removed, and changed adaptation input paths. See the [maintenance format reference](reference/maintenance.md) for the acceptance schema.
6. Accept that exact proposal and digest.

   ```sh
   npm run upstream:accept -- --proposal .cache/proposal-EXACT_ID --reviewed EXACT_REVIEW_DIGEST
   npm run generate
   npm run check
   npm run typecheck
   npm test
   ```

7. Inspect the raw and generated diffs before review. Include the manifest, acceptance, source snapshot, and generated tree together. No force flag carries an old approval forward.

For adaptation-only changes, propose the same pinned source commit again. The source change list can be empty while the review digest changes. Unknown file kinds, Git symlinks or submodules, unregistered role references, unknown adapters, stale exact hashes, and missing host mappings must be resolved explicitly before acceptance.

`port/required-terms.json` owns the required mappings and explicit protocol-field and Cursor-path inventories. The scanner independently checks snake_case assignments, Task-call fields, `.cursor/` directories, and supported backticked role wording before applying patches. It does not detect every new host concept or prove semantic equivalence. Review the complete upstream diff even when lexical checks pass.

## Migrate an older acceptance

If generation reports an unsupported acceptance schema, propose the same pinned source commit with the current tools. Review the exact new digest and adaptation inputs, then accept and generate using the steps above. Do not edit `acceptance.json` to change its version or populate its inventory. Schema 1 approvals do not carry forward automatically.

## Retain review and recovery evidence

Keep each proposal's `manifest.json`, `review.json`, and `pstack/` together until review and any recovery finish. Acceptance does not delete older proposals. Record the proposal directory and reviewed digest in your review notes. A newer proposal does not revoke or mark an older proposal as superseded.

Before manually deleting a specific `.cache/proposal-*` directory or orphaned stage, confirm that no writer is active and no pending journal or backup needs it. Run `npm run check` successfully and retain any evidence needed for review. Inspect each exact directory before removing it. Do not clear all of `.cache/` or use wildcard deletion as recovery.

## Recover an interrupted write

If a writer lock blocks progress, inspect `.mstack-lock/owner.json` first. A live or ambiguously live local owner must finish or stop before recovery. The lock includes hostname, PID, process-start evidence, proposal digest, and an ownership token.

For a dead local owner, run:

```sh
npm run upstream:repair -- lock
```

For a foreign or ambiguous owner, first establish that no writer is active. Then acknowledge the exact stored ownership token:

```sh
npm run upstream:repair -- lock --acknowledge EXACT_OWNERSHIP_TOKEN
```

Do not remove a live lock manually. Repair never steals it automatically. It compares process-start evidence for live local PIDs and refuses missing evidence or a mismatch. PID reuse can leave a lock blocked until the observed process is no longer live.

A caught owner-file write error cleans up only the newly created lock whose filesystem identity still matches. This does not handle process death or guarantee cleanup after filesystem failure. A missing or malformed owner record without a usable token cannot use automatic repair. Inspect the lock and running writers. Remove it manually only after establishing that no writer can publish.

If `.mstack-pending` exists, retain proposals, stages, and backups. The journal stores the reviewed digest, not the proposal path. Locate the retained proposal using your review notes and its `review.json`, then repeat acceptance from that verified proposal and digest. Regenerate and check afterward.

If the proposal is lost, preserve the journal and remaining recovery evidence. Obtain a repository containing the intended full pinned commit, propose it again, and review the new proposal and exact digest before acceptance. Compare the intended source manifest and adaptation inputs with your retained review evidence. Do not assume the partial current tree identifies the intended update. If you cannot establish the intended commit and inputs, stop for manual investigation. Do not delete the journal to bypass generation's blocker.

Source publication spans directories and is not a cross-directory atomic transaction. A journal or source mismatch blocks generation instead of treating a partial publication as accepted.

If generated output is interrupted or manually changed, inspect the diff first. Repair only after confirming the accepted source and intended adapters:

```sh
npm run upstream:repair -- generated
npm run check
```

Repair refuses unowned extra files. Move such files outside `generated/` yourself after reviewing them. Do not use repair to hide source drift. Orphaned `.mstack-source-*` or `.mstack-generated-*` staging directories are not registered resources. Remove them only after confirming no writer owns them and a successful check establishes the accepted tree.

## Reconstruct original source paths

Standard `npm pack` excludes `.gitignore`. The sole approved storage exception keeps its literal bytes as `upstream/pstack/__npm_reserved_gitignore__`. The manifest retains source path `.gitignore`, its hash, its mode, and the storage path. All other source paths are unchanged. No tarball rewriting is used.

Export to a destination that does not exist:

```sh
npm run upstream:export -- --destination /absolute/path/to/new-source-tree
```

Export validates the snapshot and reconstructs original paths, hashes, and executable modes. The packed-package test repeats that check for all 573 records.

## Check the packed package

```sh
npm pack --ignore-scripts
npm run test:native
```

The ordinary tests pack and unpack the package into isolated directories, then run the shipped maintenance command and actual Pi entry points. The packed artifact contains `tools/`, `port/`, tests, documentation, and runtime resources. Development dependencies are not bundled.

In a checkout, use `npm ci --ignore-scripts`. Standard npm omits the lockfile from packed packages, so use `npm install --ignore-scripts` to install development dependencies in an unpacked artifact. Java, TLC, rendering packages, forge access, and paid models are not prerequisites for the port contract suite.
