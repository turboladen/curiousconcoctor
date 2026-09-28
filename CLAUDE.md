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


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:1105d646 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
