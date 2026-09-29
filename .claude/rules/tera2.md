---
paths:
  - "templates/**"
---

# Tera 2

The site targets Zola 0.23, which uses Tera 2, and most Tera 1 examples found online no longer work:

- Macros and `{% import %}` no longer exist. Reusable fragments are components, defined with
  `{% component name(arg) %}` in `templates/components.html` and called as
  `{{<name arg={value} />}}`.
- Referencing an undefined variable is an error. `base.html` renders both pages and sections, so it
  guards page-only fields with `page is defined and ...`.
- A child template may only override blocks that a parent defines.
- `date` formats use strftime specifiers, and `%+` is not supported.
- `map`, `filter`, `concat`, and `slice` no longer exist. To count or collect across a loop, use
  `set_global`, because a plain `set` inside a loop is scoped to that iteration.
- An attribute cannot be read straight off a function call, as in `get_taxonomy(kind="tags").items`.
  Assign the result with `set` first.
