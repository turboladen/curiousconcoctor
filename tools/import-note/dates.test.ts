import { expect, test } from "bun:test";
import { formatYmd, inferYears, parseDateLine, type RawDate } from "./dates";

test("parseDateLine accepts bare dates with stray punctuation and rejects prose", () => {
  expect(parseDateLine("9/24")).toEqual({ month: 9, day: 24, year: null });
  expect(parseDateLine("9/23/21")).toEqual({ month: 9, day: 23, year: 2021 });
  expect(parseDateLine("5/3/2020")).toEqual({ month: 5, day: 3, year: 2020 });
  expect(parseDateLine("2/19?")).toEqual({ month: 2, day: 19, year: null });
  expect(parseDateLine("9/7.")).toEqual({ month: 9, day: 7, year: null });
  expect(parseDateLine("**3/2**")).toEqual({ month: 3, day: 2, year: null });
  expect(parseDateLine("9/20/30")).toEqual({ month: 9, day: 20, year: 2030 });
  expect(parseDateLine("Pink Lady Cider 9/2019")).toBeNull();
  expect(parseDateLine("12/26 racked")).toBeNull();
  expect(parseDateLine("13/40")).toBeNull();
});

const raw = (month: number, day: number, year: number | null = null): RawDate => ({
  month,
  day,
  year,
});
const created = { year: 2016, month: 1, day: 16 };
const years = (dates: { year: number }[]) => dates.map((d) => d.year);

test("years carry forward from explicit years", () => {
  const entries = [
    raw(1, 16, 2016),
    raw(1, 19, 2016),
    raw(1, 31),
    raw(3, 6),
    raw(5, 7, 2016),
    raw(7, 18),
    raw(10, 9),
    raw(12, 17, 2016),
    raw(5, 29, 2017),
  ];
  const { dates, warnings } = inferYears(entries, created, 2026);
  expect(years(dates)).toEqual([2016, 2016, 2016, 2016, 2016, 2016, 2016, 2016, 2017]);
  expect(warnings).toEqual([]);
});

test("a month that wraps backwards by more than two advances the year", () => {
  const { dates } = inferYears(
    [raw(12, 20), raw(12, 28), raw(1, 3)],
    { year: 2019, month: 12, day: 20 },
    2026,
  );
  expect(years(dates)).toEqual([2019, 2019, 2020]);
});

test("a first date before the creation date keeps the creation year", () => {
  const { dates } = inferYears([raw(2, 12)], { year: 2018, month: 2, day: 14 }, 2026);
  expect(formatYmd(dates[0])).toBe("2018-02-12");
});

test("a one-month back-step is treated as a typo, keeps the year, and warns", () => {
  const { dates, warnings } = inferYears([raw(10, 19, 2015), raw(9, 30)], created, 2026);
  expect(years(dates)).toEqual([2015, 2015]);
  expect(warnings.some((w) => /before the previous entry/.test(w))).toBe(true);
});

test("a year in the future warns", () => {
  const { warnings } = inferYears([raw(9, 20, 2030)], { year: 2020, month: 8, day: 14 }, 2026);
  expect(warnings.some((w) => /future/.test(w))).toBe(true);
});

test("an impossible day is clamped with a warning", () => {
  const { dates, warnings } = inferYears(
    [raw(2, 30, 2019)],
    { year: 2019, month: 2, day: 1 },
    2026,
  );
  expect(formatYmd(dates[0])).toBe("2019-02-28");
  expect(warnings).toHaveLength(1);
});
