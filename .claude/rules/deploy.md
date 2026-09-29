---
paths:
  - ".github/**"
  - "Justfile"
  - "config.toml"
  - "templates/**"
  - "content/**"
  - "sass/**"
  - "static/site.webmanifest"
---

# Deployment

- The site is published at https://turboladen.github.io/curiousconcoctor/, a GitHub Pages project
  site. `config.toml`'s `base_url` names that address, and `zola serve` overrides it locally.
- The site lives under the `/curiousconcoctor/` subpath, so every link must go through `get_url`,
  use an `@/` link in content, or be relative. A root-absolute path such as `/icon-192.png` points
  outside the site. This applies to static files too, such as the icon paths in `site.webmanifest`.
- `.github/workflows/deploy.yml` builds and deploys on every push to `main`, and it can also be run
  by hand from the Actions tab. It runs `zola build`, `zola check --skip-external-links`, and
  `tools/check-site.ts` before publishing, so a broken build, link, or site check stops the deploy.
- `.github/workflows/ci.yml` runs the same build and checks on every pull request, plus
  `dprint check`. `just check` runs them locally. Keep the Zola install in `ci.yml` identical to the
  one in `deploy.yml`.
- The workflow installs Zola with `taiki-e/install-action`, pinned to an exact version in its
  `tool: zola@<version>` input. The action checks the release against its own checksum manifest, and
  `fallback: none` makes a version missing from that manifest fail the build. To upgrade Zola,
  change the version in `tool`. The site depends on Tera 2 features, so check the Zola changelog
  before upgrading.
- Each action is pinned to a commit SHA with its version in a comment. Dependabot
  (`.github/dependabot.yml`) opens a weekly pull request when a pinned action releases, and it
  updates the SHA and the comment together. It cannot see tool versions passed as inputs, so these
  are updated by hand: the Zola version in `tool` and the `bun-version`, both set in both workflows,
  the `dprint-version` in `ci.yml`, and the dprint plugin URLs in `dprint.jsonc`.
- Both workflows run on `ubuntu-24.04`, not `ubuntu-latest`, so a runner image change arrives as a
  deliberate edit rather than a surprise. Dependabot does not bump it.
- `ci.yml` also runs `zizmor`, which audits the workflows and `dependabot.yml` and fails on any
  finding. Its version is pinned in `ci.yml` and `Justfile`, and it is updated by hand.
- The workflows default to `contents: read`. Only the deploy job gets `pages: write` and
  `id-token: write`, which `deploy-pages` needs. Checkouts set `persist-credentials: false`, since
  no step pushes.
- The repository's Pages source is set to GitHub Actions. That is a one-time repository setting, not
  part of the workflow.
- To rehearse a deploy locally, build with
  `zola build --base-url http://127.0.0.1:8765/curiousconcoctor -o <dir>/curiousconcoctor`, serve
  `<dir>` with `python3 -m http.server 8765`, and open http://127.0.0.1:8765/curiousconcoctor/.
  Browser caches keep old copies of files at the same URL, so fetch with `cache: "no-store"` when
  checking changed files.
