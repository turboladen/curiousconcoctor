---
paths:
  - "templates/**"
---

# Templates

How the Tera templates in `templates/` fit together.

- `templates/base.html` defines the page shell: head and SEO meta, the header nav built from
  `extra.menu_links` in `config.toml`, and a default `content` block that lists every blog post
  grouped by year. `templates/index.html` overrides that block with the brew log: every batch,
  newest start date first, rendered by the `batch_summary` component, and then the `sidebar` posts
  under Notes.
- `base.html` builds each page's `<title>` and `og:title` from a `page_title` it computes: the post
  or page title, the `term_title` component's wording on term pages, the taxonomy name on taxonomy
  list pages, or the section title. The home page's title is the site name alone. Tera 2 does not
  let a block appear twice or a child template set top-level variables, so one block cannot feed
  both `<title>` and `og:title`, and `base.html` computes the title itself.
- Each taxonomy has `list.html` and `single.html` under `templates/<taxonomy>/`. Each `single.html`
  heads its page with what it lists, such as "Tagged: lemon", shows a post count, and lists posts
  with `post_in_list`, newest first. A batch tag's page is its brew log, listed oldest first.
  `templates/components.html` holds `post_in_list`, which renders one post as a list item,
  `batch_summary`, which renders one batch on the home page, and `term_title`, which words a term
  page's heading and title.
- `templates/_old-base.html` is not referenced by any other template.
