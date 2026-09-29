---
paths:
  - "static/favicon.svg"
  - "static/*.png"
  - "static/site.webmanifest"
  - "tools/icons/**"
---

# Icons and share image

How the site icon, app icons, and share image are made.

- `static/favicon.svg` is the site icon's source, and the pages in `tools/icons/` render the PNGs
  from it. Zola does not build `tools/`. To regenerate, serve the repo root with
  `python3 -m http.server`, open each page in Playwright with the viewport set to the file's size,
  and save a screenshot into `static/` with `scale: 'css'`:
  - `render-icon.html` at 32, 192, and 512 for `favicon-32x32.png`, `icon-192.png`, and
    `icon-512.png`, with `omitBackground: true` so the tile's corners stay transparent.
  - `render-touch.html` at 180 for `apple-touch-icon.png`, which is opaque.
  - `render-og.html` at 1200×630 for `og-image.png`. Its fonts are `-apple-system` and Menlo, so it
    matches the committed image only when rendered on macOS.
