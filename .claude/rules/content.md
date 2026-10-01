---
paths:
  - "content/**"
  - "templates/index.html"
  - "templates/components.html"
---

# Content

Posts live in `content/blog/`, sorted by date and rendered with `templates/blog-page.html`.

- A post without images is a flat file, `YYYY-MM-DD-slug.md`. A post with images is a directory,
  `YYYY-MM-DD-slug/index.md`, and its images sit beside `index.md`. Converting a flat post to a
  directory is how images get added to it.
- Posts embed images with Markdown syntax, `![alt text](IMG_0050.jpeg)`, using paths relative to the
  post directory. Every image needs alt text that describes what the photo shows. The stylesheet
  sets the width, so no `width` attribute is needed.
- The template renders the title as the page's only `h1`, so Markdown headings in a post or page
  start at `##`.
- Links between posts use Zola's `@/` form, e.g.
  `[text](@/blog/2014-03-15-pink-lady-cider-1/index.md)`. The target must match the file's current
  path, so moving a flat post into a directory breaks every `@/` link that points at it.
- Front matter is TOML (`+++`) with three taxonomies, all declared in `config.toml`:
  - `drink_types` holds one value: `mead`, `cider`, `wine`, or `liqueur`. Zola creates a term the
    first time a post uses it, so a new type needs no change to `config.toml` or the templates.
  - `post_types` holds `start` for a batch's opening recipe post, `update` for a log entry, or
    `note` for a standalone write-up. The `note` term is listed on the home page, linked in the nav
    as Notes, and titled "Notes" on its page.
  - `tags` holds ingredient tags plus a batch tag such as `"meyer lemon melomel #1"`. The batch tag
    is the only thing that groups a batch's `start` and `update` posts together. The home page
    treats any tag whose name contains `#` as a batch tag, so a batch tag needs a `#` and no other
    tag may have one.
- Zola orders posts with the same date by permalink, so two posts in one batch must not share a
  `date`. Give the later one a time, such as `date = 2014-08-05T21:00:00`. Pages show only the day.
- A batch's posts share a slug stem and a title prefix, such as `meyer-lemon-melomel-1` and "Meyer
  Lemon Melomel #1". The start post's slug usually ends with the stem, sometimes after a phrase, as
  in `the-next-step-meyer-lemon-melomel-1`, but a few differ, such as `blackberry-pear-melomel`
  without its `-1`. Later posts add a suffix, and the tree uses these variants:
  - `-update-K`, titled "Update K" or occasionally "Update #K", for log entries.
  - `-bottling-day`, titled "Bottling Day!" or "Bottling Day".
  - `-taste-K` and `-tasting-K`, titled "Taste #K", "Tasting K", or "Tasting #K", for tasting notes.
  - `-last-taste`, titled "Last Taste".
- Standalone write-ups, such as `2014-07-22-i-learned-some-stuff-about-kmeta`, have no batch stem.
- Term pages build at hyphenated paths, such as `public/drink-types/wine/index.html` and
  `public/post-types/note/index.html`. Check the term page after a post introduces a new term.

`content/pages/` holds one-off pages such as `resources.md`. They reuse the blog templates.
