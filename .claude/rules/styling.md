---
paths:
  - "sass/**"
  - "static/fonts/**"
  - "templates/**"
---

# Styling

- All CSS lives in `sass/`. `style.scss` only pulls in the partials: `_tokens.scss` holds the color
  and font custom properties for the light paper theme and the dark blueprint theme, `_base.scss`
  styles plain elements, `_layout.scss` holds the column, header, and footer, `_brewlog.scss` holds
  the batch labels, and `_post.scss` holds post dates and photo frames.
- Zola compiles `style.scss`, and `base.html` inlines the result through `load_data`.
- Colors come only from the tokens. `--honey` is decorative and fails contrast as text, so
  honey-colored text uses `--honey-ink`. Every text color must pass 4.5:1 in both themes.
- Keep every Sass file ASCII-only. A non-ASCII character, even written as an escape, makes the
  compiler start `style.css` with a byte-order mark, and inside the inlined `<style>` element that
  mark breaks the first rule. Put glyphs in templates instead.
- The fonts are self-hosted woff2 files in `static/fonts/`, beside their OFL licenses. Their
  `@font-face` rules live in `base.html`, not in Sass, because each URL must go through `get_url`. A
  relative `url()` in the inlined CSS would resolve against each page's own path.
- `zola serve` recompiles `style.css` when a Sass file changes, but pages keep the CSS that was
  inlined when the server started. Restart the server to see a style change.
- The header, the page content, and the footer each carry the `container` class. They stack with no
  vertical margins, so their left borders form one continuous margin rule. Give them vertical space
  with `padding-block`, because the `padding` shorthand also resets the column's left padding.
- The brew log's `<ol reversed>` sets `start` explicitly from a count of the batch tags. Chromium
  can fix a reversed list's start while the list is still parsing, before any items exist, so the
  batch badges would count down from zero.
