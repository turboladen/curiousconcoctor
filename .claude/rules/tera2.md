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
