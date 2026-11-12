# Versioning and release reference

## Version policy

`package.json` owns the package version. Root and root-package versions in `package-lock.json` must match. `CHANGELOG.md` requires a matching `## [VERSION]` heading. Tags use exactly `vVERSION`.

Versions describe the Pi port, not upstream pstack. The upstream commit and adaptation digest are separate identities. Published versions are immutable.

Before 1.0, compatible fixes use patch increments; incompatible changes use minor increments with migration notes. After 1.0, incompatible changes use major increments. Compatible features use minor increments. Automation currently accepts stable `major.minor.patch` only. Prereleases and additional dist-tags require a separate policy.

Subsequent automated publication rejects existing versions and versions no newer than npm's stable `latest`. Initial publication is a separate operator action.

## Local commands

| Command | Effect |
| --- | --- |
| `npm run release:check` | Checks identity, public npm configuration, stable version, lockfile and changelog. |
| `npm run release:pack` | Checks metadata and accepted generated resources, then writes a standard archive and manifest under `dist/`. |
| `npm run release:verify` | Checks archive integrity, identity, version and packed changelog against the checkout. |
| `node scripts/release.mjs available` | Reads registry state and rejects used or non-increasing versions. Requires an existing package. |

Commands accept `--tag vVERSION`; use the npm argument separator when invoking through `npm run`. Release commands require a source checkout with `package-lock.json`, which npm does not ship. Packing does not replace the full test suite.

`dist/release.json` contains `name`, `version`, `filename`, and SHA-512 SRI `integrity`. It detects byte changes against that manifest, not independent authorisation. The workflow transfers the archive between jobs and pins the publishing checkout to the preparation commit.

`prepack` checks generated resources. `prepublishOnly` checks release metadata. These are convenience guards, not access controls; `--ignore-scripts` bypasses them. The release workflow validates explicitly before publishing its verified archive with lifecycle scripts disabled.

## CI

`.github/workflows/ci.yml` runs on pull requests, pushes to `main`, and manual dispatch. Actions are pinned to immutable commit IDs.

| Job | Intended coverage |
| --- | --- |
| Ubuntu 24.04 / Node 22.19.0 | Declared minimum runtime. |
| Ubuntu 24.04 / Node 24 | LTS and release environment. |
| Ubuntu 24.04 / Node 26 | Development runtime family. |
| macOS 15 / Node 26 | POSIX/PTY development platform family. |
| Pinned upstream Git inventory | Fetches the exact pinned source commit and enables real-tree inventory checks. |

Matrix jobs install the lockfile without lifecycle scripts, check generation and types, run tests, validate metadata, and pack and verify the archive. Artefacts are retained for 14 days. Contract tests use scripted providers and isolated environments, not model credentials. The pinned-source job depends on public GitHub availability.

This matrix is configured coverage, not evidence of successful remote runs. Local checks and Actions results must be reported separately. Windows remains outside the tested contract.

## Repository protections

`main` requires a pull request, an up-to-date branch, resolved conversations, and all nine CI/statechart checks from GitHub Actions. These requirements include administrators. Force pushes and branch deletion are disabled. Required approval count is zero so a sole maintainer can merge after checks pass; an independent approval is not claimed.

Release tags matching `v*` cannot be updated or deleted. Secret scanning and push protection are enabled, along with Dependabot vulnerability alerts and security updates. Actions default to read-only permissions and cannot approve pull requests. The `npm` environment permits deployment only from protected branches; publication still requires explicit workflow dispatch.

## Publication workflow

`.github/workflows/release.yml` accepts manual dispatch from `main`. `tag` is required; `publish` defaults to false. A pushed tag or ordinary CI run cannot publish. Release dispatches are serialised without cancellation.

Preparation validates tag syntax, tag identity, equality to the dispatched `main` SHA, main ancestry, metadata and tests. The exact-SHA restriction keeps npm provenance aligned with the packaged source. Publication depends on preparation, uses the `npm` environment, and receives read access plus an OIDC identity token. Environment protection and trusted-publisher settings require separate remote configuration. The workflow creates neither tags nor GitHub Releases nor npm accounts.

`.github/dependabot.yml` proposes npm updates weekly and action updates monthly. It neither merges nor publishes them automatically.

See the [release guide](../how-to/release.md) for approval, bootstrap and recovery steps.
