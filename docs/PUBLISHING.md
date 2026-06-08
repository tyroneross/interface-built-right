<!-- SPDX-FileCopyrightText: 2025-2026 Tyrone Ross, Jr <46267523+tyroneross@users.noreply.github.com> -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Publishing

`@tyroneross/interface-built-right` publishes to **two registries** on every
GitHub Release. The two are independent — one failing does not block the other.

| Registry | Workflow | Auth | Provenance |
|---|---|---|---|
| **GitHub Packages** (`npm.pkg.github.com`) | `.github/workflows/publish-github-packages.yml` | `GITHUB_TOKEN` (built-in) | no |
| **npmjs** (`registry.npmjs.org`) | `.github/workflows/publish-npm.yml` | **OIDC trusted publishing** (no token) | yes (auto) |

Both fire on `release: published` and support a manual `workflow_dispatch` with a
`dry_run` input. Both release workflows use GitHub-hosted `ubuntu-latest`,
Node 24, `actions/checkout@v6`, `actions/setup-node@v6`, and disabled
package-manager cache. Both enforce the same guards on release events: the
release tag must match `package.json` version, and `.claude-plugin` /
`.codex-plugin` manifest versions must agree with it.

## Why the npmjs workflow uses OIDC (not a token)

npm **permanently revoked all classic/automation tokens on 2025-12-09**; only
granular access tokens remain, and they expire and must be rotated. **OIDC
trusted publishing** (GA since 2025-07) is the durable path for CI: GitHub Actions
mints a short-lived id-token, npm verifies it against a trusted-publisher record,
and **no secret is stored**. The workflow also passes `--provenance` so npm
emits a signed **provenance attestation**, which is why `repository.url` in
`package.json` must exactly match this repo.

Requirements baked into the npmjs workflow: `permissions: id-token: write`,
GitHub-hosted runners (`ubuntu-latest`; self-hosted runners are not supported),
npm CLI ≥ 11.5.1 (Node 24 + a defensive `npm i -g npm@latest`), disabled
package-manager cache for the release build, and an explicit
`--registry https://registry.npmjs.org` on `npm publish` — that flag is
**required** because
`package.json#publishConfig.registry` points at GitHub Packages and would
otherwise redirect the npmjs publish.

## One-time setup before the npmjs workflow can run

OIDC can only publish **updates** to a package that **already exists** on npmjs,
and only after a trusted publisher is registered. Do these once, in order:

1. **Bootstrap-publish v1 manually** from a machine logged into npm (`npm login`
   as the account that owns / will own the `@tyroneross` scope):

   ```bash
   npm publish --access public --registry https://registry.npmjs.org
   ```

   OIDC cannot create a brand-new package, so this first publish must be manual.

2. **Register the trusted publisher** on npmjs.com → the package page →
   **Settings → Trusted Publisher → Add**:

   | Field | Value |
   |---|---|
   | Provider | GitHub Actions |
   | Owner / repository | `tyroneross/interface-built-right` |
   | Workflow filename | `publish-npm.yml` |
   | Environment | _(leave blank — none is configured)_ |
   | Allowed actions | Select `npm publish` |

After that, every published GitHub Release publishes to npmjs automatically with
no secret to manage.

## Cutting a release

1. Bump `package.json`, `package-lock.json`, `.claude-plugin/plugin.json`, and
   `.codex-plugin/plugin.json` to the same version (the workflows fail the
   release if they drift).
2. Verify the package contents with `npm pack --dry-run --json --registry https://registry.npmjs.org`.
3. Rehearse both publish workflows via **workflow_dispatch** with `dry_run: true`.
4. Tag and create a GitHub Release (`vX.Y.Z`). Both publish workflows run.
5. Watch the publish workflows and the chained GitHub Packages install
   verification workflow before announcing the release.
