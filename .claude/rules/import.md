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
- The script writes drafts. After an import, read every warning, check each date against the note's
  plain text, write alt text for every image, and set the taxonomies. Posts follow
  `.claude/rules/content.md`.
- A note with dated log lines becomes a batch: the text before the first date and the first entry
  make the start post, and each later date makes an update post. A note with no dated lines becomes
  one `note` post. Entries with no text and no images are not written.
- Most log dates omit the year, so `dates.ts` infers it from the last explicit year or the note's
  creation date. A month that drops by one or two is treated as a typo and keeps the year. Every
  inferred date still needs a human check. A date line may carry text after a separator, as in
  `5/21. Racked` or `8/13/17: bottling`, and that text starts the entry. A line such as `1/2 tsp` is
  never read as a date.
- Images go to the post whose date matches the photo's EXIF capture date, and otherwise stay with
  the entry they sat beside. The importer resizes each image to 1600px on the long side and removes
  every metadata segment, GPS included. `sips` keeps EXIF through a resize, so `stripJpegMetadata`
  removes it afterward.
- `osascript` and `sips` are used only in `notes.ts` and `images.ts`. Every other module is pure,
  and `bun test tools` must pass on Linux because CI runs it there.
- `tools/check-site.ts` fails the build if a published JPEG records a GPS location.
