import { expect, test } from "bun:test";
import type { Line } from "./html";
import { assignImages, batchTitle, buildPosts, dropEmpty, noteTitle, slugify } from "./posts";

const t = (md: string): Line => ({ kind: "text", md });
const img = (index: number): Line => ({ kind: "image", index });
const ymd = (year: number, month: number, day: number) => ({ year, month, day });
const opts = {
  title: "Just Lemons #1",
  drinkTypes: ["mead"],
  tags: ["lemon"],
  batch: "just lemons #1",
  dated: true,
};

test("slugify and titles", () => {
  expect(slugify("Just Lemons #1")).toBe("just-lemons-1");
  expect(slugify("Lemon Mead ’18")).toBe("lemon-mead-18");
  expect(slugify("Chenin Blanc #3 (2020)")).toBe("chenin-blanc-3-2020");
  expect(batchTitle("just lemons")).toBe("Just Lemons #1");
  expect(batchTitle("Chenin blanc #2")).toBe("Chenin Blanc #2");
  expect(noteTitle("honey citron and ginger tea mead")).toBe("Honey Citron and Ginger Tea Mead");
});

test("an image moves to the entry whose date matches its capture date", () => {
  const entries = [
    { date: ymd(2017, 2, 15), lines: [t("a"), img(0)] },
    { date: ymd(2017, 3, 2), lines: [t("b")] },
  ];
  const { entries: out, warnings } = assignImages(entries, [ymd(2017, 3, 2)]);
  expect(out[0].lines).toEqual([t("a")]);
  expect(out[1].lines).toEqual([t("b"), img(0)]);
  expect(warnings).toEqual([]);
});

test("an image with no capture date stays where it sat, silently", () => {
  const entries = [{ date: ymd(2017, 2, 15), lines: [img(0)] }];
  const { entries: out, warnings } = assignImages(entries, [null]);
  expect(out[0].lines).toEqual([img(0)]);
  expect(warnings).toEqual([]);
});

test("an image taken far from any entry stays put and warns", () => {
  const entries = [{ date: ymd(2017, 2, 15), lines: [img(0)] }];
  const { warnings } = assignImages(entries, [ymd(2017, 6, 1)]);
  expect(warnings).toHaveLength(1);
});

test("an entry with no text and no images is dropped with a warning", () => {
  const entries = [
    { date: ymd(2017, 2, 15), lines: [t("a")] },
    { date: ymd(2017, 2, 16), lines: [] },
  ];
  const { entries: out, warnings } = dropEmpty(entries);
  expect(out).toHaveLength(1);
  expect(warnings).toHaveLength(1);
});

test("start and update posts get titles, slugs, types, and batch tags", () => {
  const entries = [
    { date: ymd(2017, 2, 15), lines: [t("3.5G juice"), t("Juiced.")] },
    { date: ymd(2017, 3, 2), lines: [t("Racked.")] },
  ];
  const posts = buildPosts(entries, [], opts);
  expect(posts.map((p) => p.path)).toEqual([
    "2017-02-15-just-lemons-1.md",
    "2017-03-02-just-lemons-1-update-1.md",
  ]);
  expect(posts[0].content).toBe(
    `+++\ntitle = "Just Lemons #1"\ndate = 2017-02-15\n\n[taxonomies]\ndrink_types = ["mead"]\ntags = ["lemon", "just lemons #1"]\npost_types = ["start"]\n+++\n\n3.5G juice\n\nJuiced.\n`,
  );
  expect(posts[1].content).toContain(`title = "Just Lemons #1: Update 1"`);
  expect(posts[1].content).toContain(`post_types = ["update"]`);
});

test("two entries on one day get a time on the later one", () => {
  const entries = [
    { date: ymd(2017, 2, 15), lines: [t("a")] },
    { date: ymd(2017, 2, 15), lines: [t("b")] },
  ];
  const posts = buildPosts(entries, [], opts);
  expect(posts[0].content).toContain("date = 2017-02-15\n");
  expect(posts[1].content).toContain("date = 2017-02-15T13:00:00\n");
});

test("a post with images is a directory and its images are numbered", () => {
  const jpegs = [new Uint8Array([1]), new Uint8Array([2])];
  const entries = [{ date: ymd(2017, 2, 15), lines: [t("a"), img(1), img(0)] }];
  const [post] = buildPosts(entries, jpegs, opts);
  expect(post.path).toBe("2017-02-15-just-lemons-1/index.md");
  expect(post.images.map((i) => i.name)).toEqual(["photo-1.jpg", "photo-2.jpg"]);
  expect(post.images[0].bytes).toBe(jpegs[1]);
  expect(post.content).toContain("![](photo-1.jpg)\n\n![](photo-2.jpg)");
});

test("an undated note is one note post with no batch tag", () => {
  const entries = [{ date: ymd(2015, 9, 4), lines: [t("a")] }];
  const [post] = buildPosts(entries, [], {
    ...opts,
    title: "Boysenberry Hopped Mead",
    dated: false,
  });
  expect(post.path).toBe("2015-09-04-boysenberry-hopped-mead.md");
  expect(post.content).toContain(`tags = ["lemon"]`);
  expect(post.content).toContain(`post_types = ["note"]`);
});

test("quotes and backslashes in a title are escaped in TOML", () => {
  const entries = [{ date: ymd(2015, 9, 4), lines: [t("a")] }];
  const [post] = buildPosts(entries, [], { ...opts, title: `The "Big" One\\`, dated: false });
  expect(post.content).toContain(`title = "The \\"Big\\" One\\\\"`);
});

test("consecutive bullets stay in one list", () => {
  const entries = [{ date: ymd(2015, 9, 4), lines: [t("- honey"), t("- water"), t("then")] }];
  const [post] = buildPosts(entries, [], { ...opts, dated: false });
  expect(post.content).toContain("- honey\n- water\n\nthen\n");
});

test("an image stays with its own entry when two entries share its capture day", () => {
  const entries = [
    { date: ymd(2017, 2, 15), lines: [t("a")] },
    { date: ymd(2017, 2, 15), lines: [t("b"), { kind: "image" as const, index: 0 }] },
  ];
  const result = assignImages(entries, [ymd(2017, 2, 15)]);
  expect(result.entries[0].lines).toEqual([t("a")]);
  expect(result.entries[1].lines).toHaveLength(2);
});

test("a post with no drink types has an empty drink_types list", () => {
  const entries = [{ date: ymd(2014, 8, 16), lines: [t("a")] }];
  const [post] = buildPosts(entries, [], { ...opts, drinkTypes: [], dated: false });
  expect(post.content).toContain("drink_types = []\n");
});
