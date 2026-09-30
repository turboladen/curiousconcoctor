# 1. Lab notebook styling with our own Sass and self-hosted fonts

- **Status:** Accepted
- **Date:** 2026-09-29
- **Bead:** curiousconcoctor-fxq.8

## Context

The owner wants the site to have more visual character than plain monospace text on a gray page,
while keeping its simple, monospace feel. Four directions were mocked up: a lab notebook, an
apothecary label, a terminal log, and a bold zine. The lab notebook keeps the monospace feel while
adding paper, color, and a few handwritten touches, and it fits the content: dated brew logs,
gravity readings, and photos of each batch.

Several constraints shape how any restyle has to be built:

- The site is a GitHub Pages project site under `/curiousconcoctor/`, so every asset URL must go
  through `get_url` or be relative to the page.
- `base.html` inlines the compiled `style.css` into a `<style>` element, so a relative `url()` in
  that CSS resolves against each page's own path, not against the style sheet.
- Generic `monospace` and `sans-serif` stacks render in a different face on every operating system.
- A reversed `<ol>` read through `counter(list-item)` numbers inconsistently: on a normal page load,
  Chromium resolves the list's starting value before the items are parsed, so the numbers count down
  from zero.

## Decision

- **Direction:** the site looks like a lab notebook. Light mode is warm paper with a faint graph
  grid and a red margin rule. Dark mode is a navy "blueprint" with a light-blue grid. Both use a
  honey accent.
- **Style sheets:** all CSS is ours, written as Sass partials under `sass/` (`_tokens`, `_base`,
  `_layout`, `_brewlog`, `_post`) that `style.scss` pulls in with `@use`. No third-party CSS
  framework is vendored.
- **Colors:** every color is a custom property in `_tokens.scss`, defined once per theme. `--honey`
  is decorative only. Honey-colored text uses `--honey-ink`, text on a honey fill uses `--on-honey`,
  and every text color must pass WCAG AA (4.5:1) in both themes.
- **Fonts:** IBM Plex Mono for all text and Caveat for the tagline and post dates, both self-hosted
  as woff2 files in `static/fonts/` beside their OFL licenses. Their `@font-face` rules live in a
  `<style>` block in `base.html`, where each URL goes through `get_url`. The Caveat file is a subset
  of the full font, cut to the characters those two places draw.
- **Batch numbering:** the brew log is an `<ol reversed>` with an explicit `start`, and its badges
  read a named `batch` counter. `index.html` resets that counter inline to one more than the number
  of batch cards, counted with the same loop and test that renders them, and each card decrements
  it, so the oldest batch is always BATCH 01.

## Consequences

- The site looks the same on every operating system and makes no requests to third-party font hosts.
  The four font files add about 66 KB, loaded with `font-display: swap`.
- Styling changes go through the tokens and partials, and `.claude/rules/styling.md` records the
  rules above for future edits. There is no upstream framework to update, and nothing to override.
- The notebook direction sets the vocabulary for later design work: labeled tags on posts (fxq.5)
  and links between posts in a batch (fxq.6) should read as parts of the same notebook.
