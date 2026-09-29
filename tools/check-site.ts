// Checks a built copy of the site for mistakes that `zola check` does not catch.
//
// Usage: bun tools/check-site.ts [BUILD_DIR]
//
// BUILD_DIR defaults to public/. It must be built with the base_url in config.toml. The script
// prints one line per failure and exits with status 1 if any check fails.

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, normalize, posix } from "node:path";
import config from "../config.toml";

type Failure = [path: string, message: string];
type Check = (site: Site) => Iterable<Failure>;
type Element = { tag: string; attrs: Record<string, string> };

const ROOT = join(import.meta.dir, "..");
const CHECKS: Check[] = [];

// Site paths that are linked but not built yet. The nav links to /about, and
// curiousconcoctor-3mn.2 adds the page. A path listed here that resolves is itself a failure,
// so the entry gets removed when its page lands.
const KNOWN_MISSING = new Set(["/about"]);

function check(fn: Check) {
  CHECKS.push(fn);
}

// HTMLRewriter hands over attribute values as written, so entities are still encoded.
function decode(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// The selectors whose text content a Page records, one entry per matching element. Text goes to
// the most recently opened match, so a selector here must not match elements nested in each other.
const TEXT_SELECTORS = ["title", "style", ".post-filed", ".site-mark"];

class Page {
  elements: Element[] = [];
  texts = new Map<string, string[]>(TEXT_SELECTORS.map(sel => [sel, []]));

  constructor(public urlPath: string) {}

  static async parse(urlPath: string, html: string): Promise<Page> {
    const page = new Page(urlPath);
    let rewriter = new HTMLRewriter().on("*", {
      element(el) {
        const attrs: Record<string, string> = {};
        for (const [name, value] of el.attributes) attrs[name] = decode(value);
        page.elements.push({ tag: el.tagName, attrs });
      },
    });
    for (const [sel, list] of page.texts) {
      rewriter = rewriter.on(sel, {
        element() {
          list.push("");
        },
        text(chunk) {
          list[list.length - 1] += chunk.text;
        },
      });
    }
    await rewriter.transform(new Response(html)).text();
    return page;
  }

  // Only the first <title> counts, so an SVG's <title> cannot stand in for the page's.
  get title(): string {
    return this.texts.get("title")![0] ?? "";
  }

  get style(): string {
    return this.texts.get("style")!.join("\n");
  }

  find(tag: string, cls?: string): Record<string, string>[] {
    return this.elements
      .filter(e => e.tag === tag && (!cls || (e.attrs.class ?? "").split(/\s+/).includes(cls)))
      .map(e => e.attrs);
  }

  // Yields every URL the page loads or links to.
  *urls(): Generator<string> {
    for (const { tag, attrs } of this.elements) {
      if (attrs.href) yield attrs.href;
      if (attrs.src) yield attrs.src;
      if (tag === "meta" && ["og:image", "og:url"].includes(attrs.property)) {
        yield attrs.content ?? "";
      }
    }
    // base.html declares the fonts with @font-face rules in a <style> element.
    for (const m of this.style.matchAll(/url\(\s*["']?([^"')]+)/g)) yield m[1];
  }
}

// A page's site path ends in a slash and is its own directory. posix.dirname would drop it.
const dirOf = (path: string) => (path.endsWith("/") ? path : posix.dirname(path));

const isExternal = (url: string) => /^[a-z][a-z0-9+.-]*:/i.test(url) || /^(\/\/|#)/.test(url);

type Post = { file: string; date: string; tags: string[] };

// Reads the front matter of every post in content/blog/.
function blogPosts(): Post[] {
  const files = [...new Bun.Glob("content/blog/**/*.md").scanSync({ cwd: ROOT })].sort();
  return files.filter(f => !f.endsWith("_index.md")).map(file => {
    const front = readFileSync(join(ROOT, file), "utf8").split(/^\+\+\+$/m)[1];
    const meta = Bun.TOML.parse(front) as { date?: unknown; taxonomies?: { tags?: string[] } };
    // Zola reads a bare date as midnight UTC and a time without an offset as UTC.
    const date = String(meta.date ?? "").replace(/Z$/, "");
    return { file, date: date.includes("T") ? date : `${date}T00:00:00`, tags: meta.taxonomies?.tags ?? [] };
  });
}

class Site {
  baseUrl: string = config.base_url.replace(/\/$/, "");
  pages = new Map<string, Page>();

  constructor(public build: string) {}

  async load() {
    const files = await Array.fromAsync(new Bun.Glob("**/*.html").scan({ cwd: this.build }));
    for (const rel of files.sort()) {
      const urlPath = "/" + rel.replace(/index\.html$/, "");
      this.pages.set(rel, await Page.parse(urlPath, await Bun.file(join(this.build, rel)).text()));
    }
  }

  // Returns the site path an internal URL names, such as /tags/, or null if it is external.
  // fromPath is the site path of the document holding the URL, such as /blog/post/.
  sitePath(url: string, fromPath: string): string | null {
    let path: string;
    if (url === this.baseUrl || url.startsWith(this.baseUrl + "/")) {
      path = "/" + url.slice(this.baseUrl.length).replace(/^\/+/, "");
    } else if (isExternal(url)) {
      return null;
    } else {
      path = posix.join(dirOf(fromPath), url);
    }
    path = path.replace(/[?#].*$/, "");
    // A stray "%" makes decodeURIComponent throw, so such a path is checked as written.
    try {
      path = decodeURIComponent(path);
    } catch {}
    return posix.normalize(path).replace(/\/$/, "") + (path.endsWith("/") ? "/" : "");
  }

  // Returns true if a URL points outside the site's subpath on the live host.
  leavesSite(url: string, fromPath: string): boolean {
    if (/^\/(?!\/)/.test(url)) return true;
    if (isExternal(url)) return false;
    // A relative path that climbs above the site root lands outside the subpath.
    // posix.join drops the trailing slash, so "../.." up to the site root yields "/root" exactly.
    const joined = posix.join("/root", dirOf(fromPath), url.replace(/[?#].*$/, ""));
    return joined !== "/root" && !joined.startsWith("/root/");
  }

  // Yields [path, site path, URLs] for every built page and for the web manifest.
  *documents(): Generator<[string, string, string[]]> {
    for (const [rel, page] of this.pages) yield [rel, page.urlPath, [...page.urls()]];
    const manifest = JSON.parse(readFileSync(join(this.build, "site.webmanifest"), "utf8"));
    yield ["site.webmanifest", "/site.webmanifest", manifest.icons.map((i: { src: string }) => i.src)];
  }

  // Returns true if the build has a file that serves a site path.
  serves(path: string): boolean {
    let target = normalize(join(this.build, path));
    if (path.endsWith("/") || (existsSync(target) && statSync(target).isDirectory())) {
      target = join(target, "index.html");
    }
    return existsSync(target) && statSync(target).isFile();
  }
}

check(function* builtForBaseUrl(site) {
  // A build made with another base_url makes every absolute link look external.
  const home = site.pages.get("index.html")!;
  const ogUrl = home.find("meta").find(a => a.property === "og:url")?.content ?? "";
  if (ogUrl !== site.baseUrl && !ogUrl.startsWith(site.baseUrl + "/")) {
    yield ["index.html", `og:url is not under ${site.baseUrl}; build with the base_url in config.toml`];
  }
});

check(function* internalUrlsResolve(site) {
  for (const [rel, fromPath, urls] of site.documents()) {
    for (const url of urls) {
      const path = site.sitePath(url, fromPath);
      if (path === null || KNOWN_MISSING.has(path.replace(/\/$/, ""))) continue;
      if (!site.serves(path)) yield [rel, `${url} does not resolve to a file in the build`];
    }
  }
  for (const path of KNOWN_MISSING) {
    if (site.serves(path)) yield ["tools/check-site.ts", `${path} now exists; remove it from KNOWN_MISSING`];
  }
});

check(function* urlsStayInSite(site) {
  // The site lives under a subpath, so a root-absolute URL, or a relative one that climbs above
  // the site root, leaves it on the live host.
  for (const [rel, fromPath, urls] of site.documents()) {
    for (const url of urls) {
      if (site.leavesSite(url, fromPath)) {
        yield [rel, `${url} leaves the site's subpath; use get_url, an @/ link, or a relative path`];
      }
    }
  }
});

check(function* oneTitleAndMain(site) {
  for (const [rel, page] of site.pages) {
    if (!page.title.trim()) yield [rel, "has no <title> text"];
    const mains = page.find("main").length;
    if (mains !== 1) yield [rel, `has ${mains} <main> elements, expected 1`];
  }
});

check(function* oneH1(site) {
  for (const [rel, page] of site.pages) {
    const h1s = page.find("h1").length;
    if (h1s !== 1) yield [rel, `has ${h1s} <h1> elements, expected 1`];
  }
});

check(function* iconLinked(site) {
  // Under a subpath, a page with no icon link makes browsers request the host root's favicon.ico.
  for (const [rel, page] of site.pages) {
    if (!page.find("link").some(a => (a.rel ?? "").split(/\s+/).includes("icon"))) {
      yield [rel, "has no <link rel=\"icon\">"];
    }
  }
});

check(function* batchDatesDistinct() {
  // Zola orders posts with equal dates by permalink, so two posts in a batch on the same day can
  // read out of order. The later one needs a time on its date.
  const seen = new Map<string, string>();
  for (const post of blogPosts()) {
    for (const tag of post.tags.filter(t => t.includes("#"))) {
      const key = `${tag} ${post.date}`;
      const other = seen.get(key);
      if (other) yield [post.file, `shares the date ${post.date} with ${other} in ${tag}`];
      else seen.set(key, post.file);
    }
  }
});

check(function* noJumpMenus(site) {
  // Every term list is short enough to scan as plain links, so no page needs a <select>.
  for (const [rel, page] of site.pages) {
    if (page.find("select").length) yield [rel, "has a <select>; list the terms as links"];
  }
});

check(function* postsShowFiledUnder(site) {
  for (const [rel, page] of site.pages) {
    if (!/^blog\/[^/]+\/index\.html$/.test(rel)) continue;
    const filed = page.texts.get(".post-filed")!;
    if (filed.length !== 1) yield [rel, `has ${filed.length} "Filed under" lines, expected 1`];
    else if (!filed[0].trim().startsWith("Filed under:")) {
      yield [rel, `"Filed under" line reads "${filed[0].trim().slice(0, 40)}"`];
    }
  }
});

check(function* titleMarkIsText(site) {
  // U+FE0E asks for the text form of the alembic, so it takes the honey color instead of
  // rendering as a color emoji.
  const mark = site.pages.get("index.html")!.texts.get(".site-mark")![0];
  if (mark !== "\u2697\uFE0E") yield ["index.html", "the site mark is not the alembic followed by U+FE0E"];
});

check(function* brewLogNumbering(site) {
  const home = site.pages.get("index.html")!;
  const lists = home.find("ol", "batch-list");
  if (lists.length !== 1) {
    yield ["index.html", `has ${lists.length} batch lists, expected 1`];
    return;
  }
  const batches = home.find("li", "batch").length;
  const start = lists[0].start;
  if (start !== String(batches)) {
    yield ["index.html", `batch list start is ${start}, but it holds ${batches} batches`];
  }
  const reset = (lists[0].style ?? "").match(/counter-reset:\s*batch\s+(\d+)/);
  if (!reset || Number(reset[1]) !== batches + 1) {
    yield ["index.html", `batch counter reset is ${reset?.[1] ?? "missing"}, expected ${batches + 1}`];
  }
});

const build = process.argv[2] ?? join(ROOT, "public");
if (!existsSync(join(build, "index.html"))) {
  console.log(`${build} has no index.html; run zola build first`);
  process.exit(1);
}
const site = new Site(build);
await site.load();
const failures = CHECKS.flatMap(fn => [...fn(site)].map(([rel, msg]) => `${rel}: ${msg}`));
for (const line of failures) console.log(line);
console.log(`${CHECKS.length} checks over ${site.pages.size} pages, ${failures.length} failures`);
process.exit(failures.length ? 1 : 0);
