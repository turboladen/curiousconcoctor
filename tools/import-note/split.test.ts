import { expect, test } from "bun:test";
import type { Line } from "./html";
import { splitEntries } from "./split";

const t = (md: string): Line => ({ kind: "text", md });
const created = { year: 2017, month: 2, day: 17 };

test("the text before the first date joins the first entry", () => {
  const lines = [t("3.5G juice"), t("2/15"), t("Juiced."), t("3/2"), t("Racked.")];
  const { entries, dated } = splitEntries(lines, created, 2026);
  expect(dated).toBe(true);
  expect(entries.map((e) => e.date)).toEqual([
    { year: 2017, month: 2, day: 15 },
    { year: 2017, month: 3, day: 2 },
  ]);
  expect(entries[0].lines).toEqual([t("3.5G juice"), t("Juiced.")]);
  expect(entries[1].lines).toEqual([t("Racked.")]);
});

test("a note with no date lines becomes one entry on its creation date", () => {
  const { entries, dated } = splitEntries([t("just notes")], created, 2026);
  expect(dated).toBe(false);
  expect(entries).toEqual([{ date: created, lines: [t("just notes")] }]);
});

test("image lines stay in the entry they sit in", () => {
  const lines: Line[] = [t("2/15"), t("a"), { kind: "image", index: 0 }, t("3/2"), t("b")];
  const { entries } = splitEntries(lines, created, 2026);
  expect(entries[0].lines).toEqual([t("a"), { kind: "image", index: 0 }]);
});

test("text after a date starts that entry", () => {
  const lines = [t("ingredients"), t("5/21. Racked"), t("Cleared."), t("8/13/17: bottling")];
  const { entries } = splitEntries(lines, created, 2026);
  expect(entries.map((e) => e.date)).toEqual([
    { year: 2017, month: 5, day: 21 },
    { year: 2017, month: 8, day: 13 },
  ]);
  expect(entries[0].lines).toEqual([t("ingredients"), t("Racked"), t("Cleared.")]);
  expect(entries[1].lines).toEqual([t("bottling")]);
});

test("a date line with stray punctuation warns and names the line", () => {
  const { warnings } = splitEntries([t("2/19?"), t("note")], created, 2026);
  expect(warnings.some((w) => w.includes("2/19?") && /punctuation/.test(w))).toBe(true);
});
