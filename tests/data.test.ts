import assert from "node:assert/strict";
import { test } from "node:test";
import { inspect } from "node:util";
import { runInNewContext } from "node:vm";
import { FakeDocument, FakeElement, FakeEvent, parse } from "./dom.ts";
import {
  colorTokens,
  contrastRatio,
  DEMO,
  markupBlocks,
  markupClasses,
  read,
  selectorClasses,
  STYLESHEET,
  stylesheetRules,
  TEXT_CONTRAST,
  TOKEN_KINDS,
} from "./support.ts";

const SCRIPT = read("nodestep-data.js");
const RULES = stylesheetRules(STYLESHEET.replace(/@media[^{]*\{[\s\S]*?\n\}/g, ""));
const TOKENS = colorTokens(STYLESHEET);
const VIEWER =
  /<div class="nodestep-data" role="group" aria-label="[^"]+">[\s\S]*?<pre class="nodestep-data-source">[\s\S]*?<\/pre>\s*<\/div>/;
const AS_ASSERT_PRINTS = {
  compact: false,
  customInspect: false,
  depth: 1000,
  maxArrayLength: Infinity,
  sorted: true,
  getters: true,
} as const;

export const DATA_CLASSES = [
  "nodestep-data",
  "nodestep-data-toolbar",
  "nodestep-data-search",
  "nodestep-data-matches",
  "nodestep-data-tree",
  "nodestep-data-children",
  "nodestep-data-entry",
  "nodestep-data-node",
  "nodestep-data-key",
  "nodestep-data-index",
  "nodestep-data-size",
  "nodestep-data-value",
  "nodestep-data-messages",
  "nodestep-data-message",
  "nodestep-data-message-row",
  "nodestep-data-message-head",
  "nodestep-data-message-body",
  "nodestep-data-preview",
  "nodestep-data-preview-line",
  "nodestep-data-preview-text",
  "nodestep-data-preview-short",
  "nodestep-data-role",
  "nodestep-data-role-human",
  "nodestep-data-role-ai",
  "nodestep-data-role-tool",
  "nodestep-data-role-system",
  "nodestep-data-message-name",
  "nodestep-data-text",
  "nodestep-data-calls",
  "nodestep-data-call",
  "nodestep-data-call-name",
  "nodestep-data-call-arguments",
  "nodestep-data-raw",
  "nodestep-data-source",
];

function rule(selector: string): Record<string, string> {
  const found = RULES[selector];
  assert.ok(found, `nodestep.css has no rule for ${selector}`);
  return found;
}

function role(value: string): string {
  const match = /^var\(--nodestep-color-([\w-]+)\)$/.exec(value);
  assert.ok(match, `${value} is not a color token`);
  return match[1];
}

function assertTextContrast(foreground: string, background: string): void {
  for (const [theme, index] of [
    ["light", 0],
    ["dark", 1],
  ] as [string, number][]) {
    const ratio = contrastRatio(TOKENS[foreground][index], TOKENS[background][index]);
    assert.ok(
      ratio >= TEXT_CONTRAST,
      `${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}`,
    );
  }
}

function demoSection(): string {
  const section =
    /<section class="nodestep-section" id="data-viewer"[\s\S]*?<\/section>/.exec(DEMO);
  assert.ok(section, "demo.html has no data-viewer section");
  return section[0];
}

function example(): string {
  const viewer = VIEWER.exec(demoSection());
  assert.ok(viewer, "the data-viewer section has no viewer");
  return viewer[0];
}

interface Page {
  document: FakeDocument;
  viewers: FakeElement[];
  copied: string[];
  timers: (() => void)[];
  type: (viewer: FakeElement, query: string, focused?: boolean) => void;
  press: (viewer: FakeElement, shift?: boolean) => FakeEvent;
  click: (viewer: FakeElement, action: string) => FakeElement;
  count: (viewer: FakeElement) => string;
  marks: (viewer: FakeElement) => string[];
  current: (viewer: FakeElement) => FakeElement | null;
  settle: () => Promise<void>;
}

function loadPage(
  markup: string,
  clipboard: { writeText(text: string): Promise<void> } | undefined = undefined,
): Page {
  const document = parse(markup);
  const copied: string[] = [];
  const timers: (() => void)[] = [];
  const navigator = {
    clipboard: clipboard ?? {
      writeText: async (text: string) => {
        copied.push(text);
      },
    },
  };
  runInNewContext(SCRIPT, {
    document,
    navigator,
    setTimeout: (callback: () => void) => timers.push(callback),
  });
  const search = (viewer: FakeElement) => {
    const input = viewer.querySelector(".nodestep-data-search");
    assert.ok(input);
    return input;
  };
  const tree = (viewer: FakeElement) => {
    const found = viewer.querySelector(".nodestep-data-tree");
    assert.ok(found);
    return found;
  };
  return {
    document,
    viewers: document.querySelectorAll(".nodestep-data"),
    copied,
    timers,
    type(viewer, query, focused = true) {
      const input = search(viewer);
      document.activeElement = focused ? input : document.querySelector("body");
      input.value = query;
      document.dispatch(new FakeEvent("input", input));
    },
    press(viewer, shift = false) {
      const input = search(viewer);
      document.activeElement = input;
      return document.dispatch(
        new FakeEvent("keydown", input, { key: "Enter", shiftKey: shift }),
      );
    },
    click(viewer, action) {
      const button = viewer.querySelector(`[data-nodestep-data-action="${action}"]`);
      assert.ok(button, action);
      document.dispatch(new FakeEvent("click", button));
      return button;
    },
    count(viewer) {
      return viewer.querySelector(".nodestep-data-matches")?.textContent ?? "";
    },
    marks(viewer) {
      return tree(viewer)
        .querySelectorAll("mark")
        .map((mark) => mark.textContent);
    },
    current(viewer) {
      return tree(viewer).querySelector('mark[aria-current="true"]');
    },
    settle: () => new Promise((resolve) => setImmediate(resolve)),
  };
}

function closedAncestors(element: FakeElement, viewer: FakeElement): FakeElement[] {
  const closed: FakeElement[] = [];
  for (let node = element.parent; node && node !== viewer; node = node.parent) {
    if (node.tagName === "DETAILS" && !node.open) closed.push(node);
  }
  return closed;
}

function leafOf(mark: FakeElement): FakeElement {
  const leaf = mark.parent;
  assert.ok(leaf);
  return leaf;
}

test("a fake document, element, text or event prints in a few lines, as a failing assert prints it", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  page.type(viewer, "caramel");
  const key = viewer.querySelector(".nodestep-data-key");
  assert.ok(key);
  const printed: [string, unknown][] = [
    ["the document", page.document],
    ["the root element", page.document.documentElement],
    ["the viewer", viewer],
    ["a text node", key.childNodes[0]],
    ["an event", new FakeEvent("click", viewer)],
  ];
  for (const [name, value] of printed) {
    const size = inspect(value, AS_ASSERT_PRINTS).length;
    assert.ok(size < 1500, `${name} prints ${size} characters`);
  }
});

test("a failing deepEqual of two fake elements has a short message", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  const tree = viewer.querySelector(".nodestep-data-tree");
  assert.ok(tree);
  assert.throws(
    () => assert.deepEqual(viewer, tree),
    (error: Error) => error.message.length < 3000,
  );
});

test("nodestep.css has the data viewer classes", () => {
  const classes = selectorClasses(STYLESHEET);
  assert.deepEqual(
    DATA_CLASSES.filter((name) => !classes.has(name)),
    [],
  );
});

test("the toolbar shows only once nodestep-data.js has marked the page", () => {
  assert.equal(rule(".nodestep-data-toolbar").display, "none");
  assert.equal(rule(":root[data-nodestep-data] .nodestep-data-toolbar").display, "flex");
  assert.equal(rule(".nodestep-data-toolbar")["flex-wrap"], "wrap");
  assert.equal(rule(".nodestep-data-source").display, "none");
});

test("the tree scrolls in its own box and nested values hang on a guide line", () => {
  const tree = rule(".nodestep-data-tree");
  assert.equal(tree.overflow, "auto");
  assert.match(tree["max-height"], /dvh/);
  assert.equal(tree["font-family"], "var(--nodestep-font-mono)");
  assert.equal(tree["overscroll-behavior"], undefined, "the page scrolls on at the ends of the tree");
  assert.equal(
    rule(".nodestep-data-node > .nodestep-data-children")["border-left"],
    "var(--nodestep-border)",
  );
  assert.equal(rule(".nodestep-data-messages").border, "var(--nodestep-border)");
  assert.equal(
    rule(".nodestep-data-node > .nodestep-data-messages")["margin-left"],
    rule(".nodestep-data-node > .nodestep-data-children")["margin-left"],
    "the left edge of the messages box is the guide line",
  );
  assert.equal(rule(".nodestep-data-children")["list-style"], "none");
});

test("long strings, message text and tool call arguments wrap", () => {
  for (const selector of [
    ".nodestep-data-value",
    ".nodestep-data-text",
    ".nodestep-data-call",
  ]) {
    assert.equal(rule(selector)["white-space"], "pre-wrap", selector);
    assert.equal(rule(selector)["overflow-wrap"], "anywhere", selector);
  }
  assert.equal(rule(".nodestep-data-value")["min-width"], "0");
  assert.equal(rule(".nodestep-data-text")["font-family"], "var(--nodestep-font-sans)");
});

test("a node, a message row and the JSON of a message show their disclosure as a turning chevron, not the browser marker", () => {
  for (const [part, summarySelector] of [
    [".nodestep-data-node", "summary"],
    [".nodestep-data-raw", "summary"],
    [".nodestep-data-message-row", ".nodestep-data-message-head"],
  ]) {
    const summary = rule(`${part} > ${summarySelector}`);
    assert.equal(summary.display, "flex", part);
    assert.equal(summary["list-style"], "none", part);
    assert.equal(
      rule(`${part} > ${summarySelector}::-webkit-details-marker`).display,
      "none",
      part,
    );
    assert.equal(rule(`${part} > ${summarySelector}::before`).transform, "rotate(-45deg)", part);
    assert.equal(
      rule(`${part}[open] > ${summarySelector}::before`).transform,
      "rotate(45deg)",
      part,
    );
  }
});

test("chat messages are tight rows in one box, joined by a line", () => {
  const box = rule(".nodestep-data-messages");
  assert.equal(role(box.background), "page");
  assert.equal(box["border-radius"], "var(--nodestep-radius)");
  assert.equal(box.gap, undefined, "rows touch, a line parts them");
  assert.equal(
    rule(".nodestep-data-message + .nodestep-data-message")["border-top"],
    "var(--nodestep-border)",
  );
  const head = rule(".nodestep-data-message-row > .nodestep-data-message-head");
  assert.equal(head.padding, "var(--nodestep-space-1) var(--nodestep-space-2)");
  assert.equal(head.cursor, "pointer");
  assert.equal(head["align-items"], "baseline");
  assert.equal(
    role(rule(".nodestep-data-message-row > .nodestep-data-message-head:hover").background),
    "sunk",
  );
  assert.equal(rule(".nodestep-data-role").flex, "none");
  assert.equal(
    rule(".nodestep-data-message-row > .nodestep-data-message-head::before")["align-self"],
    "baseline",
    "the chevron stays on the first line of a row with two lines",
  );
});

test("a long tool name gives way to the preview, cut with an ellipsis, and shows in full once the row is open", () => {
  const name = rule(".nodestep-data-message-name");
  assert.equal(name.flex, "0 1 auto");
  assert.equal(name["min-width"], "0");
  assert.equal(name["max-width"], "50%");
  assert.equal(name.overflow, "hidden");
  assert.equal(name["white-space"], "nowrap");
  assert.equal(name["text-overflow"], "ellipsis");
  const open = rule(".nodestep-data-message-row[open] > .nodestep-data-message-head .nodestep-data-message-name");
  assert.equal(open["white-space"], "normal");
  assert.equal(open["max-width"], "none");
  assert.equal(name["overflow-wrap"], "anywhere");
});

test("the tool name stands apart from the preview after it", () => {
  const name = rule(".nodestep-data-message-name");
  assert.equal(name["font-weight"], "var(--nodestep-weight-strong)");
  assert.equal(role(name.color), "text");
  assert.equal(role(rule(".nodestep-data-preview").color), "text-secondary");
});

test("the folded previews do not widen a table cell or a box around the viewer", () => {
  assert.equal(
    rule(".nodestep-data-preview").contain,
    "inline-size",
    "lines that do not wrap would set the smallest width of the cell",
  );
});

test("a folded row shows each preview on one line, cut with an ellipsis", () => {
  const preview = rule(".nodestep-data-preview");
  assert.equal(preview.display, "flex");
  assert.equal(preview["flex-direction"], "column");
  assert.equal(preview["min-width"], "0");
  assert.equal(preview.flex, "1 1 0");
  const line = rule(".nodestep-data-preview-line");
  assert.equal(line.overflow, "hidden");
  assert.equal(line["white-space"], "nowrap");
  assert.equal(line["text-overflow"], "ellipsis");
  assert.equal(rule(".nodestep-data-preview-text")["font-family"], "var(--nodestep-font-sans)");
});

test("a short text shows in full on up to two lines", () => {
  const short = rule(".nodestep-data-preview-short");
  assert.equal(short.display, "-webkit-box");
  assert.equal(short["white-space"], "normal");
  assert.equal(short["-webkit-line-clamp"], "2");
  assert.equal(short["-webkit-box-orient"], "vertical");
  assert.equal(short["overflow-wrap"], "anywhere");
});

test("an open row shows the whole message in place of its preview", () => {
  assert.equal(
    rule(".nodestep-data-message-row[open] > .nodestep-data-message-head .nodestep-data-preview")
      .display,
    "none",
  );
  const body = rule(".nodestep-data-message-body");
  assert.equal(body.display, "flex");
  assert.equal(body["flex-direction"], "column");
  assert.equal(body.gap, "var(--nodestep-space-1)");
});

test("a key with a chevron lines up with the plain keys beside it", () => {
  const entry = rule(".nodestep-data-entry");
  const summary = rule(".nodestep-data-node > summary");
  const chevron = rule(".nodestep-data-node > summary::before");
  assert.equal(entry["padding-left"], "1rem");
  assert.equal(summary.gap, "0 var(--nodestep-space-2)");
  assert.equal(chevron.width, "0.4rem");
  assert.equal(chevron.margin, "0 0.2rem 0 0.15rem");
  assert.equal(summary["margin-left"], "-1.25rem");
});

test("on a phone, short values stay beside their key and the toolbar takes two rows", () => {
  assert.equal(rule(".nodestep-data-value").flex, "1 1 auto");
  assert.equal(rule(".nodestep-data-search").flex, "1 1 10rem");
  assert.equal(rule(".nodestep-data-matches")["min-width"], "5.5rem");
});

test("message text and long strings keep a readable line length", () => {
  assert.equal(rule(".nodestep-data-text")["max-width"], "72ch");
  assert.equal(rule(".nodestep-data-value.nodestep-token-string")["max-width"], "80ch");
});

test("string values read as JSON strings, with quotes the search does not see", () => {
  assert.equal(rule(".nodestep-data-value.nodestep-token-string::before").content, '"\\""');
  assert.equal(rule(".nodestep-data-value.nodestep-token-string::after").content, '"\\""');
});

test("search matches keep the color of their text on the accent wash", () => {
  const match = rule(".nodestep-data-tree mark");
  assert.equal(match.color, "inherit");
  assert.equal(role(match.background), "accent-wash");
  for (const kind of TOKEN_KINDS) {
    assertTextContrast(role(rule(`.nodestep-token-${kind}`).color), "accent-wash");
  }
  assertTextContrast("text", "accent-wash");
});

test("the current match is filled with the accent and ringed, so it differs beyond color", () => {
  const current = rule('.nodestep-data-tree mark[aria-current="true"]');
  assertTextContrast(role(current.color), role(current.background));
  assert.match(current["box-shadow"], /2px var\(--nodestep-color-accent-text\)$/);
  assert.match(rule(".nodestep-data-tree mark")["box-shadow"], /1px/);
});

test("each message role has a label with text contrast on its own background", () => {
  for (const name of ["human", "ai", "tool", "system"]) {
    const found = rule(`.nodestep-data-role-${name}`);
    assertTextContrast(role(found.color), role(found.background));
  }
  for (const [selector, background] of [
    [".nodestep-data-text", "page"],
    [".nodestep-data-matches", "sunk"],
    [".nodestep-data-size", "surface"],
    [".nodestep-data-index", "surface"],
    [".nodestep-data-message-name", "page"],
    [".nodestep-data-call-arguments", "page"],
    [".nodestep-data-preview", "page"],
    [".nodestep-data-preview", "sunk"],
    [".nodestep-data-preview-text", "page"],
    [".nodestep-data-preview-text", "sunk"],
  ]) {
    assertTextContrast(role(rule(selector).color), background);
  }
  assert.equal(role(rule(".nodestep-data").background), "surface");
  assert.equal(role(rule(".nodestep-data-toolbar").background), "sunk");
  assert.equal(role(rule(".nodestep-data-messages").background), "page");
});

test("the demo shows a data viewer with nested data, the four roles, a tool call and a tool result", () => {
  const viewer = example();
  assert.ok(viewer.startsWith('<div class="nodestep-data" role="group" aria-label="the run state">'));
  for (const name of DATA_CLASSES) {
    assert.ok(markupClasses(viewer).has(name), name);
  }
  for (const kind of ["string", "number", "keyword", "comment", "operator"]) {
    assert.ok(viewer.includes(`nodestep-data-value nodestep-token-${kind}`), kind);
  }
  assert.match(viewer, /<details class="nodestep-data-node">/);
  assert.match(viewer, /<details class="nodestep-data-node" open>/);
  assert.match(viewer, /<details class="nodestep-data-raw"><summary>JSON<\/summary>/);
  assert.match(
    viewer,
    /<li class="nodestep-data-message"><details class="nodestep-data-message-row"><summary class="nodestep-data-message-head"><span class="nodestep-data-role nodestep-data-role-/,
  );
  assert.doesNotMatch(viewer, /<details class="nodestep-data-message-row" open>/);
  assert.match(
    viewer,
    /<input class="nodestep-input nodestep-data-search" type="search" placeholder="Search keys and values" aria-label="[^"]+">/,
  );
  assert.match(viewer, /<span class="nodestep-data-matches" aria-live="polite"><\/span>/);
  for (const [action, label] of [
    ["expand", "Expand all"],
    ["collapse", "Collapse all"],
    ["copy", "Copy JSON"],
  ]) {
    assert.ok(
      viewer.includes(
        `<button class="nodestep-button nodestep-button-quiet nodestep-button-small" type="button" data-nodestep-data-action="${action}">${label}</button>`,
      ),
      action,
    );
  }
});

test("the data viewer section has a Markup block with the whole component and the script", () => {
  const blocks = markupBlocks(demoSection());
  assert.ok(blocks.length >= 2);
  const shown = new Set(blocks.flatMap((block) => [...markupClasses(block)]));
  assert.deepEqual(
    DATA_CLASSES.filter((name) => !shown.has(name)),
    [],
  );
  assert.ok(blocks.some((block) => block.includes('<script src="nodestep-data.js"></script>')));
});

test("the demo loads nodestep-data.js in its head", () => {
  const [head] = DEMO.split("</head>");
  assert.ok(head.includes('<script src="nodestep-data.js"></script>'));
  assert.ok(
    head.indexOf('<script src="nodestep-data.js"></script>') <
      head.indexOf('<link rel="stylesheet" href="nodestep.css">'),
  );
});

test("the demo describes the data viewer, its markup and its script", () => {
  const section = demoSection();
  for (const text of [
    "<code>nodestep-data.js</code>",
    "<kbd>Enter</kbd>",
    "<kbd>Shift</kbd>",
    "Expand all",
    "Collapse all",
    "Copy JSON",
    "<code>data-nodestep-data</code>",
    "<code>data-nodestep-data-echo</code>",
    "<code>script-src 'self'</code>",
    "without <code>defer</code>",
  ]) {
    assert.ok(section.includes(text), text);
  }
  const markup = markupBlocks(section).join("\n");
  assert.ok(markup.includes('<script src="nodestep-data.js"></script>'));
  assert.ok(markup.includes('<li class="nodestep-data-entry" data-nodestep-data-echo>'));
  assert.ok(
    markup.includes(
      '<div class="nodestep-data" role="group" aria-label="the run state">',
    ),
  );
  for (const role of ["human", "ai", "tool", "system"]) {
    assert.ok(section.includes(`nodestep-data-role-${role}`), role);
  }
  const known = selectorClasses(STYLESHEET);
  assert.deepEqual(
    [...markupClasses(markup)].filter(
      (name) => name.startsWith("nodestep-") && !known.has(name),
    ),
    [],
  );
});

test("loading the script marks the page so the toolbars show", () => {
  const page = loadPage(example());
  assert.ok(page.document.documentElement.hasAttribute("data-nodestep-data"));
  assert.equal(page.viewers.length, 1);
  assert.equal(page.count(page.viewers[0]), "");
});

test("a search marks the matches in keys and values, counts them and shows the first", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  page.type(viewer, "caramel");
  assert.deepEqual(page.marks(viewer), ["caramel", "caramel", "caramel"]);
  assert.equal(page.count(viewer), "1 of 3");
  const current = page.current(viewer);
  assert.ok(current);
  assert.equal(leafOf(current).textContent, "Salted caramel bar");
  assert.equal(closedAncestors(current, viewer).length, 0, "the match has no closed parent");
  const [scrolled, options] = page.document.scrolled.at(-1) ?? [];
  assert.ok(scrolled === viewer, "the viewer is scrolled into view");
  assert.equal(JSON.stringify(options), '{"block":"nearest"}');
});

test("the current match is centered in the tree, and the viewer is brought into view", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  const tree = viewer.querySelector(".nodestep-data-tree") as FakeElement;
  tree.scrollTop = 40;
  tree.clientHeight = 300;
  page.document.boxes.set(tree, { top: 100, height: 300 });
  const boxes = page.document.boxes;
  const original = page.document.createElement.bind(page.document);
  page.document.createElement = (tag: string) => {
    const element = original(tag);
    if (tag === "mark") boxes.set(element, { top: 700, height: 20 });
    return element;
  };
  page.type(viewer, "Neubau");
  assert.equal(tree.scrollTop, 40 + 700 - 100 - (300 - 20) / 2);
  assert.ok(page.document.scrolled.at(-1)?.[0] === viewer, "the viewer is scrolled into view");
});

test("a search that another script sets centers the match but leaves the page where it is", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  const tree = viewer.querySelector(".nodestep-data-tree") as FakeElement;
  tree.clientHeight = 300;
  page.document.boxes.set(tree, { top: 100, height: 300 });
  const boxes = page.document.boxes;
  const original = page.document.createElement.bind(page.document);
  page.document.createElement = (tag: string) => {
    const element = original(tag);
    if (tag === "mark") boxes.set(element, { top: 700, height: 20 });
    return element;
  };
  page.type(viewer, "Neubau", false);
  const current = page.current(viewer);
  assert.ok(current);
  assert.equal(closedAncestors(current, viewer).length, 0, "the match has no closed parent");
  assert.equal(tree.scrollTop, 700 - 100 - (300 - 20) / 2);
  assert.equal(page.document.scrolled.length, 0);
});

test("a search that another script sets while a button of the viewer has focus leaves the page where it is", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  const button = viewer.querySelector('[data-nodestep-data-action="expand"]');
  const input = viewer.querySelector(".nodestep-data-search");
  assert.ok(button && input);
  page.document.activeElement = button;
  input.value = "Neubau";
  page.document.dispatch(new FakeEvent("input", input));
  assert.equal(page.count(viewer), "1 of 1");
  assert.equal(page.document.scrolled.length, 0);
});

test("a search finds keys as well as values", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  page.type(viewer, "row_count");
  assert.equal(page.count(viewer), "1 of 1");
  assert.ok(leafOf(page.current(viewer) as FakeElement).classList.contains("nodestep-data-key"));
});

test("Enter and Shift+Enter move to the next and the previous match and wrap around", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  page.type(viewer, "caramel");
  const seen = [page.current(viewer)];
  for (const expected of ["2 of 3", "3 of 3", "1 of 3"]) {
    const event = page.press(viewer);
    assert.ok(event.defaultPrevented);
    assert.equal(page.count(viewer), expected);
    seen.push(page.current(viewer));
  }
  assert.ok(seen[3] === seen[0], "the fourth match is the first again");
  assert.equal(new Set(seen).size, 3);
  for (const element of seen.slice(0, 3)) {
    assert.ok(element);
    assert.equal(closedAncestors(element, viewer).length, 0, "the match has no closed parent");
  }
  assert.ok((seen[1] as FakeElement).closest(".nodestep-data-message-body"), "the second match is in the tool result");
  assert.equal(leafOf(seen[2] as FakeElement).classList.contains("nodestep-data-text"), true);
  assert.equal(viewer.querySelectorAll(".nodestep-data-raw").filter((raw) => raw.open).length, 0, "no JSON was opened");
  page.press(viewer, true);
  assert.equal(page.count(viewer), "3 of 3");
  assert.equal(viewer.querySelectorAll('mark[aria-current="true"]').length, 1);
});

test("jumping to a match opens the closed nodes around it", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  const before = viewer.querySelectorAll("details").filter((element) => !element.open).length;
  page.type(viewer, "Neubau");
  const current = page.current(viewer);
  assert.ok(current);
  assert.equal(closedAncestors(current, viewer).length, 0, "the match has no closed parent");
  const after = viewer.querySelectorAll("details").filter((element) => !element.open).length;
  assert.ok(after < before);
});

test("a query is matched as plain text, ignoring case", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  page.type(viewer, "CARAMEL");
  assert.equal(page.count(viewer), "1 of 3");
  page.type(viewer, "SUM(i.quantity)");
  assert.deepEqual(page.marks(viewer), ["SUM(i.quantity)"]);
  page.type(viewer, ".*");
  assert.equal(page.count(viewer), "No matches");
  assert.deepEqual(page.marks(viewer), []);
});

test("each message is a folded row: the role, a preview of its text and one line per tool call", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  const rows = viewer.querySelectorAll(".nodestep-data-message-row");
  assert.equal(rows.length, 5);
  assert.ok(rows.every((row) => !row.open), "every row starts folded");
  const previews = rows.map((row) =>
    row
      .querySelectorAll(".nodestep-data-preview-line")
      .map((line) => line.textContent)
      .join(" | "),
  );
  assert.match(previews[0], /^Answer questions about demo_shop with SQL\. .+…$/);
  assert.equal(previews[1], "Which ten products sold the most units?");
  assert.match(previews[2], /^run_sql\(sql: "SELECT p\.name AS product, SUM\(i\.quantity\) AS units FROM order_items/);
  assert.match(previews[3], /^columns: \["product", "units"\], rows: \[\["Salted caramel bar", 258\]/);
  assert.match(previews[4], /^Salted caramel bar sold the most units, 258/);
  const short = rows.map((row) => row.querySelector(".nodestep-data-preview-short") !== null);
  assert.deepEqual(short, [false, true, false, false, true]);
  const prose = rows.map((row) => row.querySelector(".nodestep-data-preview-text") !== null);
  assert.deepEqual(prose, [true, true, false, false, true]);
  assert.equal(rows[3].querySelector(".nodestep-data-message-name")?.textContent, "run_sql");
  for (const row of rows) {
    const body = row.querySelector(".nodestep-data-message-body");
    assert.ok(body, "the whole message waits in the row body");
    assert.ok(body.querySelector(".nodestep-data-raw"), "the JSON is inside the body");
  }
});

test("the folded previews are not searched, so a match is counted where the whole message is", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  page.type(viewer, "Which ten products");
  assert.equal(page.count(viewer), "1 of 2");
  for (const mark of viewer.querySelectorAll("mark")) {
    assert.equal(mark.closest(".nodestep-data-preview"), null, "no mark in a preview");
  }
});

test("a search finds text inside a folded tool result and opens its row", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  const tool = viewer.querySelectorAll(".nodestep-data-message-row")[3];
  assert.ok(!tool.open);
  page.type(viewer, "Dark chocolate");
  assert.equal(page.count(viewer), "1 of 3");
  page.press(viewer);
  const current = page.current(viewer);
  assert.ok(current);
  assert.ok(current.closest(".nodestep-data-message-row") === tool, "the second match is in the tool result");
  assert.equal(closedAncestors(current, viewer).length, 0, "the row and the nodes around the match are open");
  assert.ok(tool.open);
});

test("a search finds the keys and values that only the closed JSON of a message holds, and opens it", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  const raws = viewer.querySelectorAll(".nodestep-data-raw");
  assert.ok(raws.length > 0 && raws.every((raw) => !raw.open));
  page.type(viewer, "tool_call_id");
  assert.equal(page.count(viewer), "1 of 1");
  const current = page.current(viewer);
  assert.ok(current);
  assert.ok(leafOf(current).classList.contains("nodestep-data-key"));
  assert.equal(closedAncestors(current, viewer).length, 0, "the JSON around the match is open");
  page.type(viewer, "call_1");
  assert.equal(page.count(viewer), "1 of 2");
  page.click(viewer, "collapse");
  assert.equal(page.count(viewer), "1 of 2", "closing the JSON keeps its matches");
  page.press(viewer);
  assert.equal(closedAncestors(page.current(viewer) as FakeElement, viewer).length, 0);
});

test("the JSON of a message is not searched for what its row already shows, so each match counts once", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  const shown = viewer.querySelectorAll("[data-nodestep-data-echo]");
  assert.ok(shown.length > 0 && shown.every((entry) => entry.closest(".nodestep-data-raw")));
  page.type(viewer, "Which ten products sold the most units");
  assert.equal(page.count(viewer), "1 of 2");
  page.type(viewer, "ORDER BY units");
  assert.equal(page.count(viewer), "1 of 1");
  assert.ok(page.current(viewer)?.closest(".nodestep-data-call-arguments"), "the match is in the call of the row");
  for (const query of ["Salted caramel bar sold", "row_count", "run_sql"]) {
    page.type(viewer, query);
    const marks = viewer.querySelectorAll("mark");
    assert.ok(marks.length > 0, query);
    assert.ok(marks.every((mark) => !mark.closest("[data-nodestep-data-echo]")), query);
  }
  page.type(viewer, "run_sql");
  assert.equal(page.count(viewer), "1 of 2", "the call and the tool name, once each");
});

test("clearing the search takes the marks away and leaves the text as it was", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  const text = viewer.querySelector(".nodestep-data-tree")?.textContent;
  page.type(viewer, "caramel");
  page.type(viewer, "");
  assert.deepEqual(page.marks(viewer), []);
  assert.equal(page.count(viewer), "");
  assert.equal(viewer.querySelector(".nodestep-data-tree")?.textContent, text);
  assert.equal(page.press(viewer).defaultPrevented, true);
});

test("Expand all opens every node and message row, and Collapse all closes the nodes, the rows and the message JSON", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  const nodes = viewer.querySelectorAll(".nodestep-data-node");
  const rows = viewer.querySelectorAll(".nodestep-data-message-row");
  const raws = viewer.querySelectorAll(".nodestep-data-raw");
  assert.ok(nodes.some((node) => !node.open));
  assert.ok(rows.length > 0 && rows.every((row) => !row.open));
  page.click(viewer, "expand");
  assert.ok(nodes.every((node) => node.open));
  assert.ok(rows.every((row) => row.open));
  assert.ok(raws.every((node) => !node.open));
  raws[0].open = true;
  page.click(viewer, "collapse");
  assert.ok([...nodes, ...rows, ...raws].every((node) => !node.open));
});

test("Copy JSON copies the source text and says so for a moment", async () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  const button = page.click(viewer, "copy");
  await page.settle();
  const source = viewer.querySelector(".nodestep-data-source")?.textContent;
  assert.deepEqual(page.copied, [source]);
  assert.ok(JSON.parse(source as string).messages.length > 0);
  assert.equal(button.textContent, "Copied");
  page.click(viewer, "copy");
  await page.settle();
  for (const timer of page.timers.splice(0)) timer();
  assert.equal(button.textContent, "Copy JSON");
});

test("a copy that the browser refuses says that it failed", async () => {
  for (const clipboard of [
    {
      writeText: () => Promise.reject(new Error("NotAllowedError")),
    },
    {
      writeText: () => {
        throw new Error("no clipboard");
      },
    },
  ]) {
    const page = loadPage(example(), clipboard);
    const button = page.click(page.viewers[0], "copy");
    await page.settle();
    assert.equal(button.textContent, "Copy failed");
  }
});

test("each viewer on a page searches only its own data", () => {
  const page = loadPage(`${example()}${example()}`);
  const [first, second] = page.viewers;
  page.type(first, "caramel");
  assert.equal(page.count(first), "1 of 3");
  assert.equal(page.count(second), "");
  assert.deepEqual(page.marks(second), []);
});

test("keys typed while a word is being composed do not jump", () => {
  const page = loadPage(example());
  const [viewer] = page.viewers;
  page.type(viewer, "caramel");
  const input = viewer.querySelector(".nodestep-data-search") as FakeElement;
  page.document.dispatch(new FakeEvent("keydown", input, { key: "Enter", isComposing: true }));
  assert.equal(page.count(viewer), "1 of 3");
});

test("the script runs under script-src 'self': no eval, no inline styles, no markup strings", () => {
  for (const pattern of [
    /\beval\(/,
    /new Function/,
    /\.style\b/,
    /innerHTML|outerHTML|insertAdjacentHTML/,
    /setAttribute\("style"/,
    /localStorage/,
  ]) {
    assert.doesNotMatch(SCRIPT, pattern);
  }
});
