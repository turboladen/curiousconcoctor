// Converts the HTML that Apple Notes returns for a note into Markdown lines plus decoded images.

export type Image = { mime: string; bytes: Uint8Array };
export type Line = { kind: "text"; md: string } | { kind: "image"; index: number };
export type Converted = { lines: Line[]; images: Image[]; warnings: string[] };

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
};

// Notes sometimes writes an ampersand entity without its semicolon, as in "&amp stirred", and
// browsers accept that for a few legacy entities.
function decodeEntities(s: string): string {
  return s.replace(
    /&(?:(#x[0-9a-f]+|#\d+|[a-z]+);|(amp|lt|gt|quot|nbsp)(?![a-z0-9]))/gi,
    (match, withSemicolon: string | undefined, legacy: string | undefined) => {
      const entity = withSemicolon ?? legacy!;
      if (entity[0] === "#") {
        const hex = entity[1].toLowerCase() === "x";
        return String.fromCodePoint(parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
      }
      return ENTITIES[entity.toLowerCase()] ?? match;
    },
  );
}

// Bold and italic tags become private-use characters first, so literal asterisks in a note's text
// are never mistaken for emphasis. They turn into Markdown markers only after each line is balanced.
const BOLD_OPEN = "\uE000";
const BOLD_CLOSE = "\uE001";
const ITALIC_OPEN = "\uE002";
const ITALIC_CLOSE = "\uE003";
const EMPHASIS_CHARS = /[\uE000-\uE003]/g;

// Emphasis can open on one line and close on a later one. Each line has to be balanced by itself,
// so the open styles carry over: a line closes them at its end and the next line reopens them.
function balance(line: string, carried: string[]): { line: string; open: string[] } {
  const open = [...carried];
  for (const c of line) {
    if (c === BOLD_OPEN || c === ITALIC_OPEN) {
      open.push(c);
    } else if (c === BOLD_CLOSE || c === ITALIC_CLOSE) {
      const index = open.lastIndexOf(c === BOLD_CLOSE ? BOLD_OPEN : ITALIC_OPEN);
      if (index >= 0) open.splice(index, 1);
    }
  }
  const closers = open
    .map((c) => (c === BOLD_OPEN ? BOLD_CLOSE : ITALIC_CLOSE))
    .reverse()
    .join("");
  return { line: carried.join("") + line + closers, open };
}

// Markdown does not close emphasis that has whitespace just inside its markers, so the whitespace
// moves outside. Emphasis around nothing but whitespace leaves only the whitespace.
function wrapEmphasis(mark: string, inner: string): string {
  const core = inner.trim();
  if (core === "") return inner;
  const lead = inner.slice(0, inner.length - inner.trimStart().length);
  const trail = inner.slice(inner.trimEnd().length);
  return `${lead}${mark}${core}${mark}${trail}`;
}

// Renders one balanced line, nesting each style inside the one that opened first.
function renderEmphasis(line: string): string {
  let i = 0;
  const run = (closer: string | null, active: Set<string>): string => {
    let out = "";
    while (i < line.length) {
      const c = line[i++];
      if (c === BOLD_OPEN || c === ITALIC_OPEN) {
        const bold = c === BOLD_OPEN;
        const mark = bold ? "**" : "*";
        const inner = run(bold ? BOLD_CLOSE : ITALIC_CLOSE, new Set([...active, mark]));
        out += active.has(mark) ? inner : wrapEmphasis(mark, inner);
      } else if (c === BOLD_CLOSE || c === ITALIC_CLOSE) {
        if (c === closer) return out;
      } else {
        out += c;
      }
    }
    return out;
  };
  return run(null, new Set());
}

// Each non-empty line becomes its own paragraph later, so the output has no hard line breaks.
export function convertHtml(html: string, title: string): Converted {
  const images: Image[] = [];
  const warnings: string[] = [];
  if (/<table/i.test(html)) warnings.push("contains a table, which is not converted");
  if (/class="Checklist"/i.test(html)) warnings.push("contains a checklist");
  if (/<object/i.test(html)) warnings.push("contains a non-image attachment");

  const withImageMarkers = html.replace(
    /<img\b[^>]*\bsrc="data:([^;"]+);base64,([^"]+)"[^>]*>/gi,
    (_match, mime: string, data: string) => {
      images.push({ mime, bytes: Buffer.from(data, "base64") });
      return `\n\u0000IMG${images.length - 1}\u0000\n`;
    },
  );

  const flattened = withImageMarkers
    .replace(/<h1[^>]*>/gi, "\n## ")
    .replace(/<h2[^>]*>/gi, "\n### ")
    .replace(/<h3[^>]*>/gi, "\n#### ")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(div|p|h[1-6]|li|ul|ol)>|<br\s*\/?>/gi, "\n")
    .replace(/<(b|strong)\b[^>]*>/gi, BOLD_OPEN)
    .replace(/<\/(b|strong)>/gi, BOLD_CLOSE)
    .replace(/<(i|em)\b[^>]*>/gi, ITALIC_OPEN)
    .replace(/<\/(i|em)>/gi, ITALIC_CLOSE)
    .replace(/<[^>]+>/g, "");

  const lines: Line[] = [];
  let open: string[] = [];
  for (const raw of decodeEntities(flattened).split("\n")) {
    // An image keeps its own line however much emphasis surrounds it.
    const image = /^\s*\u0000IMG(\d+)\u0000\s*$/.exec(raw.replace(EMPHASIS_CHARS, ""));
    if (image) {
      lines.push({ kind: "image", index: Number(image[1]) });
      continue;
    }
    const balanced = balance(raw, open);
    open = balanced.open;
    const md = renderEmphasis(balanced.line).replace(/\s+/g, " ").trim();
    if (md === "" || /^\*+$/.test(md)) continue;
    // Dividers between entries are visual only, and Markdown would render them as rules. A list
    // item is never a divider, even when its text is a dash.
    if (!md.startsWith("- ") && /^[\p{Pd}_=\s\u0000]+$/u.test(md)) continue;
    lines.push({ kind: "text", md });
  }

  const first = lines[0];
  if (first?.kind === "text" && first.md.replace(/^## /, "").replace(/\*/g, "") === title) {
    lines.shift();
  }
  return { lines, images, warnings };
}
