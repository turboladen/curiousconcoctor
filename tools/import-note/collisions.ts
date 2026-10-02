// Finds existing posts that a new batch would collide with. Zola rejects two posts with the same
// slug and merges posts that share a taxonomy term, so both have to be caught before any file is
// written.

import { slugify } from "./posts";

export type ExistingPost = { name: string; tags: string[] };
export type Collisions = { posts: string[]; nextNumber: number | null };

// Reads the quoted strings in the `tags = [...]` array of a post's front matter. dprint wraps a
// long array over several lines, so the array may span them.
export function parseTags(frontMatter: string): string[] {
  const array = /^tags\s*=\s*\[((?:"(?:[^"\\]|\\.)*"|[^\]"])*)\]/m.exec(frontMatter);
  if (!array) return [];
  return [...array[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\(.)/g, "$1"));
}

// The batch tag without its trailing number, as in "pink lady cider" for "pink lady cider #3".
const batchBase = (tag: string) => slugify(tag.slice(0, Math.max(0, tag.lastIndexOf("#"))));

// Returns the number to suggest for a batch whose tag is taken: one more than the highest `#N`
// among existing tags that share the batch's base, or null when the batch tag has no `#N`.
export function nextNumber(existing: ExistingPost[], batch: string): number | null {
  if (!/#\d+/.test(batch.slice(batch.lastIndexOf("#")))) return null;
  const base = batchBase(batch);
  let highest = 0;
  for (const post of existing) {
    for (const tag of post.tags) {
      const number = /#(\d+)(?!.*#)/.exec(tag)?.[1];
      if (number !== undefined && batchBase(tag) === base) highest = Math.max(highest, Number(number));
    }
  }
  return highest + 1;
}

export function findCollisions(
  existing: ExistingPost[],
  stem: string,
  batch: string | null,
): Collisions {
  const batchSlug = batch === null ? null : slugify(batch);
  const posts = existing
    .filter((post) => {
      const slug = post.name.replace(/^\d{4}-\d{2}-\d{2}-/, "");
      const sameSlug = slug === stem || slug.startsWith(`${stem}-`);
      const sameTag = batchSlug !== null && post.tags.some((tag) => slugify(tag) === batchSlug);
      return sameSlug || sameTag;
    })
    .map((post) => post.name);
  return { posts, nextNumber: posts.length > 0 && batch !== null ? nextNumber(existing, batch) : null };
}
