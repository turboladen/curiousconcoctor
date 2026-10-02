// Imports one note from Apple Notes Hobbies/Homebrew as draft blog posts.
//
// Usage:
//   bun tools/import-note.ts --list
//   bun tools/import-note.ts "<note title>" --drink-type <type> [--tags a,b] [--title T]
//     [--batch B] [--force] [--dry-run]
//   bun tools/import-note.ts "<note title>" --post-type note [--tags a,b]
//
// --post-type note imports the whole note as one standalone post dated by the note's creation
// date, with no batch tag. It is the only post type the flag accepts. A note is not a drink, so
// --drink-type is an error for a note, including a note with no dated lines.
//
// The script writes drafts. Taxonomies, alt text, and the dates it warns about still need a human
// pass before the posts are committed.

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { type ExistingPost, findCollisions, parseTags } from "./import-note/collisions";
import { formatYmd } from "./import-note/dates";
import { convertHtml } from "./import-note/html";
import { processImage } from "./import-note/images";
import { getNote, listNotes, unimportedAttachments } from "./import-note/notes";
import {
  assignImages,
  batchTitle,
  type BuildOptions,
  buildPosts,
  dropEmpty,
  noteTitle,
  slugify,
} from "./import-note/posts";
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
if (drinkType !== undefined && !DRINK_TYPES.includes(drinkType)) {
  fail(`--drink-type must be one of: ${DRINK_TYPES.join(", ")}`);
}

const { created, html, attachments } = await getNote(name);
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
const tags = (values.tags ?? "")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);
let options: BuildOptions;
if (split.dated) {
  if (drinkType === undefined) fail(`--drink-type is required (${DRINK_TYPES.join(", ")})`);
  const batch = values.batch ?? title.toLowerCase();
  if (!batch.includes("#")) {
    fail(`the batch tag "${batch}" needs a #, as in "just lemons #1"; pass --title or --batch with one`);
  }
  options = { kind: "batch", title, tags, drinkType, batch };
} else {
  if (drinkType !== undefined) fail("this imports as a note, and a note is not a drink; omit --drink-type");
  options = { kind: "note", title, tags };
}
const posts = buildPosts(
  kept.entries,
  processed.map((p) => p.jpeg),
  options,
);

// Existing posts that an import would overwrite are governed by the path check below, so they are
// left out here.
async function readExistingPosts(skip: Set<string>): Promise<ExistingPost[]> {
  const found: ExistingPost[] = [];
  for (const entry of await readdir(BLOG, { withFileTypes: true })) {
    if (entry.name === "_index.md") continue;
    const file = entry.isDirectory() ? `${entry.name}/index.md` : entry.name;
    if (!file.endsWith(".md") || skip.has(file) || !existsSync(join(BLOG, file))) continue;
    const text = await readFile(join(BLOG, file), "utf8");
    found.push({ name: entry.name.replace(/\.md$/, ""), tags: parseTags(text) });
  }
  return found;
}

if (!values.force) {
  const batch = options.kind === "batch" ? options.batch : null;
  const clash = findCollisions(
    await readExistingPosts(new Set(posts.map((p) => p.path))),
    slugify(title),
    batch,
  );
  if (clash.posts.length > 0) {
    const shown = clash.posts.slice(0, 3).join(", ");
    const more = clash.posts.length > 3 ? `, and ${clash.posts.length - 3} more` : "";
    const hint = clash.nextNumber === null || batch === null || !/#\d+/.test(title)
      ? "pass --title with a different name"
      : `try --title "${title.replace(/#\d+/, `#${clash.nextNumber}`)}" --batch "${
        batch!.replace(/#\d+/, `#${clash.nextNumber}`)
      }"`;
    fail(`"${title}" collides with existing posts (${shown}${more}); ${hint}, or use --force`);
  }
}

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
  ...(attachments === null
    ? ["could not read the note's attachment list, so non-photo attachments are not reported"]
    : unimportedAttachments(attachments, converted.images.length)),
  ...split.warnings,
  ...processed.flatMap((p) => p.warnings),
  ...assigned.warnings,
  ...kept.warnings,
];
for (const warning of warnings) console.error(`warning: ${name}: ${warning}`);
