---
paths:
  - "tools/check-site.ts"
  - "Justfile"
---

# Site checks

- `tools/check-site.ts` checks a finished build, not the sources, so it sees what readers get. Run
  it with `just check`, or run `bun tools/check-site.ts <dir>` on a build made with the `base_url`
  in `config.toml`. It has no dependencies: Bun parses the HTML with its built-in `HTMLRewriter` and
  imports `config.toml` directly. Keep it free of dependencies and `package.json`; it may import
  other files under `tools/`, such as `import-note/images.ts` for the GPS check.
- A check is a generator function passed to `check()`. It takes the `Site` and yields
  `[path, message]` pairs, one per failure. `site.pages` maps each built HTML file to a parsed
  `Page`, and `site.sitePath` and `site.serves` turn a URL into a site path and test whether the
  build serves it.
- Add a check before the fix it guards, and watch it fail on the current build first. A check that
  never failed may not test anything. For a check that should never fire, break a copy of the build
  on purpose and confirm that the check catches it.
- `site.documents()` yields the URLs of every page and of the web manifest's icons. Each page
  contributes its `href`, `src`, `og:image`, `og:url`, and inline `<style>` `url()` values. Add a
  new source there, such as `srcset`, when the site starts using one.
- `KNOWN_MISSING` lists linked paths that do not exist yet. An entry that starts resolving fails the
  run, so delete it when its page lands.
- Node's `posix.dirname` drops a trailing slash, so resolve relative URLs against `dirOf`, which
  keeps a page's own directory.
- Two checks guard the videos. `videosHaveControlsAndCaptions` needs every `<video>` to have
  controls and a non-empty caption in `figure.video`. `videoFilesAreSmallAndPrivate` fails any MP4,
  MOV, M4V, or WebM over 10 MB, or one that records a location, which `tools/video.ts` detects in
  the QuickTime location tag and the `©xyz` atom.
