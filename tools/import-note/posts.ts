// Places images on posts and renders posts to files, following .claude/rules/content.md.

import { formatYmd, toDays, type Ymd } from "./dates";
import type { Line } from "./html";
import type { Entry } from "./split";

export type PostFile = {
  path: string;
  content: string;
  images: { name: string; bytes: Uint8Array }[];
};
export type BuildOptions = {
  title: string;
  drinkType: string;
  tags: string[];
  batch: string | null;
  dated: boolean;
};

const SMALL_WORDS = new Set(["and", "of", "with", "the", "a", "in"]);

export function noteTitle(name: string): string {
  return name
    .split(" ")
    .map((word, i) =>
      i > 0 && SMALL_WORDS.has(word.toLowerCase())
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

export function batchTitle(name: string): string {
  const title = noteTitle(name);
  return title.includes("#") ? title : `${title} #1`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’'"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const NEAR_DAYS = 3;

// An image moves to the entry that shares its capture day. Otherwise it stays beside the text it
// sat next to in the note.
export function assignImages(
  entries: Entry[],
  taken: (Ymd | null)[],
): { entries: Entry[]; warnings: string[] } {
  const result = entries.map((e) => ({ date: e.date, lines: [...e.lines] }));
  const warnings: string[] = [];
  const moves: { from: number; line: Line; to: number }[] = [];
  entries.forEach((entry, from) => {
    for (const line of entry.lines) {
      if (line.kind !== "image") continue;
      const when = taken[line.index];
      if (!when) continue;
      const to = result.findIndex((e) => toDays(e.date) === toDays(when));
      if (to >= 0) {
        if (to !== from) moves.push({ from, line, to });
      } else if (Math.abs(toDays(when) - toDays(entry.date)) > NEAR_DAYS) {
        warnings.push(
          `image taken ${formatYmd(when)} sits in the entry for ${formatYmd(entry.date)}`,
        );
      }
    }
  });
  for (const move of moves) {
    result[move.from].lines = result[move.from].lines.filter((l) => l !== move.line);
    result[move.to].lines.push(move.line);
  }
  return { entries: result, warnings };
}

export function dropEmpty(entries: Entry[]): { entries: Entry[]; warnings: string[] } {
  const warnings: string[] = [];
  const kept = entries.filter((entry) => {
    if (entry.lines.length > 0) return true;
    warnings.push(
      `the entry for ${formatYmd(entry.date)} has no text or images and was not written`,
    );
    return false;
  });
  return { entries: kept, warnings };
}

const quote = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;

function frontMatter(
  title: string,
  date: string,
  drinkType: string,
  tags: string[],
  postType: string,
) {
  return [
    "+++",
    `title = ${quote(title)}`,
    `date = ${date}`,
    "",
    "[taxonomies]",
    `drink_types = [${quote(drinkType)}]`,
    `tags = [${tags.map(quote).join(", ")}]`,
    `post_types = [${quote(postType)}]`,
    "+++",
    "",
  ].join("\n");
}

// Consecutive bullets share one list; every other line is its own paragraph.
function joinBody(parts: string[]): string {
  return parts.reduce((body, part, i) => {
    if (i === 0) return part;
    const list = part.startsWith("- ") && parts[i - 1].startsWith("- ");
    return body + (list ? "\n" : "\n\n") + part;
  }, "");
}

export function buildPosts(entries: Entry[], jpegs: Uint8Array[], opts: BuildOptions): PostFile[] {
  const stem = slugify(opts.title);
  const perDay = new Map<string, number>();
  let updates = 0;
  return entries.map((entry, i) => {
    const day = formatYmd(entry.date);
    const nth = perDay.get(day) ?? 0;
    perDay.set(day, nth + 1);
    const date = nth === 0 ? day : `${day}T${String(12 + nth).padStart(2, "0")}:00:00`;

    const postType = !opts.dated ? "note" : i === 0 ? "start" : "update";
    if (postType === "update") updates += 1;
    const title = postType === "update" ? `${opts.title}: Update ${updates}` : opts.title;
    const slug = postType === "update" ? `${stem}-update-${updates}` : stem;
    const tags = opts.dated && opts.batch ? [...opts.tags, opts.batch] : opts.tags;

    const images: PostFile["images"] = [];
    const parts = entry.lines.map((line) => {
      if (line.kind === "text") return line.md;
      const name = `photo-${images.length + 1}.jpg`;
      images.push({ name, bytes: jpegs[line.index] });
      return `![](${name})`;
    });
    const base = `${day}-${slug}`;
    return {
      path: images.length > 0 ? `${base}/index.md` : `${base}.md`,
      content: `${frontMatter(title, date, opts.drinkType, tags, postType)}\n${joinBody(parts)}\n`,
      images,
    };
  });
}
