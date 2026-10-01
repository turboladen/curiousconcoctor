// Imports one note from Apple Notes Hobbies/Homebrew as draft blog posts.
//
// Usage:
//   bun tools/import-note.ts --list
//   bun tools/import-note.ts "<note title>" --drink-type <type> [--tags a,b] [--title T]
//     [--batch B] [--force] [--dry-run]
//   bun tools/import-note.ts "<note title>" --post-type note [--drink-type <type>] [--tags a,b]
//
// --post-type note imports the whole note as one standalone post dated by the note's creation
// date, with no batch tag. It is the only post type the flag accepts, and --drink-type is
// optional with it.
//
// The script writes drafts. Taxonomies, alt text, and the dates it warns about still need a human
// pass before the posts are committed.

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { formatYmd } from "./import-note/dates";
import { convertHtml } from "./import-note/html";
import { processImage } from "./import-note/images";
import { getNote, listNotes } from "./import-note/notes";
import { assignImages, batchTitle, buildPosts, dropEmpty, noteTitle } from "./import-note/posts";
import { singleEntry, splitEntries } from "./import-note/split";

const DRINK_TYPES = ["mead", "cider", "wine", "liqueur"];
const BLOG = join(import.meta.dir, "..", "content", "blog");

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: {
    list: { type: "boolean" },
    "drink-type": { type: "string" },
    "post-type": { type: "string" },
    tags: { type: "string" },
    title: { type: "string" },
    batch: { type: "string" },
    force: { type: "boolean" },
    "dry-run": { type: "boolean" },
  },
});

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

if (values.list) {
  for (const note of await listNotes()) {
    const images = `${note.imageCount}`.padStart(2);
    console.log(`${formatYmd(note.created)}  ${images} img  ${note.name}`);
  }
  process.exit(0);
}

const name = positionals[0];
if (!name) fail("give a note title, or --list");
const postType = values["post-type"];
if (postType !== undefined && postType !== "note") fail("--post-type can only be \"note\"");
const standalone = postType === "note";
const drinkType = values["drink-type"];
if (drinkType === undefined ? !standalone : !DRINK_TYPES.includes(drinkType)) {
  fail(`--drink-type is required and must be one of: ${DRINK_TYPES.join(", ")}`);
}

const { created, html } = await getNote(name);
const converted = convertHtml(html, name);
const split = standalone
  ? { entries: singleEntry(converted.lines, created), dated: false, warnings: [] as string[] }
  : splitEntries(converted.lines, created, new Date().getFullYear());

const processed = await Promise.all(converted.images.map(processImage));

const assigned = assignImages(
  split.entries,
  processed.map((p) => p.taken),
);
const kept = dropEmpty(assigned.entries);
if (kept.entries.length === 0) fail(`note "${name}" has no content`);

const title = values.title ?? (split.dated ? batchTitle(name) : noteTitle(name));
const batch = values.batch ?? (split.dated ? title.toLowerCase() : null);
if (split.dated && !batch?.includes("#")) {
  fail(`the batch tag "${batch}" needs a #, as in "just lemons #1"; pass --title or --batch with one`);
}
const posts = buildPosts(
  kept.entries,
  processed.map((p) => p.jpeg),
  {
    title,
    drinkTypes: drinkType === undefined ? [] : [drinkType],
    tags: (values.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    batch,
    dated: split.dated,
  },
);

const conflicts = posts.map((p) => p.path).filter((path) => existsSync(join(BLOG, path)));
if (conflicts.length > 0 && !values.force) {
  fail(`already exists (use --force to overwrite): ${conflicts.join(", ")}`);
}

if (!values["dry-run"]) {
  for (const post of posts) {
    const target = join(BLOG, post.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, post.content);
    for (const image of post.images) {
      await writeFile(join(dirname(target), image.name), image.bytes);
    }
  }
}

console.log(`${values["dry-run"] ? "Would write" : "Wrote"} ${posts.length} post(s) for "${name}":`);
for (const post of posts) console.log(`  ${post.path} (${post.images.length} image(s))`);
const warnings = [
  ...converted.warnings,
  ...split.warnings,
  ...processed.flatMap((p) => p.warnings),
  ...assigned.warnings,
  ...kept.warnings,
];
for (const warning of warnings) console.error(`warning: ${name}: ${warning}`);
