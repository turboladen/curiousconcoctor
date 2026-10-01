import { expect, test } from "bun:test";
import { convertHtml } from "./html";

const text = (md: string) => ({ kind: "text", md });

test("each div becomes a line, blank divs vanish, and the title heading is dropped", () => {
  const html = `<div><h1>Just lemons</h1></div><div><br></div><div>3.5G juice</div><div><br></div><div>2/15</div>`;
  const { lines } = convertHtml(html, "Just lemons");
  expect(lines).toEqual([text("3.5G juice"), text("2/15")]);
});

test("bold, italic, entities, and emphasis wrapped around a line break", () => {
  const html = `<div><b>Bold</b> and <i>it</i> &amp; Kristina&#8217;s</div><div><b><br></b></div>`;
  const { lines } = convertHtml(html, "x");
  expect(lines).toEqual([text("**Bold** and *it* & Kristina’s")]);
});

test("list items become bullets and other headings are demoted below h1", () => {
  const html = `<div><h2>Recipe</h2></div><ul><li>honey</li><li>water</li></ul>`;
  const { lines } = convertHtml(html, "x");
  expect(lines).toEqual([text("### Recipe"), text("- honey"), text("- water")]);
});

test("inline images are extracted in order and replaced by image lines", () => {
  const b64 = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");
  const html = `<div>before</div><div><img style="x" src="data:image/jpeg;base64,${b64}"></div><div>after</div>`;
  const { lines, images } = convertHtml(html, "x");
  expect(lines).toEqual([text("before"), { kind: "image", index: 0 }, text("after")]);
  expect(images).toHaveLength(1);
  expect(images[0].mime).toBe("image/jpeg");
  expect([...images[0].bytes]).toEqual([0xff, 0xd8, 0xff, 0xd9]);
});

test("tables, checklists, and attachments produce warnings", () => {
  const html = `<table><tr><td>a</td></tr></table><ul class="Checklist"><li>x</li></ul><object data="a.pdf"></object>`;
  const { warnings } = convertHtml(html, "x");
  expect(warnings).toHaveLength(3);
});

test("divider lines made of dashes, em dashes, underscores, or equals signs are dropped", () => {
  const html = `<div>a</div><div>----</div><div>——</div><div>— -</div><div>____</div><div>====</div><div>b</div>`;
  const { lines } = convertHtml(html, "x");
  expect(lines).toEqual([text("a"), text("b")]);
});

test("a divider with a NUL or a Unicode hyphen is dropped", () => {
  const html = `<div>a</div><div>\u2014 \u0000-</div><div>\u2010\u2011\u2012</div><div>b</div>`;
  const { lines } = convertHtml(html, "x");
  expect(lines).toEqual([text("a"), text("b")]);
});

test("a bullet or a line that merely starts with dashes is kept", () => {
  const html = `<ul><li>honey</li></ul><div>--note</div><div>-</div>`;
  const { lines } = convertHtml(html, "x");
  expect(lines).toEqual([text("- honey"), text("--note"), text("-")]);
});

test("whitespace inside emphasis markers moves outside them", () => {
  const html = `<div>It’s <b>really </b>clarified</div><div>a<i> b</i> c</div>`;
  const { lines } = convertHtml(html, "x");
  expect(lines).toEqual([text("It’s **really** clarified"), text("a *b* c")]);
});

test("a bold run that holds only a space keeps the space", () => {
  const html = `<div>still active<b> </b>(yay)</div>`;
  const { lines } = convertHtml(html, "x");
  expect(lines).toEqual([text("still active (yay)")]);
});

test("an ampersand entity with no semicolon still decodes", () => {
  const html = `<div>hot water &amp stirred</div><div>R&ampD stays</div>`;
  const { lines } = convertHtml(html, "x");
  expect(lines).toEqual([text("hot water & stirred"), text("R&ampD stays")]);
});
