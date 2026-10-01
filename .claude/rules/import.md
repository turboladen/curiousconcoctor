---
paths:
  - "tools/import-note.ts"
  - "tools/import-note/**"
---

# Importing Apple Notes

- `just list-notes` prints the notes in Apple Notes `Hobbies/Homebrew`, oldest first.
  `just import-note "<note title>" --drink-type <type>` writes draft posts for one note. Add
  `--dry-run` to see what it would write, `--title` and `--batch` to override the generated title
  and batch tag, `--tags a,b` for ingredient tags, and `--force` to overwrite existing posts.
- `--post-type note` imports a note that is not a brew log, such as a study note, as one standalone
  `note` post dated by the note's creation date. The note's own date lines stay in the text. A brew
  always has exactly one drink type, so `--drink-type` is required for it. A note is not a drink, so
  `--drink-type` is an error for a note, whether it came from `--post-type note` or has no dated
  lines, and the post gets `drink_types = []`.
- The script writes drafts. After an import, read every warning, check each date against the note's
  plain text, write alt text for every image, and set the taxonomies. Posts follow
  `.claude/rules/content.md`.
- A note with dated log lines becomes a batch: the text before the first date and the first entry
  make the start post, and each later date makes an update post. A note with no dated lines becomes
  one `note` post. Entries with no text and no images are not written.
- Most log dates omit the year, so `dates.ts` infers it from the last explicit year or the note's
  creation date. A month that drops by one or two is treated as a typo and keeps the year. Every
  inferred date still needs a human check. A date line may carry text after a separator, as in
  `5/21. Racked` or `8/13/17: bottling`, and that text starts the entry. A date with an explicit
  year may be followed by text with no separator, as in `8/19/15 Juiced the peaches`. Dates written
  with a month name, such as `May 4, 2016` or `Oct 2`, are read too, and a two-digit year counts
  there only when nothing but punctuation follows it. A line such as `1/2 tsp` is never read as a
  date, and neither is prose that merely starts with a month word.
- Lines made only of dashes, em dashes, underscores, or equals signs are dropped, even a single one,
  but a list item is never a divider. Bold and italic render as nested Markdown spans with their
  inner whitespace moved outside the markers, and a span that crosses a line break is closed and
  reopened on each line. Literal asterisks in a note are left alone.
- Images go to the post whose date matches the photo's EXIF capture date, and otherwise stay with
  the entry they sat beside. The importer resizes each image to 1600px on the long side and removes
  every metadata segment, GPS included. `sips` keeps EXIF through a resize, so `stripJpegMetadata`
  removes it afterward.
- `osascript` and `sips` are used only in `notes.ts` and `images.ts`. Every other module is pure,
  and `bun test tools` must pass on Linux because CI runs it there.
- `tools/check-site.ts` fails the build if a published JPEG records a GPS location.
- Read the source before editing a draft:
  `osascript -e 'tell application "Notes" to get plaintext of note "<title>" of folder "Homebrew"'`.
  Before a PR, run `grep -rn '!\[\](' content/blog` (empty alt text; expect no output),
  `dprint fmt`, and `just check`, then open the built pages for the batch.
- When a note converts badly, fix the converter with a failing test instead of hand-editing the
  draft. Then convert every note with the old and the new code and diff the lines, because all the
  notes share it. Notes' HTML has quirks: `&amp` without a semicolon, bold runs that hold only a
  space, dividers that contain NUL characters, and photos whose EXIF orientation `sips` does not
  report. Fetch a raw body with
  `osascript -e 'tell application "Notes" to get body of note "<title>" of folder "Homebrew"'`.
- After a script rewrites a draft, print and read the result again. `just check` cannot catch
  scrambled prose. Stage files by explicit path, never `git add -A`, so edits made in the working
  tree by someone else are not swept into a commit.
