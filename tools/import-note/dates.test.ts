import { expect, test } from "bun:test";
import { formatYmd, inferYears, parseDateLine, type RawDate } from "./dates";

test("parseDateLine accepts bare dates with stray punctuation and rejects prose", () => {
  expect(parseDateLine("9/24")).toMatchObject({ month: 9, day: 24, year: null, rest: "" });
  expect(parseDateLine("9/23/21")).toMatchObject({ month: 9, day: 23, year: 2021 });
  expect(parseDateLine("5/3/2020")).toMatchObject({ month: 5, day: 3, year: 2020 });
  expect(parseDateLine("2/19?")).toMatchObject({ month: 2, day: 19, year: null, stray: true });
  expect(parseDateLine("9/7.")).toMatchObject({ month: 9, day: 7, year: null, stray: true });
  expect(parseDateLine("**3/2**")).toMatchObject({ month: 3, day: 2, year: null, stray: false });
  expect(parseDateLine("9/20/30")).toMatchObject({ month: 9, day: 20, year: 2030 });
  expect(parseDateLine("12/30?/19")).toMatchObject({ month: 12, day: 30, year: 2019, stray: true });
  expect(parseDateLine("Pink Lady Cider 9/2019")).toBeNull();
  expect(parseDateLine("13/40")).toBeNull();
});

test("parseDateLine keeps the text that follows a date", () => {
  expect(parseDateLine("8/13/17: bottling")).toMatchObject({ month: 8, day: 13, year: 2017, rest: "bottling" });
  expect(parseDateLine("5/21. Racked")).toMatchObject({ month: 5, day: 21, rest: "Racked" });
  expect(parseDateLine("1/2/19, 8:00am")).toMatchObject({ year: 2019, rest: "8:00am" });
  expect(parseDateLine("7/29, 7:25pm")).toMatchObject({ month: 7, day: 29, rest: "7:25pm" });
  expect(parseDateLine("9/2/19 (Labor Day)")).toMatchObject({ year: 2019, rest: "(Labor Day)" });
  expect(parseDateLine("8/13/17 - bottling")).toMatchObject({ rest: "bottling" });
  expect(parseDateLine("**5/21: Racked**")).toMatchObject({ month: 5, day: 21, rest: "Racked" });
  expect(parseDateLine("**5/21**: Racked")).toMatchObject({ rest: "Racked" });
});

test("a date with an explicit year can be followed by text with no separator", () => {
  expect(parseDateLine("8/19/15 Juiced the peaches, added all pulp.")).toMatchObject({
    month: 8,
    day: 19,
    year: 2015,
    rest: "Juiced the peaches, added all pulp.",
  });
  expect(parseDateLine("9/6/2015 Bottling!")).toMatchObject({ year: 2015, rest: "Bottling!" });
});

test("parseDateLine reads dates written with a month name", () => {
  expect(parseDateLine("May 4, 2016")).toMatchObject({ month: 5, day: 4, year: 2016, rest: "" });
  expect(parseDateLine("Oct 2")).toMatchObject({ month: 10, day: 2, year: null, rest: "" });
  expect(parseDateLine("Oct. 3")).toMatchObject({ month: 10, day: 3, year: null });
  expect(parseDateLine("September 5: Bottled")).toMatchObject({ month: 9, day: 5, rest: "Bottled" });
  expect(parseDateLine("Sept 6, 2015 Racked it")).toMatchObject({ month: 9, year: 2015, rest: "Racked it" });
  expect(parseDateLine("May 4, 2016")?.raw).toBe("May 4, 2016");
});

test("a month-name date accepts a two-digit year only when nothing but punctuation follows", () => {
  expect(parseDateLine("May 4, 16")).toMatchObject({ month: 5, day: 4, year: 2016, rest: "" });
  expect(parseDateLine("May 4, 16: racked")).toMatchObject({ year: 2016, rest: "racked" });
  expect(parseDateLine("**May 4, 16**")).toMatchObject({ year: 2016, rest: "" });
  expect(parseDateLine("May 4, 16 oz bottles")?.year).toBeNull();
});

test("parseDateLine leaves prose that starts with a month word alone", () => {
  expect(parseDateLine("Marinated 3 days")).toBeNull();
  expect(parseDateLine("May add 2 cups")).toBeNull();
  expect(parseDateLine("March 3 cups honey")).toBeNull();
  expect(parseDateLine("Octane 4")).toBeNull();
});

test("parseDateLine leaves fractions and prose that start with numbers alone", () => {
  expect(parseDateLine("3/4t pectic enzyme")).toBeNull();
  expect(parseDateLine("1/2t pectic enzyme")).toBeNull();
  expect(parseDateLine("1/2 tsp yeast nutrient")).toBeNull();
  expect(parseDateLine("12/26 racked")).toBeNull();
});

const raw = (month: number, day: number, year: number | null = null): RawDate => ({
  month,
  day,
  year,
  raw: `${month}/${day}${year === null ? "" : `/${year}`}`,
  rest: "",
  stray: false,
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

test("a year in the future warns and names the date as written", () => {
  const { warnings } = inferYears([raw(9, 20, 2030)], { year: 2020, month: 8, day: 14 }, 2026);
  expect(warnings.some((w) => /future/.test(w) && w.includes("9/20/2030"))).toBe(true);
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
