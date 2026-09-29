# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## What this is

This repository holds the source for The Curious Concoctor, a homebrewing blog (mead, cider,
liqueur) built with the [Zola](https://www.getzola.org) static site generator and published at
https://turboladen.github.io/curiousconcoctor/. Most of the content consists of 2014-era brew logs
ported into Markdown. There is no application code, and there are no tests.

## Commands

- `just serve` runs `zola serve`, a live-reloading dev server on http://127.0.0.1:1111.
- `just serve-and-open` does the same and opens a browser.
- `zola build` writes the site to `public/`, which is gitignored. `zola check` also validates links.
  Add `--skip-external-links` to check only internal links, which is fast and works offline.
- `dprint fmt` formats Markdown, TOML, and the other configured types. `dprint check` reports
  without writing. Markdown is hard-wrapped at 100 columns (`textWrap: always`), so reformatting a
  post reflows its paragraphs. Templates (`templates/**/*.html`), the vendored `static/**/*.min.css`
  files, and the files that `bd` writes are excluded from formatting. The beads block in this file
  sits between `dprint-ignore-start` and `dprint-ignore-end` markers, so `bd` can rewrite it.
- Running `zola build` while `zola serve` is up rewrites `public/`, which the server also reads, so
  pages can briefly load without CSS. Check styling after the build finishes.

## Rules files

Topic rules live in `.claude/rules/`. Each file loads only when Claude reads a file it covers.
Before creating a file under one of those paths, read the matching rules file first.

- `.claude/rules/content.md` covers posts, one-off pages, front matter, batch tags, and `@/` links.
- `.claude/rules/templates.md` covers `base.html`, page titles, the term pages, and the components.
- `.claude/rules/tera2.md` covers the Tera 2 syntax rules that templates must follow.
- `.claude/rules/styling.md` covers the CSS sources, the 10px root font size, and the `zola serve`
  CSS restart.
- `.claude/rules/icons.md` covers regenerating the icons and the share image.
- `.claude/rules/site-config.md` covers feeds, `include_in_feeds`, and syntax highlighting.
- `.claude/rules/deploy.md` covers the GitHub Pages deploy workflow, the pinned Zola release, and
  the subpath the site lives under.

## Known gaps

These are visible in the current tree and may be intentional work in progress:

- The nav links to `/about`, but there is no about page in `content/`.
- The README lists an open idea: separating recipe-and-log posts from reflective write-ups on the
  site.

<!-- dprint-ignore-start -->
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
<!-- dprint-ignore-end -->
