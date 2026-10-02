import { expect, test } from "bun:test";
import { findCollisions, nextNumber, parseTags } from "./collisions";

const post = (name: string, ...tags: string[]) => ({ name, tags });
const existing = [
  post("2014-03-15-pink-lady-cider-1", "apple", "pink lady cider #1"),
  post("2014-03-16-pink-lady-cider-1-update-1", "pink lady cider #1"),
  post("2014-04-18-pink-lady-cider-2", "pink lady cider #2"),
  post("2019-09-02-pink-lady-cider-3", "pink lady cider #3"),
  post("2020-01-01-pink-lady-cider-10", "pink lady cider #10"),
  post("2021-05-01-chenin-blanc-3-2020", "chenin blanc #3 (2020)"),
];

test("parseTags reads quoted tags, including escaped quotes and commas", () => {
  const fm = `+++\ntitle = "x"\n\n[taxonomies]\ntags = ["apple", "a \\"b\\", c", "pink lady cider #1"]\n+++`;
  expect(parseTags(fm)).toEqual(["apple", "a \"b\", c", "pink lady cider #1"]);
});

test("parseTags reads an array that dprint wrapped over several lines", () => {
  const fm =
    `+++\ntags = ["lavender", "strawberry lavender melomel #1", "melomel",\n  "Lalvin 71B-1122", "recipe"]\npost_types = ["start"]\n+++`;
  expect(parseTags(fm)).toEqual([
    "lavender",
    "strawberry lavender melomel #1",
    "melomel",
    "Lalvin 71B-1122",
    "recipe",
  ]);
});

test("parseTags returns nothing when there is no tags line", () => {
  expect(parseTags("+++\ntitle = \"x\"\n+++")).toEqual([]);
});

test("a stem that already has posts collides, and the stem is matched on whole words", () => {
  const result = findCollisions(existing, "pink-lady-cider-1", null);
  expect(result.posts).toEqual([
    "2014-03-15-pink-lady-cider-1",
    "2014-03-16-pink-lady-cider-1-update-1",
  ]);
});

test("a batch tag that already exists collides even when the case differs", () => {
  const result = findCollisions([post("2015-01-01-other-name", "Pink Lady Cider #2")], "x", "pink lady cider #2");
  expect(result.posts).toEqual(["2015-01-01-other-name"]);
});

test("a free stem and batch tag collide with nothing", () => {
  expect(findCollisions(existing, "pink-lady-cider-4", "pink lady cider #4")).toEqual({
    posts: [],
    nextNumber: null,
  });
});

test("nextNumber is one more than the highest number sharing the base", () => {
  expect(nextNumber(existing, "pink lady cider #1")).toBe(11);
});

test("nextNumber ignores trailing text after the number and other bases", () => {
  expect(nextNumber(existing, "chenin blanc #3")).toBe(4);
});

test("nextNumber is null when the batch tag has no number", () => {
  expect(nextNumber(existing, "pink lady cider")).toBeNull();
});

test("a collision reports the suggested number", () => {
  expect(findCollisions(existing, "pink-lady-cider-1", "pink lady cider #1").nextNumber).toBe(11);
});
