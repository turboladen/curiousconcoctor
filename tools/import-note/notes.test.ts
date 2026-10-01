import { expect, test } from "bun:test";
import { CREATED_SCRIPT, parseCreated } from "./notes";

test("parseCreated reads year-month-day", () => {
  expect(parseCreated("2017-2-17")).toEqual({ year: 2017, month: 2, day: 17 });
});

test("parseCreated rejects text that is not a date instead of returning NaN", () => {
  expect(() => parseCreated("2017, -, 2, -, 17")).toThrow("creation date");
  expect(() => parseCreated("")).toThrow("creation date");
});

// An AppleScript integer on the left of & builds a list, not text, so the first operand must be
// coerced explicitly.
test("the creation-date script starts from text", () => {
  expect(CREATED_SCRIPT.startsWith("((year of d) as string)")).toBe(true);
});
