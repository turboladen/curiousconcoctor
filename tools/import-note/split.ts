// Splits a note's lines into one entry per dated log line.

import { inferYears, parseDateLine, type RawDate, type Ymd } from "./dates";
import type { Line } from "./html";

export type Entry = { date: Ymd; lines: Line[] };

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
  for (const line of lines) {
    const date = line.kind === "text" ? parseDateLine(line.md) : null;
    if (date) {
      raws.push(date);
      bodies.push([]);
    } else {
      (bodies.length > 0 ? bodies[bodies.length - 1] : preamble).push(line);
    }
  }
  if (raws.length === 0) {
    return { entries: [{ date: created, lines: preamble }], dated: false, warnings: [] };
  }
  const { dates, warnings } = inferYears(raws, created, maxYear);
  const entries = bodies.map((body, i) => ({ date: dates[i], lines: body }));
  entries[0].lines = [...preamble, ...entries[0].lines];
  return { entries, dated: true, warnings };
}
