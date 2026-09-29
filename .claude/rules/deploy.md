---
paths:
  - ".github/**"
  - "config.toml"
---

# Deployment

- The site is published at https://turboladen.github.io/curiousconcoctor/, a GitHub Pages project
  site. `config.toml`'s `base_url` names that address, and `zola serve` overrides it locally.
- The site lives under the `/curiousconcoctor/` subpath, so every link must go through `get_url` or
  be relative. A root-absolute path such as `/icon-192.png` points outside the site. This applies to
  static files too, such as the icon paths in `site.webmanifest`.
- `.github/workflows/deploy.yml` builds and deploys on every push to `main`, and it can also be run
  by hand from the Actions tab. It runs `zola build` and `zola check --skip-external-links` before
  publishing, so a broken build or internal link stops the deploy.
- The workflow downloads a pinned Zola release and verifies its SHA-256 before using it. To upgrade
  Zola, change `ZOLA_VERSION` and `ZOLA_SHA256` together. Take the checksum from the release asset's
  `digest` (`gh api repos/getzola/zola/releases/tags/v<version>`) or compute it with
  `shasum -a 256`. The site depends on Tera 2 features, so check the Zola changelog before
  upgrading.
- Each action is pinned to a commit SHA with its version in a comment. Dependabot updates those
  pins. It cannot see the Zola version or the dprint plugin URLs in `dprint.jsonc`, so those are
  updated by hand.
- The repository's Pages source is set to GitHub Actions. That is a one-time repository setting, not
  part of the workflow.
- To rehearse a deploy locally, build with
  `zola build --base-url http://127.0.0.1:8765/curiousconcoctor -o <dir>/curiousconcoctor`, serve
  `<dir>` with `python3 -m http.server 8765`, and open http://127.0.0.1:8765/curiousconcoctor/.
  Browser caches keep old copies of files at the same URL, so fetch with `cache: "no-store"` when
  checking changed files.
