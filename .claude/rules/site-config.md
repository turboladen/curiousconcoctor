---
paths:
  - "config.toml"
---

# Site configuration

What `config.toml` turns on.

- `config.toml` turns on feeds with `generate_feeds` and names them `rss.xml`, so Zola builds
  `/rss.xml` from its built-in RSS template, plus a feed for each term of the taxonomies that set
  `feed = true`, such as `/drink-types/mead/rss.xml`. Each item's content carries `xml:base` set to
  the post's URL, which is how readers resolve the posts' relative image paths. A page with
  `include_in_feeds = false` in its front matter, such as Resources, stays out of the feeds.
- Syntax highlighting is configured under `[markdown.highlighting]`, and `highlight_code` is
  rejected.
