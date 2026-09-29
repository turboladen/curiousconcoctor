---
paths:
  - "sass/**"
  - "static/*.css"
  - "templates/**"
---

# Styling

- CSS comes from the vendored `static/{light,dark,mono}.min.css` files, with `dark` applied through
  `prefers-color-scheme`. Site-specific styles go in `sass/style.scss`, which Zola compiles and
  `base.html` inlines through `load_data`. `mono.min.css` sets the root font size to 10px and
  restores 18px only on `.container`, so any element outside a `.container` renders at 10px.
- `zola serve` recompiles `style.css` when `sass/style.scss` changes, but pages keep the CSS that
  was inlined when the server started. Restart the server to see a style change.
- The header, the page content, and the footer each carry the `container content` classes, which
  keep all three on the same column.
