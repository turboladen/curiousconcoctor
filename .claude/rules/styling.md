---
paths:
  - "sass/**"
  - "static/fonts/**"
  - "tools/fonts/**"
  - "templates/**"
---

# Styling

- All CSS lives in `sass/`. `style.scss` only pulls in the partials: `_tokens.scss` holds the color
  and font custom properties for the light paper theme and the dark blueprint theme, `_base.scss`
  styles plain elements, `_layout.scss` holds the column, header, and footer, `_brewlog.scss` holds
  the batch labels, and `_post.scss` holds post dates, photo frames, the "Filed under" line, and the
  counts on term pages.
- Zola compiles `style.scss`, and `base.html` inlines the result through `load_data`.
- Colors come only from the tokens. `--honey` is decorative and fails contrast as text, so
  honey-colored text uses `--honey-ink`. Every text color must pass 4.5:1 in both themes.
- The fonts are self-hosted woff2 files in `static/fonts/`, beside their OFL licenses. Their
  `@font-face` rules live in `base.html`, not in Sass, because each URL must go through `get_url`. A
  relative `url()` in the inlined CSS would resolve against each page's own path.
- The Caveat file in `static/fonts/` is a subset that holds only the characters in
  `tools/fonts/caveat-glyphs.txt`: the tagline, digits, the month abbreviations, a comma, and a
  space. The full font lives beside it as `tools/fonts/caveat-latin-500-normal.full.woff2`, which
  Zola does not build. `just subset-caveat` rebuilds the subset from the full font with
  `pyftsubset`, keeping every layout feature, because Caveat's contextual alternates give its
  lettering a hand-drawn look. Changing the tagline or the date format means editing the glyph file
  and running the recipe. `tools/check-site.ts` fails when the tagline or a post date uses a
  character the file lacks.
- `zola serve` recompiles `style.css` when a Sass file changes, but pages keep the CSS that was
  inlined when the server started. Restart the server to see a style change.
- The header, the page content, and the footer each carry the `container` class. They stack with no
  vertical margins, so their left borders form one continuous margin rule. Give them vertical space
  with `padding-block`, because the `padding` shorthand also resets the column's left padding.
- The brew log's badges read a named `batch` counter that `index.html` resets inline to one more
  than the number of batch cards, and each card decrements it. The count uses the same loop and test
  as the cards, so the oldest batch is always BATCH 01. The list keeps `reversed` and an explicit
  `start` for its own semantics, but the badges never read the built-in `list-item` counter, whose
  behavior on reversed lists differs between engines.
