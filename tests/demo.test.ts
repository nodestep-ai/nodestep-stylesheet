import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { type FakeDocument, type FakeElement, FakeEvent, parse } from "./dom.ts";
import {
  ALL_ROLES,
  DEMO,
  demoSection,
  demoStyles,
  elements,
  markupBlocks,
  markupClasses,
  MERMAID_OUTPUT,
  NODE_STATES,
  read,
  selectorClasses,
  STYLESHEET,
  stylesheetRules,
  THEME_BUTTON,
  unescapeHtml,
  withoutWhitespaceBetweenTags,
} from "./support.ts";

const MENU_BUTTON =
  '<button class="demo-menu" type="button" aria-label="Sections" aria-expanded="false" aria-controls="sections">' +
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"></path></svg>' +
  "</button>";

const SITE_LINKS =
  '<nav class="demo-site-links" aria-label="Site"><ul class="nodestep-nav">' +
  '<li><a href="https://nodestep-ai.github.io/nodestep/">nodestep</a></li>' +
  '<li><a href="https://nodestep-ai.github.io/nodestep/nodeartifact/">nodeartifact</a></li>' +
  '<li><a href="./" aria-current="page">stylesheet</a></li>' +
  "</ul></nav>";

const SEARCH_ICON =
  '<label class="nodestep-search-icon" for="FIELD"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.52 6.52 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5"></path>' +
  "</svg></label>";

const SEARCH_CLEAR =
  '<button class="nodestep-search-clear" type="reset" aria-label="Clear the search"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>' +
  "</svg></button>";

function shapes(svg: string): string[] {
  return [
    ...svg.matchAll(
      /<(path|circle)\b[^>]*?(?:\bd="([^"]+)"|\bcx="([^"]+)" cy="([^"]+)" r="([^"]+)")/g,
    ),
  ].map((match) => match.slice(1).join("|"));
}

function demoTopBar(): string {
  const topbar = /<header class="nodestep-topbar">([\s\S]*?)<\/header>/.exec(
    DEMO,
  );
  assert.ok(topbar);
  return topbar[1];
}

function demoScripts(): [string[], string[]] {
  const [head, body] = DEMO.split("</head>");
  const inline = (part: string): string[] =>
    [...part.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
      (match) => match[1],
    );
  return [inline(head), inline(body)];
}

function sidebar(): string {
  const found =
    /<nav class="demo-sidebar" id="sections" aria-label="Sections on this page">([\s\S]*?)<\/nav>/.exec(
      DEMO,
    );
  assert.ok(found);
  return found[1];
}

function sectionLinks(): [string, boolean][] {
  return [
    ...sidebar().matchAll(/<a href="#([\w-]+)"( aria-current="true")?>/g),
  ].map((match) => [match[1], match[2] !== undefined]);
}

function demoMedia(query: string): string {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(
    `@media ${escaped} \\{([\\s\\S]*?)\\n      \\}`,
  ).exec(demoStyles(DEMO));
  assert.ok(block, query);
  return block[1];
}

interface DemoPage {
  document: FakeDocument;
  context: { scrollY: number; innerHeight: number; location: { hash: string } };
  sections: FakeElement[];
  links: FakeElement[];
  menu: FakeElement;
  sidebar: FakeElement;
  click: (element: FakeElement) => void;
  fire: (type: string, event?: unknown) => void;
  current: () => string[];
}

const PAGE_HEIGHT = 100000;
const SECTION_GAP = 1000;
const SCROLL_MARGIN = 72;

function loadDemo(): DemoPage {
  const document = parse(DEMO);
  document.documentElement.scrollHeight = PAGE_HEIGHT;
  const links = document.querySelectorAll(".demo-sidebar-list a");
  const sections = links.map((link) => {
    const section = document.querySelector(link.hash);
    assert.ok(section, link.hash);
    return section;
  });
  sections.forEach((section, index) =>
    document.boxes.set(section, { top: 100 + index * SECTION_GAP, height: 900 }),
  );
  const windowListeners: [string, (event: unknown) => void][] = [];
  const context = {
    document,
    location: { hash: "" },
    scrollY: 0,
    innerHeight: 800,
    getComputedStyle: () => ({ scrollMarginTop: `${SCROLL_MARGIN}px` }),
    addEventListener: (type: string, listener: (event: unknown) => void) =>
      windowListeners.push([type, listener]),
    setTimeout: () => 0,
    navigator: {},
  };
  runInNewContext(demoScripts()[1].join("\n"), context);
  const menu = document.querySelector(".demo-menu");
  const sidebar = document.querySelector("#sections");
  assert.ok(menu && sidebar);
  return {
    document,
    context,
    sections,
    links,
    menu,
    sidebar,
    click: (element) => {
      document.dispatch(new FakeEvent("click", element));
    },
    fire: (type, event = {}) => {
      for (const [name, listener] of windowListeners)
        if (name === type) listener(event);
    },
    current: () =>
      links
        .filter((link) => link.getAttribute("aria-current") === "true")
        .map((link) => link.hash),
  };
}

function scrollTo(page: DemoPage, index: number): void {
  page.sections.forEach((section, position) =>
    page.document.boxes.set(section, {
      top: (position - index) * SECTION_GAP + 50,
      height: 900,
    }),
  );
  page.context.scrollY = index * SECTION_GAP;
  page.fire("scroll");
}

function olderChoiceMoved({
  stored,
  location = "http://127.0.0.1/nodestep/design/",
  blocked = false,
}: {
  stored: Record<string, string>;
  location?: string;
  blocked?: boolean;
}): Record<string, string> {
  const items = new Map(Object.entries(stored));
  const context: Record<string, unknown> = { URL, location };
  Object.defineProperty(context, "localStorage", {
    get: () => {
      if (blocked) throw new Error("SecurityError");
      return {
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => items.set(key, String(value)),
      };
    },
  });
  const [early] = demoScripts();
  assert.equal(early.length, 1);
  runInNewContext(early[0], context);
  return Object.fromEntries(items);
}

function materialPalette(scheme: string): string {
  return JSON.stringify({ index: scheme === "slate" ? 1 : 0, color: { scheme } });
}

function shellSection(): string {
  const shell =
    /<section class="nodestep-section" id="shell"[\s\S]*?<\/section>/.exec(
      DEMO,
    );
  assert.ok(shell);
  return shell[0];
}

function brandSection(): string {
  return shellSection().split("<h3>Brand mark</h3>")[1];
}

test("every class in the stylesheet is shown in the demo", () => {
  const shown = markupClasses(DEMO);
  const missing = [...selectorClasses(STYLESHEET)]
    .filter((name) => !shown.has(name))
    .sort();
  assert.deepEqual(
    missing,
    [],
    "classes in nodestep.css that demo.html never uses",
  );
});

test("the demo shows every node state", () => {
  const shown = new Set(
    [...DEMO.matchAll(/<g class="node default ([\w -]+)"/g)].flatMap((match) =>
      match[1].split(/\s+/),
    ),
  );
  assert.deepEqual(
    NODE_STATES.filter((state) => !shown.has(state)),
    [],
  );
});

test("the demo shows a swatch for every color role", () => {
  const shown = new Set(
    [
      ...DEMO.matchAll(
        /class="demo-swatch"><span style="background: var\(--nodestep-color-([\w-]+)\)"/g,
      ),
    ].map((match) => match[1]),
  );
  assert.deepEqual([...shown].sort(), [...ALL_ROLES].sort());
});

test("the demo draws edge labels as Mermaid does", () => {
  const label =
    /<div xmlns="http:\/\/www\.w3\.org\/1999\/xhtml" class="labelBkg"[^>]*><span class="edgeLabel"><p>\w+<\/p><\/span><\/div>/g;
  assert.ok(MERMAID_OUTPUT.match(label));
  assert.equal(DEMO.match(label)?.length, 2);
});

test("the page is titled with the repository name", () => {
  assert.ok(DEMO.includes("<title>nodestep-stylesheet</title>"));
  assert.ok(!DEMO.includes("nodestep-design components"));
});

test("the demo has the nodestep favicon", () => {
  assert.ok(
    DEMO.includes(
      '<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">',
    ),
  );
  assert.ok(read("assets/favicon.svg").includes('d="M14 50V14L50 50V14"'));
});

test("the demo top bar starts with the docs brand, which links to the docs home", () => {
  const brand =
    /<a class="nodestep-brand" href="https:\/\/nodestep-ai\.github\.io\/nodestep\/">(<svg class="nodestep-brand-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">[\s\S]*?<\/svg>)docs<\/a>/.exec(
      demoTopBar(),
    );
  assert.ok(brand);
  assert.deepEqual(
    shapes(brand[1]),
    shapes(read("assets/nodestep-design.svg")),
  );
});

test("brand marks take the ink from the text and the accent from a class", () => {
  const marks = [
    ...DEMO.matchAll(
      /<svg class="nodestep-brand-mark"[^>]*>([\s\S]*?)<\/svg>/g,
    ),
  ].map((match) => match[1]);
  assert.ok(marks.length > 0);
  for (const mark of marks) {
    assert.deepEqual(
      [
        ...new Set(
          [...mark.matchAll(/\b(?:fill|stroke)="([^"]+)"/g)].map(
            (match) => match[1],
          ),
        ),
      ],
      ["currentColor"],
    );
    assert.equal(mark.split('class="nodestep-mark-accent-fill"').length - 1, 1);
  }
});

test("answered cards show a proposal and free text in one pattern", () => {
  const cards = [
    ...DEMO.matchAll(
      /<section class="nodestep-card nodestep-card-answered"[^>]*>([\s\S]*?)<\/section>/g,
    ),
  ].map((match) => match[1]);
  assert.equal(cards.length, 2);
  for (const card of cards) {
    assert.ok(!card.includes("nodestep-choice"));
    assert.match(
      card,
      /<div class="nodestep-answer">\s*<p class="nodestep-answer-label">Your answer<\/p>\s*<p class="nodestep-answer-text">[^<]+<\/p>/,
    );
  }
  assert.ok(cards[0].includes('<p class="nodestep-answer-detail">'));
  assert.ok(!cards[1].includes('<p class="nodestep-answer-detail">'));
});

test("the demo top bar holds the docs header: menu, brand, links, search, repository and theme button", () => {
  const topbar = withoutWhitespaceBetweenTags(demoTopBar());
  assert.ok(topbar.startsWith(MENU_BUTTON));
  const brand = topbar.slice(MENU_BUTTON.length);
  assert.ok(brand.startsWith('<a class="nodestep-brand" href="https://nodestep-ai.github.io/nodestep/">'));
  const afterBrand = brand.slice(brand.indexOf("</a>") + "</a>".length);
  assert.ok(afterBrand.startsWith(SITE_LINKS));
  const end = afterBrand.slice(SITE_LINKS.length);
  assert.ok(end.startsWith('<div class="nodestep-topbar-end"><form class="nodestep-search" '));
  const repository = end.indexOf('</form><a class="demo-repository" ');
  assert.ok(repository > 0);
  assert.ok(end.endsWith(`</a>${THEME_BUTTON}</div>`));
});

test("the demo search is the shared search field and sends the query to the docs search", () => {
  const form =
    /<form class="nodestep-search" action="([^"]+)" role="search">([\s\S]*?)<\/form>/.exec(
      demoTopBar(),
    );
  assert.ok(form);
  assert.equal(form[1], "https://nodestep-ai.github.io/nodestep/");
  assert.equal(
    withoutWhitespaceBetweenTags(form[2]),
    `${SEARCH_ICON.replace("FIELD", "docs-search")}` +
      '<input class="nodestep-search-input" id="docs-search" type="search" name="q" placeholder="Search" aria-label="Search the docs" autocomplete="off">' +
      SEARCH_CLEAR,
  );
});

test("the demo has no search styles of its own", () => {
  assert.doesNotMatch(demoStyles(DEMO), /search/);
  assert.doesNotMatch(DEMO, /demo-search/);
});

test("an example top bar holds what opens inside it, so the search example opens over its own bar", () => {
  const rules = stylesheetRules(demoStyles(DEMO).split("@media")[0]);
  assert.equal(rules[".demo-bar"].contain, "paint");
});

test("the search field is shown in its own section with its markup", () => {
  const links = sectionLinks().map(([target]) => target);
  assert.equal(links[links.indexOf("theme") + 1], "search");
  const section = demoSection("search");
  assert.match(section, /<h2 id="search-title">Search<\/h2>/);
  const example = withoutWhitespaceBetweenTags(section);
  assert.ok(
    example.includes(
      '<div class="nodestep-topbar demo-bar"><div class="nodestep-topbar-end"><form class="nodestep-search" action="../" role="search">' +
        SEARCH_ICON.replace("FIELD", "search-example") +
        '<input class="nodestep-search-input" id="search-example" type="search" name="q" placeholder="Search" aria-label="Search the example" autocomplete="off">' +
        SEARCH_CLEAR +
        "</form>",
    ),
  );
  const [markup] = markupBlocks(section);
  assert.equal(
    markup,
    [
      '<form class="nodestep-search" action="/" role="search">',
      `  ${SEARCH_ICON.replace("FIELD", "search")}`,
      '  <input class="nodestep-search-input" id="search" type="search" name="q" placeholder="Search traces" aria-label="Search traces" autocomplete="off">',
      `  ${SEARCH_CLEAR}`,
      "</form>",
    ].join("\n"),
  );
  for (const text of [
    "<code>nodestep-topbar-end</code>",
    "60rem",
    '<code>type="reset"</code>',
    "<code>for</code>",
    "a link to the page without the query",
    "<code>nodestep-theme.js</code> keeps the focus in the field",
  ]) {
    assert.ok(section.includes(text), text);
  }
});

test("the demo top bar links its own repository", () => {
  const link =
    /<a class="demo-repository" href="([^"]+)">(<svg[\s\S]*?<\/svg>)([^<]+)<\/a>/.exec(
      demoTopBar(),
    );
  assert.ok(link);
  assert.equal(link[1], "https://github.com/nodestep-ai/nodestep-stylesheet");
  assert.equal(link[3], "nodestep-ai/nodestep-stylesheet");
  assert.match(
    link[2],
    /^<svg viewBox="0 0 448 512" aria-hidden="true" focusable="false">[\s\S]*<path d="M439\.6 236\.1 [^"]+"><\/path><\/svg>$/,
  );
});

test("the demo loads nodestep-theme.js in its head, before nodestep.css and without defer", () => {
  const [head] = DEMO.split("</head>");
  const script = head.indexOf('<script src="nodestep-theme.js"></script>');
  assert.ok(script >= 0);
  assert.ok(
    script < head.indexOf('<link rel="stylesheet" href="nodestep.css">'),
  );
  assert.doesNotMatch(head, /<script[^>]*\b(?:defer|async)\b/);
});

test("the demo leaves the theme to nodestep-theme.js", () => {
  const [early, late] = demoScripts();
  assert.equal(early.length, 1);
  assert.ok(!early[0].includes("dataset"));
  assert.ok(!early[0].includes("prefers-color-scheme"));
  for (const script of late) {
    assert.ok(!script.includes("nodestep-theme"));
    assert.ok(!script.includes("localStorage"));
    assert.ok(!script.includes("prefers-color-scheme"));
  }
});

test("the demo head moves a theme chosen in the docs before this change over, before nodestep-theme.js runs", () => {
  const [head] = DEMO.split("</head>");
  assert.ok(head.indexOf("<script>") < head.indexOf('<script src="nodestep-theme.js">'));
  for (const [scheme, theme] of [
    ["slate", "dark"],
    ["default", "light"],
  ]) {
    assert.deepEqual(
      olderChoiceMoved({ stored: { "/nodestep/.__palette": materialPalette(scheme) } }),
      { "/nodestep/.__palette": materialPalette(scheme), "nodestep-theme": theme },
    );
  }
  assert.equal(
    olderChoiceMoved({
      stored: { "/docs/.__palette": materialPalette("slate") },
      location: "http://127.0.0.1/docs/design/",
    })["nodestep-theme"],
    "dark",
  );
});

test("the demo head keeps a shared choice and ignores what it cannot read", () => {
  const older = { "/nodestep/.__palette": materialPalette("slate") };
  assert.equal(
    olderChoiceMoved({ stored: { ...older, "nodestep-theme": "light" } })["nodestep-theme"],
    "light",
  );
  assert.equal(
    olderChoiceMoved({ stored: { ...older, "nodestep-theme": "sepia" } })["nodestep-theme"],
    "dark",
  );
  for (const value of ["{", "null", materialPalette("constructor"), materialPalette("sepia")]) {
    assert.equal(
      olderChoiceMoved({ stored: { "/nodestep/.__palette": value } })["nodestep-theme"],
      undefined,
      value,
    );
  }
  assert.deepEqual(olderChoiceMoved({ stored: older, blocked: true }), older);
});

test("the sections list links every section in page order", () => {
  const links = sectionLinks().map(([target]) => target);
  const sections = [
    ...DEMO.matchAll(/<section class="nodestep-section" id="([\w-]+)"/g),
  ].map((match) => match[1]);
  assert.deepEqual(links, sections);
});

test("the sections list starts with the first section marked", () => {
  assert.deepEqual(
    sectionLinks()
      .filter(([, current]) => current)
      .map(([target]) => target),
    ["start"],
  );
});

test("the sections list is plain links on a guide line, as the docs navigation", () => {
  const list = withoutWhitespaceBetweenTags(sidebar());
  assert.ok(
    list.startsWith(
      '<p class="demo-sidebar-group">Get started</p><ul class="demo-sidebar-list"><li>',
    ),
  );
  assert.deepEqual(
    [...list.matchAll(/<p class="demo-sidebar-group">([^<]+)<\/p>/g)].map((match) => match[1]),
    ["Get started", "Layout", "Components", "Agent views", "Feedback"],
  );
  assert.ok(SITE_LINKS.includes('<a href="./" aria-current="page">stylesheet</a>'));
  assert.ok(list.endsWith("</li></ul>"));
  const items = [...list.matchAll(/<li>(.*?)<\/li>/g)].map((match) => match[1]);
  assert.equal(items.length, sectionLinks().length);
  for (const item of items)
    assert.match(item, /^<a href="#[\w-]+"( aria-current="true")?>[^<]+<\/a>$/);
});

test("the sections list marks the section at the top of the screen as the page scrolls", () => {
  const page = loadDemo();
  assert.deepEqual(page.current(), ["#start"]);
  scrollTo(page, 9);
  assert.deepEqual(page.current(), ["#tables"]);
  scrollTo(page, 0);
  assert.deepEqual(page.current(), ["#start"]);
});

test("at the end of the page the sections list marks the section the address points to, else the last one", () => {
  const page = loadDemo();
  scrollTo(page, page.sections.length - 3);
  page.context.scrollY = PAGE_HEIGHT - page.context.innerHeight;
  page.context.location.hash = "#graph";
  page.fire("hashchange");
  assert.deepEqual(page.current(), ["#graph"]);
  page.context.location.hash = "";
  page.fire("scroll");
  assert.deepEqual(page.current(), ["#messages"]);
});

test("the brand mark is shown once with its markup", () => {
  const section = brandSection();
  assert.equal(section.split('<svg class="nodestep-brand-mark"').length - 1, 1);
  const lines = [
    ...section.matchAll(/<span class="nodestep-code-line"[^>]*>(.*?)<\/span>/g),
  ].map((match) => unescapeHtml(match[1]));
  const markup = lines.join("\n");
  assert.ok(markup.startsWith('<a class="nodestep-brand" href="/">'));
  assert.ok(markup.includes('<svg class="nodestep-brand-mark"'));
  assert.ok(markup.includes('stroke="currentColor"'));
  assert.ok(markup.includes('<circle class="nodestep-mark-accent-fill"'));
});

test("page links are shown in a top bar of their own", () => {
  const links = shellSection().split("<h3>Page links</h3>")[1].split("<h3>")[0];
  assert.ok(links.includes('<ul class="nodestep-nav">'));
  assert.equal(
    [...links.matchAll(/<a href="#[\w-]+" aria-current="page">/g)].length,
    1,
  );
  assert.ok(!links.includes("nodestep-brand"));
});

test("on narrow screens the demo top bar keeps one row and drops the site links, as the docs header does", () => {
  const narrow = /@media \(max-width: 40rem\) \{\s*\.demo-site-links \{\s*display: none;\s*\}\s*\}/;
  assert.match(demoStyles(DEMO), narrow);
});

test("the demo says which projects use the stylesheet", () => {
  const lead = /<p class="nodestep-lead">([\s\S]*?)<\/p>/.exec(DEMO);
  assert.ok(lead);
  for (const user of [
    "nodestep",
    "sandbox",
    "nodeartifact",
    "text-to-sql-demo",
    "future",
  ]) {
    assert.ok(lead[1].includes(user), `${user}: ${lead[1]}`);
  }
});

test("the Start section comes first with the files, the head tags and the version property", () => {
  const start = demoSection("start");
  assert.ok(DEMO.indexOf('id="start"') < DEMO.indexOf('id="tokens"'));
  for (const file of ["nodestep.css", "nodestep-theme.js", "nodestep-data.js"]) {
    assert.ok(
      start.includes(`<a href="${file}" download><code>${file}</code></a>`),
      file,
    );
  }
  assert.ok(start.includes("https://github.com/nodestep-ai/nodestep-stylesheet/releases"));
  const [head] = markupBlocks(start);
  assert.equal(
    head,
    [
      "<head>",
      '  <meta name="color-scheme" content="light dark">',
      '  <script src="nodestep-theme.js"></script>',
      '  <script src="nodestep-data.js"></script>',
      '  <link rel="stylesheet" href="nodestep.css">',
      '  <link rel="stylesheet" href="app.css">',
      "</head>",
    ].join("\n"),
  );
  assert.ok(start.includes('<details class="nodestep-details demo-markup" open>'));
  assert.ok(start.includes("<code>--nodestep-design-version</code>"));
  assert.ok(start.includes("<code>grep nodestep-design-version nodestep.css</code>"));
});

function demoSections(): [string, string][] {
  return [
    ...DEMO.matchAll(
      /<section class="nodestep-section" id="([\w-]+)"[\s\S]*?(?=<section class="nodestep-section"|<\/main>)/g,
    ),
  ].map((match) => [match[1], match[0]]);
}

test("every section after the tokens has a Markup block to copy", () => {
  const missing = demoSections()
    .filter(([id]) => id !== "tokens")
    .filter(([, section]) => markupBlocks(section).length === 0)
    .map(([id]) => id);
  assert.deepEqual(missing, []);
});

test("the Markup blocks use only classes that nodestep.css has", () => {
  const known = selectorClasses(STYLESHEET);
  const unknown = markupBlocks(DEMO)
    .flatMap((block) => [...markupClasses(block)])
    .filter((name) => name.startsWith("nodestep-") && !known.has(name));
  assert.deepEqual([...new Set(unknown)], []);
});

test("every nodestep- class of nodestep.css has markup to copy in the demo", () => {
  const shown = new Set(
    markupBlocks(DEMO).flatMap((block) => [...markupClasses(block)]),
  );
  const missing = [...selectorClasses(STYLESHEET)].filter(
    (name) => name.startsWith("nodestep-") && !shown.has(name),
  );
  assert.deepEqual(missing.sort(), []);
});

test("the Markup blocks are whole elements", () => {
  for (const block of markupBlocks(DEMO)) {
    const closing = [...block.matchAll(/<\/([a-z][\w-]*)>/g)].map(
      (match) => match[1],
    );
    for (const element of elements(block)) {
      if (["input", "br", "hr", "img", "link", "meta"].includes(element.tag))
        continue;
      if (element.attributes.trim().endsWith("/")) continue;
      assert.ok(
        closing.includes(element.tag),
        `${element.tag} is not closed in:\n${block}`,
      );
    }
  }
});

test("only the page's own top bar can stick: example top bars stay in flow", () => {
  const topbars = elements(DEMO).filter((element) =>
    element.classes.includes("nodestep-topbar"),
  );
  const own = topbars.filter((element) => element.tag === "header");
  assert.equal(own.length, 1);
  assert.equal(own[0].parent?.tag, "body");
  for (const example of topbars.filter((element) => element.tag !== "header")) {
    const parent = example.parent;
    assert.ok(parent !== null && parent.tag !== "body");
    if (parent.classes.includes("nodestep-app"))
      assert.ok(parent.classes.includes("nodestep-app-fixed"));
  }
});

test("the demo page is laid out as a docs page: top bar, then the sections list and the main column", () => {
  const all = elements(DEMO);
  const top = all.filter((element) => element.parent?.tag === "body");
  assert.deepEqual(
    top.map((element) => `${element.tag}.${element.classes.join(".")}`),
    [
      "a.nodestep-skip-link",
      "header.nodestep-topbar",
      "div.demo-layout",
      "div.nodestep-toast-region",
      "script.",
    ],
  );
  const layout = top[2];
  const children = all.filter((element) => element.parent === layout);
  assert.deepEqual(
    children.map((element) => `${element.tag}.${element.classes.join(".")}`),
    ["nav.demo-sidebar", "main.nodestep-main.demo-main"],
  );
});

test("the demo page has the docs background and colors", () => {
  const rules = stylesheetRules(demoStyles(DEMO));
  for (const selector of ["html", "body"])
    assert.equal(rules[selector].background, "var(--nodestep-color-surface)");
});

test("the demo page uses the docs grid: a wide sidebar column, the content and an empty column", () => {
  const rules = stylesheetRules(demoStyles(DEMO).split("@media")[0]);
  assert.deepEqual(rules[".demo-layout"], {
    display: "grid",
    "grid-template-columns": "15.125rem minmax(0, 1fr) 15.125rem",
    "max-width": "76.25rem",
    "margin-inline": "auto",
  });
  assert.equal(rules[".demo-main"]["padding-inline"], "var(--nodestep-space-5)");
  assert.equal(rules[".demo-main"]["max-width"], "none");
  assert.deepEqual(rules["body > .nodestep-topbar"], {
    "flex-wrap": "nowrap",
    "column-gap": "var(--nodestep-space-5)",
    "padding-block": "0",
  });
});

test("the sections list sticks below the top bar and looks like the docs navigation", () => {
  const rules = stylesheetRules(demoStyles(DEMO).split("@media")[0]);
  const sidebar = rules[".demo-sidebar"];
  assert.equal(sidebar.position, "sticky");
  assert.equal(sidebar.top, "var(--nodestep-bar-height)");
  assert.equal(sidebar["max-height"], "calc(100dvh - var(--nodestep-bar-height))");
  assert.equal(sidebar["overflow-y"], "auto");
  assert.equal(sidebar.padding, "var(--nodestep-space-5) var(--nodestep-space-4)");
  assert.equal(rules[".demo-sidebar-label"], undefined);
  assert.equal(rules[".demo-sidebar-list"]["border-inline-start"], "var(--nodestep-border)");
  const link = rules[".demo-sidebar-list a"];
  assert.equal(link.padding, "0.3125rem 0 0.3125rem 0.75rem");
  assert.equal(link["font-size"], "var(--nodestep-text-sm)");
  assert.equal(link["line-height"], "1.3");
  assert.equal(link.color, "var(--nodestep-color-text)");
  assert.equal(link["margin-inline-start"], "calc(-1 * var(--nodestep-border-width))");
  assert.deepEqual(rules['.demo-sidebar-list a[aria-current="true"]'], {
    color: "var(--nodestep-color-accent-text)",
    "box-shadow": "inset 3px 0 0 var(--nodestep-color-accent)",
  });
});

test("below the docs' wide layout the sections list folds behind the menu button, as the docs navigation does", () => {
  const folded = stylesheetRules(demoMedia("(width < 76.25rem)"));
  assert.equal(folded[".demo-layout"]["grid-template-columns"], "minmax(0, 1fr) 15.125rem");
  assert.equal(folded[".demo-menu"].display, "block");
  assert.equal(folded["body > .nodestep-topbar .nodestep-brand-mark"].display, "none");
  assert.equal(folded[".demo-sidebar"].display, "none");
  assert.equal(folded[".demo-sidebar"].position, "fixed");
  assert.equal(folded[".demo-sidebar"].inset, "var(--nodestep-bar-height) auto 0 0");
  assert.equal(folded[".demo-sidebar"]["align-self"], "stretch");
  assert.equal(folded[".demo-sidebar[data-open]"].display, "block");
  assert.equal(folded[".demo-main"]["padding-inline"], "var(--nodestep-space-4)");
  const narrow = stylesheetRules(demoMedia("(width < 60rem)"));
  assert.equal(narrow[".demo-layout"]["grid-template-columns"], "minmax(0, 1fr)");
  assert.equal(narrow[".demo-repository"].display, "none");
});

test("the menu button opens and closes the sections list", () => {
  const page = loadDemo();
  assert.equal(page.menu.getAttribute("aria-expanded"), "false");
  page.click(page.menu);
  assert.ok(page.sidebar.hasAttribute("data-open"));
  assert.equal(page.menu.getAttribute("aria-expanded"), "true");
  page.click(page.menu);
  assert.ok(!page.sidebar.hasAttribute("data-open"));
  assert.equal(page.menu.getAttribute("aria-expanded"), "false");
});

test("a section link, Escape or a click beside the open sections list closes it", () => {
  const page = loadDemo();
  page.click(page.menu);
  page.click(page.links[8]);
  assert.ok(!page.sidebar.hasAttribute("data-open"));
  assert.equal(page.menu.getAttribute("aria-expanded"), "false");

  page.click(page.menu);
  page.fire("keydown", { key: "Escape" });
  assert.ok(!page.sidebar.hasAttribute("data-open"));
  assert.ok(page.document.activeElement === page.menu, "Escape moves the focus to the menu button");

  page.click(page.menu);
  const list = page.document.querySelector(".demo-sidebar-list");
  assert.ok(list);
  page.click(list);
  assert.ok(page.sidebar.hasAttribute("data-open"));
  const heading = page.document.querySelector("#content h1");
  assert.ok(heading);
  page.click(heading);
  assert.ok(!page.sidebar.hasAttribute("data-open"));
  assert.equal(page.menu.getAttribute("aria-expanded"), "false");
});

test("Escape leaves the focus alone while the sections list is closed", () => {
  const page = loadDemo();
  page.fire("keydown", { key: "Escape" });
  assert.ok(page.document.activeElement === null, "the focus did not move");
});

test("an empty search stays on the page and moves to the field, a query goes to the docs search", () => {
  const page = loadDemo();
  const form = page.document.querySelector("header .nodestep-search");
  const field = page.document.querySelector("#docs-search");
  assert.ok(form && field);
  for (const value of ["", "  "]) {
    page.document.activeElement = null;
    field.value = value;
    assert.ok(page.document.dispatch(new FakeEvent("submit", form)).defaultPrevented, value);
    assert.ok(page.document.activeElement === field, "the field has the focus");
  }
  page.document.activeElement = null;
  field.value = "reducer";
  assert.ok(!page.document.dispatch(new FakeEvent("submit", form)).defaultPrevented);
  assert.ok(page.document.activeElement === null, "the focus did not move");
});

test("the App shell section says which top bar sticks and how a script opens a folded panel", () => {
  const shell = shellSection();
  assert.ok(shell.includes("<code>body &gt; .nodestep-topbar</code>"));
  assert.ok(shell.includes("<code>.nodestep-app &gt; .nodestep-topbar</code>"));
  assert.match(shell, /stays in flow/);
  for (const text of [
    '<code>data-panel="start"</code>',
    '<code>data-panel="end"</code>',
    "<code>aria-expanded</code>",
    "<code>nodestep-app-fixed</code>",
  ]) {
    assert.ok(shell.includes(text), text);
  }
});

test("the App shell section shows an app with a start panel, a main area and an end panel", () => {
  const shell = shellSection();
  assert.match(shell, /<div class="nodestep-app nodestep-app-fixed demo-app"/);
  for (const name of [
    "nodestep-app-start",
    "nodestep-app-main",
    "nodestep-app-end",
    "nodestep-app-toggle-start",
    "nodestep-app-toggle-end",
    "nodestep-app-close",
  ]) {
    assert.ok(shell.includes(name), name);
  }
});

test("the theme button is shown as a component with its markup", () => {
  const theme = demoSections().find(([id]) => id === "theme");
  assert.ok(theme);
  const blocks = markupBlocks(theme[1]).map(withoutWhitespaceBetweenTags);
  assert.ok(blocks.some((block) => block.includes(THEME_BUTTON)));
  assert.ok(
    blocks.some((block) =>
      block.includes('<script src="nodestep-theme.js"></script>'),
    ),
  );
  assert.ok(
    theme[1].includes(
      '<button class="nodestep-theme-button" type="button" aria-label="Dark theme" aria-pressed="false">',
    ),
  );
});

test("the demo shows markup only, with no Svelte components", () => {
  assert.ok(!DEMO.includes('id="svelte"'));
  assert.doesNotMatch(DEMO, /svelte/i);
});
