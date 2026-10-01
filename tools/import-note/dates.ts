// Parses the date-only lines that start a log entry and fills in the years the author left out.

export type Ymd = { year: number; month: number; day: number };
// raw is the date as written, rest is any text that followed it on the same line, and stray is true
// when the date carried punctuation that the author probably did not mean.
export type RawDate = {
  month: number;
  day: number;
  year: number | null;
  raw: string;
  rest: string;
  stray: boolean;
};

const DATE_HEAD = /^\**(\d{1,2})\/(\d{1,2})(\?)?(?:\/(\d{4}|\d{2}))?\**/;
// A date may be followed by text only after a separator, so "1/2 tsp" and "3/4t" stay text.
const SEPARATOR = /^(?:\s*[:.,;]\s+|\s*[-–—]\s+|\s+(?=\())(.+)$/;

export function parseDateLine(md: string): RawDate | null {
  const head = DATE_HEAD.exec(md);
  if (!head) return null;
  const month = Number(head[1]);
  const day = Number(head[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const year = head[4] === undefined ? null : head[4].length === 2 ? 2000 + Number(head[4]) : Number(head[4]);

  const tail = md.slice(head[0].length);
  let rest = "";
  let stray = head[3] !== undefined;
  if (tail !== "") {
    if (/^[^\w\s]{1,3}\**$/.test(tail)) {
      stray = true;
    } else {
      const separated = SEPARATOR.exec(tail);
      if (!separated) return null;
      rest = separated[1].trim();
      // A line such as "**5/21: Racked**" opens bold inside the date match and closes it in the text.
      const unclosed = (/^\**/.exec(head[0])![0].length) - (/\**$/.exec(head[0])![0].length);
      if (unclosed > 0) rest = rest.replace(new RegExp(`\\*{1,${unclosed}}$`), "");
    }
  }
  return { month, day, year, raw: head[0].replace(/\*/g, ""), rest, stray };
}

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

export const toDays = (d: Ymd) => Date.UTC(d.year, d.month - 1, d.day) / 86_400_000;

export const formatYmd = (d: Ymd) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

function closestYear(month: number, day: number, created: Ymd): number {
  let best = created.year;
  let bestDiff = Infinity;
  for (const year of [created.year - 1, created.year, created.year + 1]) {
    const date = { year, month, day: Math.min(day, daysIn(year, month)) };
    const diff = Math.abs(toDays(date) - toDays(created));
    if (diff < bestDiff) {
      best = year;
      bestDiff = diff;
    }
  }
  return best;
}

// A month that drops by one or two is far more likely a typo than a new year, so the year only
// advances when the month falls by three or more.
export function inferYears(
  raws: RawDate[],
  created: Ymd,
  maxYear: number,
): { dates: Ymd[]; warnings: string[] } {
  const dates: Ymd[] = [];
  const warnings: string[] = [];
  let prev: Ymd | null = null;
  for (const entry of raws) {
    const label = entry.raw;
    let year: number;
    if (entry.year !== null) year = entry.year;
    else if (prev === null) year = closestYear(entry.month, entry.day, created);
    else if (entry.month < prev.month) {
      year = prev.month - entry.month <= 2 ? prev.year : prev.year + 1;
    } else year = prev.year;

    const day = Math.min(entry.day, daysIn(year, entry.month));
    if (day !== entry.day) {
      warnings.push(`${label} is not a real day in ${year}; used ${entry.month}/${day}`);
    }
    const date = { year, month: entry.month, day };

    if (entry.year === null && Math.abs(year - created.year) > 1) {
      warnings.push(
        `${label}: inferred year ${year} is over a year from the note's creation date ${formatYmd(created)}`,
      );
    }
    if (year > maxYear) warnings.push(`${label}: year ${year} is in the future`);
    if (prev !== null) {
      const gap = toDays(date) - toDays(prev);
      if (gap < 0) {
        warnings.push(
          `${label} (${formatYmd(date)}) comes before the previous entry ${formatYmd(prev)}`,
        );
      } else if (gap > 365) {
        warnings.push(
          `${label} (${formatYmd(date)}) is ${Math.round(gap)} days after the previous entry ${formatYmd(prev)}`,
        );
      }
    }
    dates.push(date);
    prev = date;
  }
  return { dates, warnings };
}
