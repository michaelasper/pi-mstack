# Prepare and publish an npm release

Release preparation is separate from public publication. At preparation time, `npm view pi-mstack` returned 404 and `npm whoami` returned 401. Those historical observations neither reserve the name nor grant publishing permission.

## Prepare a version

1. Start from a clean checkout of `main`. Read the [release policy](../reference/releases.md).
2. Retain `0.1.0` for the first release. For subsequent releases, update both manifests without creating a tag:

   ```sh
   npm version patch --no-git-tag-version --ignore-scripts
   ```

   Use `minor` or `major` when the compatibility change requires it. Never reuse a published version.
3. Move relevant notes from `[Unreleased]` into a `## [VERSION]` heading in `CHANGELOG.md`. Include migration requirements.
4. If `tools/` or `port/` changed, complete [upstream acceptance](../maintenance.md). A package version bump alone does not require importer re-acceptance.
5. Run:

   ```sh
   npm ci --ignore-scripts
   npm run check
   npm run typecheck
   npm test
   npm run release:check
   npm run release:pack
   npm run release:verify
   ```

6. Review the diff and `dist/release.json`. Commit the version, lockfile, changelog, and reviewed source changes. Merge through review and wait for all CI jobs to pass. Do not commit `dist/`.
7. With release approval, create an annotated tag on that reviewed commit. For the first version:

   ```sh
   git tag -a v0.1.0 -m 'Release 0.1.0'
   git push origin v0.1.0
   ```

   Substitute the actual version. Never move a published tag. Pushing a tag alone does not publish to npm.

## Rehearse the GitHub release

Dispatch **npm release** from `main`, supply the existing version tag, and leave **publish** unchecked. The tag must identify the exact `main` commit used for dispatch, not an older ancestor. This keeps the package source aligned with npm provenance. If `main` has moved, prepare a newly reviewed version/tag instead of bypassing the gate. The workflow verifies main ancestry and tag identity, runs the suite, creates and verifies a tarball, and performs `npm publish --dry-run`. Review its logs and download the `npm-release` artefact.

A rehearsal does not reserve the package name or prove npm authentication, trusted-publisher configuration, or account permission.

## Bootstrap the first npm version

The package must exist before its npm settings can normally be configured for trusted publishing. Bootstrapping is a separate, explicitly approved account operation.

1. Confirm name availability and approval to publish publicly.
2. Sign in interactively with `npm login`, confirm `npm whoami`, and follow account 2FA requirements. Never commit credentials or put them in recorded command arguments.
3. Use the approved tag checkout. Put the exact tarball and `release.json` from the successful rehearsal into `dist/`. Run `npm run release:verify -- --tag v0.1.0`.
4. After final approval, publish that verified archive:

   ```sh
   npm publish ./dist/pi-mstack-0.1.0.tgz --access public --ignore-scripts
   ```

   Local bootstrap does not claim GitHub OIDC provenance. Do not add `--provenance` outside a supported provenance environment.
5. Compare `npm view pi-mstack@0.1.0 dist.integrity` with `dist/release.json`. Confirm the package page and test the exact published version in a disposable Pi environment before announcing it.

If the name is unavailable, stop and decide the naming change explicitly. Do not silently publish a different package.

## Configure subsequent trusted releases

In npm package settings, add a GitHub Actions trusted publisher for owner `michaelasper`, repository `pi-mstack`, workflow filename `release.yml`, and environment `npm`.

In GitHub settings, create the `npm` environment with a required reviewer and deployment branches restricted to `main`. Reviewers should check the tag, commit, CI and rehearsal. Naming an environment in YAML does not configure approval rules. Keep dependency updates subject to review.

The workflow uses GitHub-hosted runners, Node 24 and npm 11.6.2. Only the publication job receives `id-token: write`. No persistent npm token is configured. Consult [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for account requirements.

Dispatch **npm release** from `main`, choose the reviewed tag, and explicitly enable **publish**. Preparation runs again. Publication waits for configured environment approval, downloads the prepared archive, verifies it against the exact prepared commit, and rejects used versions or versions no newer than `latest`. It publishes that archive with provenance and checks registry integrity.

If verification fails after publication, inspect the registry before retrying. Publication may already have succeeded. Never overwrite or silently unpublish a version to recover.

## Install a published version

Only after registry verification succeeds:

```sh
pi install npm:pi-mstack@0.1.0
```

Use the intended published version. The separate pi-loop and pi-subagents requirements still apply. Disable a competing checkout installation before loading the npm package.
