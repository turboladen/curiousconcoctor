// Converts the HTML that Apple Notes returns for a note into Markdown lines plus decoded images.

export type Image = { mime: string; bytes: Uint8Array };
export type Line = { kind: "text"; md: string } | { kind: "image"; index: number };
export type Converted = { lines: Line[]; images: Image[]; warnings: string[] };

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1].toLowerCase() === "x";
      return String.fromCodePoint(parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
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
    .replace(/<\/?(b|strong)\b[^>]*>/gi, "**")
    .replace(/<\/?(i|em)\b[^>]*>/gi, "*")
    .replace(/<[^>]+>/g, "");

  const lines: Line[] = [];
  for (const raw of decodeEntities(flattened).split("\n")) {
    const md = raw.replace(/\*\*\s*\*\*/g, "").replace(/\s+/g, " ").trim();
    if (md === "" || /^\*+$/.test(md)) continue;
    const image = /^\u0000IMG(\d+)\u0000$/.exec(md);
    lines.push(image ? { kind: "image", index: Number(image[1]) } : { kind: "text", md });
  }

  const first = lines[0];
  if (first?.kind === "text" && first.md.replace(/^## /, "").replace(/\*/g, "") === title) {
    lines.shift();
  }
  return { lines, images, warnings };
}
