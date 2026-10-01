// Splits a note's lines into one entry per dated log line.

import { inferYears, parseDateLine, type RawDate, type Ymd } from "./dates";
import type { Line } from "./html";

export type Entry = { date: Ymd; lines: Line[] };

// Keeps a standalone note whole: every line, date lines included, stays in one entry on the note's
// creation date.
export function singleEntry(lines: Line[], created: Ymd): Entry[] {
  return [{ date: created, lines }];
}

// The text before the first date is the batch's ingredient list. It joins the first dated entry,
// which makes the start post.
export function splitEntries(
  lines: Line[],
  created: Ymd,
  maxYear: number,
): { entries: Entry[]; dated: boolean; warnings: string[] } {
  const preamble: Line[] = [];
  const raws: RawDate[] = [];
  const bodies: Line[][] = [];
  const warnings: string[] = [];
  for (const line of lines) {
    const date = line.kind === "text" ? parseDateLine(line.md) : null;
    if (date) {
      raws.push(date);
      bodies.push(date.rest === "" ? [] : [{ kind: "text", md: date.rest }]);
      if (date.stray) warnings.push(`the date line "${date.raw}" has stray punctuation`);
    } else {
      (bodies.length > 0 ? bodies[bodies.length - 1] : preamble).push(line);
    }
  }
  if (raws.length === 0) {
    return { entries: [{ date: created, lines: preamble }], dated: false, warnings };
  }
  const inferred = inferYears(raws, created, maxYear);
  warnings.push(...inferred.warnings);
  const entries = bodies.map((body, i) => ({ date: inferred.dates[i], lines: body }));
  entries[0].lines = [...preamble, ...entries[0].lines];
  return { entries, dated: true, warnings };
}
