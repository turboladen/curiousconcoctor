# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## What this is

This repository holds the source for curiousconcoctor.com, a homebrewing blog (mead, cider, liqueur)
built with the [Zola](https://www.getzola.org) static site generator. Most of the content consists
of 2014-era brew logs ported into Markdown. There is no application code, and there are no tests.

## Commands

- `just serve` runs `zola serve`, a live-reloading dev server on http://127.0.0.1:1111.
- `just serve-and-open` does the same and opens a browser.
- `zola build` writes the site to `public/`, which is gitignored. `zola check` also validates links.
  Add `--skip-external-links` to check only internal links, which is fast and works offline.
- `dprint fmt` formats Markdown, TOML, and the other configured types. `dprint check` reports
  without writing. Markdown is hard-wrapped at 100 columns (`textWrap: always`), so reformatting a
  post reflows its paragraphs. Templates (`templates/**/*.html`) and the vendored
  `static/**/*.min.css` files are excluded from formatting.

## Content model

Posts live in `content/blog/`, sorted by date and rendered with `templates/blog-page.html`.

- A post without images is a flat file, `YYYY-MM-DD-slug.md`. A post with images is a directory,
  `YYYY-MM-DD-slug/index.md`, and its images sit beside `index.md`. Converting a flat post to a
  directory is how images get added to it.
- Posts embed images with raw `<image src="IMG_0050.jpeg" width="100%" alt="...">` tags that use
  paths relative to the post directory, not Markdown image syntax.
- Links between posts use Zola's `@/` form, e.g.
  `[text](@/blog/2014-03-15-pink-lady-cider-1/index.md)`. The target must match the file's current
  path, so moving a flat post into a directory breaks every `@/` link that points at it.
- Front matter is TOML (`+++`) with three taxonomies, all declared in `config.toml`:
  - `drink_types` holds one value: `mead`, `cider`, or `liqueur`.
  - `post_types` holds `start` for a batch's opening recipe post, `update` for a log entry, or
    `sidebar` for a standalone write-up.
  - `tags` holds ingredient tags plus a batch tag such as `"meyer lemon melomel #1"`. The batch tag
    is the only thing that groups a batch's `start` and `update` posts together.
- Post titles follow `"<Batch Name> #N: Update K"` for updates, and the slug ends in `-update-K`,
  `-bottling-day`, or `-taste-K`.

`content/pages/` holds one-off pages such as `resources.md`. They reuse the blog templates.

## Templates and styling

- `templates/base.html` defines the page shell: head and SEO meta, the header nav built from
  `extra.menu_links` in `config.toml`, and a default `content` block that lists every blog post
  grouped by year. `templates/index.html` overrides that block with placeholder text, so the home
  page does not show the year listing.
- Each taxonomy has `list.html` and `single.html` under `templates/<taxonomy>/`.
  `templates/components.html` holds `post_in_list`, which renders one post as a list item.
- CSS comes from the prebuilt `static/{light,dark,mono}.min.css` files, with `dark` applied through
  `prefers-color-scheme`. `base.html` also inlines `style.css` via `load_data`, but
  `sass/style.scss` is currently empty.
- `templates/_old-base.html` is not referenced by any other template.

## Tera 2

The site targets Zola 0.23, which uses Tera 2, and most Tera 1 examples found online no longer work:

- Macros and `{% import %}` no longer exist. Reusable fragments are components, defined with
  `{% component name(arg) %}` in `templates/components.html` and called as
  `{{<name arg={value} />}}`.
- Referencing an undefined variable is an error. `base.html` renders both pages and sections, so it
  guards page-only fields with `page is defined and ...`.
- A child template may only override blocks that a parent defines.
- `date` formats use strftime specifiers, and `%+` is not supported.
- Syntax highlighting is configured under `[markdown.highlighting]`, and `highlight_code` is
  rejected.

## Known gaps

These are visible in the current tree and may be intentional work in progress:

- The nav links to `/about`, but there is no about page in `content/`.
- The nav links to `/rss.xml`, but `config.toml` does not set `generate_feeds`.
- The README lists an open idea: separating recipe-and-log posts from reflective write-ups on the
  site.
