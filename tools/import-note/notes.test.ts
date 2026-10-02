import { expect, test } from "bun:test";
import { type Attachment, CREATED_SCRIPT, parseCreated, unimportedAttachments } from "./notes";

const attachment = (name: string, day = 12): Attachment => ({
  name,
  created: { year: 2016, month: 10, day },
});

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

test("a video attachment is named with its date", () => {
  const warnings = unimportedAttachments(
    [attachment("IMG_1.JPG"), attachment("trim.ABC.MOV", 5)],
    1,
  );
  expect(warnings).toEqual([
    "attachment \"trim.ABC.MOV\" from 2016-10-05 is not a photo and was not imported",
  ]);
});

test("photos with any extension case produce no warning when every one was decoded", () => {
  const attachments = [attachment("a.jpg"), attachment("b.JPEG"), attachment("c.Heic")];
  expect(unimportedAttachments(attachments, 3)).toEqual([]);
});

test("a photo missing from the body warns with the counts", () => {
  const warnings = unimportedAttachments([attachment("a.jpg"), attachment("b.png")], 1);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("2 photo attachments");
  expect(warnings[0]).toContain("1 image");
});

test("an attachment with no extension is not a photo", () => {
  expect(unimportedAttachments([attachment("scan")], 0)).toHaveLength(1);
});
