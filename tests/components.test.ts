import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type Rules,
  selectorClasses,
  STYLESHEET,
  stylesheetRules,
  withoutComments,
} from "./support.ts";

const RULES = stylesheetRules(
  STYLESHEET.replace(/@media[^{]*\{[\s\S]*?\n\}/g, ""),
);

function rule(selector: string): Record<string, string> {
  const found = RULES[selector];
  assert.ok(found, `nodestep.css has no rule for ${selector}`);
  return found;
}

function blockRules(query: string): Rules {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(`@media ${escaped} \\{([\\s\\S]*?)\\n\\}`).exec(
    STYLESHEET,
  );
  assert.ok(block, `nodestep.css has no @media ${query} block`);
  return stylesheetRules(block[1]);
}

export const NEW_CLASSES = {
  layout: [
    "nodestep-page",
    "nodestep-page-narrow",
    "nodestep-app",
    "nodestep-app-fixed",
    "nodestep-app-start",
    "nodestep-app-main",
    "nodestep-app-end",
    "nodestep-app-toggle",
    "nodestep-app-toggle-start",
    "nodestep-app-toggle-end",
    "nodestep-app-close",
    "nodestep-stack",
    "nodestep-stack-small",
    "nodestep-stack-large",
    "nodestep-cluster",
    "nodestep-cluster-end",
    "nodestep-grid",
    "nodestep-section",
    "nodestep-lead",
    "nodestep-divider",
  ],
  navigation: ["nodestep-tabs", "nodestep-tab", "nodestep-breadcrumbs"],
  data: [
    "nodestep-facts",
    "nodestep-pairs",
    "nodestep-list",
    "nodestep-list-row",
    "nodestep-list-head",
    "nodestep-list-meta",
    "nodestep-details",
    "nodestep-panel-item-line",
    "nodestep-panel-item-title",
    "nodestep-panel-item-time",
  ],
  forms: [
    "nodestep-check",
    "nodestep-fieldset",
    "nodestep-input-row",
    "nodestep-button-icon",
  ],
  feedback: [
    "nodestep-spinner",
    "nodestep-tag-wrap",
    "nodestep-card-completed",
    "nodestep-card-failed",
  ],
  overlays: ["nodestep-tooltip", "nodestep-tooltip-anchor"],
  chat: [
    "nodestep-chat",
    "nodestep-chat-log",
    "nodestep-chat-turns",
    "nodestep-chat-dock",
    "nodestep-chat-message",
    "nodestep-chat-message-user",
    "nodestep-chat-bubble",
    "nodestep-chat-text",
    "nodestep-chat-actions",
    "nodestep-composer",
    "nodestep-composer-stacked",
    "nodestep-composer-field",
    "nodestep-composer-bar",
    "nodestep-composer-send",
    "nodestep-composer-stop",
    "nodestep-chips",
    "nodestep-chips-label",
    "nodestep-chips-list",
    "nodestep-chip",
  ],
  charts: [
    "nodestep-chart",
    "nodestep-chart-title",
    "nodestep-chart-canvas",
    "nodestep-chart-grid",
    "nodestep-chart-axis",
    "nodestep-chart-crosshair",
    "nodestep-chart-tick",
    "nodestep-chart-axis-title",
    "nodestep-chart-category",
    "nodestep-chart-value",
    "nodestep-chart-bar",
    "nodestep-chart-line",
    "nodestep-chart-dot",
    "nodestep-chart-active",
  ],
  utilities: ["nodestep-mono", "nodestep-nowrap"],
};

for (const [group, names] of Object.entries(NEW_CLASSES)) {
  test(`nodestep.css has the ${group} classes`, () => {
    const classes = selectorClasses(STYLESHEET);
    assert.deepEqual(
      names.filter((name) => !classes.has(name)),
      [],
    );
  });
}

test("the page column keeps content within the content width, with gutters", () => {
  const page = rule(".nodestep-page");
  assert.equal(page["max-width"], "var(--nodestep-content-width)");
  assert.equal(page["margin-inline"], "auto");
  assert.equal(page["padding-inline"], "var(--nodestep-gutter)");
  assert.deepEqual(rule(".nodestep-main"), {
    ...page,
    "padding-block": "var(--nodestep-space-5) var(--nodestep-space-7)",
  });
  assert.equal(
    rule(".nodestep-page-narrow")["max-width"],
    "calc(var(--nodestep-narrow-width) + 2 * var(--nodestep-gutter))",
  );
  assert.equal(rule(":root")["--nodestep-narrow-width"], "48rem");
});

test("the app shell puts the top bar across and the panels and main area below it", () => {
  const app = rule(".nodestep-app");
  assert.equal(app.display, "grid");
  assert.equal(app["grid-template-columns"], "auto minmax(0, 1fr) auto");
  assert.equal(app["grid-template-rows"], "auto minmax(0, 1fr)");
  assert.equal(app["min-height"], "100dvh");
  assert.equal(
    rule(".nodestep-app > .nodestep-topbar")["grid-column"],
    "1 / -1",
  );
  for (const [selector, column] of [
    [".nodestep-app-start", "1"],
    [".nodestep-app-main", "2"],
    [".nodestep-app-end", "3"],
  ]) {
    assert.equal(rule(selector)["grid-column"], column, selector);
    assert.equal(rule(selector)["grid-row"], "2", selector);
  }
});

test("side panels sit below the top bar and keep their place while the page scrolls", () => {
  const panel = rule(".nodestep-app > .nodestep-panel");
  assert.equal(panel.position, "sticky");
  assert.equal(panel.top, "var(--nodestep-bar-height)");
  assert.equal(panel.height, "calc(100dvh - var(--nodestep-bar-height))");
  assert.equal(panel["align-self"], "start");
});

test("a fixed app shell fills the window and scrolls its main area", () => {
  assert.deepEqual(rule(".nodestep-app-fixed"), {
    height: "100dvh",
    "min-height": "0",
    overflow: "hidden",
  });
  assert.deepEqual(rule(".nodestep-app-fixed > .nodestep-panel"), {
    position: "static",
    height: "auto",
    "align-self": "stretch",
  });
  const main = rule(".nodestep-app-fixed > .nodestep-app-main");
  assert.equal(main.overflow, "auto");
  assert.equal(main["min-height"], "0");
});

test("below 75rem the end panel opens in place of the start panel", () => {
  const medium = blockRules("(width < 75rem)");
  assert.equal(medium[".nodestep-app-end"].display, "none");
  assert.equal(
    medium['.nodestep-app[data-panel="end"] .nodestep-app-start'].display,
    "none",
  );
  assert.equal(
    medium['.nodestep-app[data-panel="end"] .nodestep-app-end'].display,
    "flex",
  );
  assert.equal(medium[".nodestep-app-toggle-end"].display, "inline-flex");
  assert.equal(
    medium[".nodestep-app-end .nodestep-app-close"].display,
    "inline-flex",
  );
});

test("below 48rem an open panel takes the place of the main area", () => {
  const narrow = blockRules("(width < 48rem)");
  assert.equal(narrow[".nodestep-app-start"].display, "none");
  assert.equal(
    narrow['.nodestep-app[data-panel="start"] .nodestep-app-start'].display,
    "flex",
  );
  assert.equal(
    narrow['.nodestep-app[data-panel="start"] .nodestep-app-start'][
      "grid-column"
    ],
    "1 / -1",
  );
  assert.equal(
    narrow['.nodestep-app[data-panel="end"] .nodestep-app-end']["grid-column"],
    "1 / -1",
  );
  assert.equal(
    narrow[".nodestep-app[data-panel] .nodestep-app-main"].display,
    "none",
  );
  assert.equal(narrow[".nodestep-app-toggle-start"].display, "inline-flex");
  assert.equal(
    narrow[".nodestep-app-start .nodestep-app-close"].display,
    "inline-flex",
  );
});

test("panel toggles and close buttons show only when their panel is folded away", () => {
  assert.equal(rule(".nodestep-app-toggle").display, "none");
  assert.equal(rule(".nodestep-app-close").display, "none");
  const open = rule('.nodestep-app-toggle[aria-expanded="true"]');
  assert.equal(open.background, "var(--nodestep-color-accent-wash)");
  assert.equal(open["border-color"], "var(--nodestep-color-accent)");
});

test("stacks and cards space their children with gap only", () => {
  for (const selector of [
    ".nodestep-stack > *",
    ".nodestep-card > *",
    ".nodestep-chat-message > *",
    ".nodestep-list-row > *",
  ]) {
    assert.equal(rule(selector)["margin-block"], "0", selector);
  }
  assert.equal(rule(".nodestep-stack").gap, "var(--nodestep-space-4)");
  assert.equal(rule(".nodestep-stack-small").gap, "var(--nodestep-space-2)");
  assert.equal(rule(".nodestep-stack-large").gap, "var(--nodestep-space-6)");
  assert.equal(rule(".nodestep-cluster")["flex-wrap"], "wrap");
  assert.equal(rule(".nodestep-cluster-end")["justify-content"], "flex-end");
  assert.match(
    rule(".nodestep-grid")["grid-template-columns"],
    /^repeat\(auto-fit, minmax\(min\(100%, /,
  );
});

test("layout rules come after the components, so a stack wins over a component margin", () => {
  const plain = withoutComments(STYLESHEET);
  assert.ok(
    plain.indexOf(".nodestep-stack > *") >
      plain.indexOf(".nodestep-toast-text"),
  );
});

test("sections leave room for the sticky top bar when a link scrolls to them", () => {
  assert.equal(
    rule(".nodestep-section")["scroll-margin-top"],
    "calc(var(--nodestep-bar-height) + var(--nodestep-space-4))",
  );
  assert.equal(
    rule(".nodestep-section + .nodestep-section")["border-top"],
    "var(--nodestep-border)",
  );
  assert.deepEqual(rule(".nodestep-lead"), {
    "max-width": "var(--nodestep-measure)",
    color: "var(--nodestep-color-text-secondary)",
  });
  assert.deepEqual(rule(".nodestep-divider"), {
    margin: "0",
    border: "0",
    "border-top": "var(--nodestep-border)",
  });
});

test("the current tab has a deep amber line and the text color, not color alone", () => {
  const current = rule('.nodestep-tab[aria-current="page"]');
  assert.equal(
    current["border-bottom-color"],
    "var(--nodestep-color-accent-text)",
  );
  assert.equal(current.color, "var(--nodestep-color-text)");
  assert.deepEqual(rule('.nodestep-tab[aria-current="true"]'), current);
  assert.deepEqual(rule('.nodestep-tab[aria-selected="true"]'), current);
  assert.equal(rule(".nodestep-tab")["border-bottom"], "2px solid transparent");
  assert.equal(
    rule(".nodestep-tabs")["border-bottom"],
    "var(--nodestep-border)",
  );
});

test("breadcrumbs separate their items with a slash that screen readers skip", () => {
  assert.equal(
    rule(".nodestep-breadcrumbs li + li::before").content,
    '"/" / ""',
  );
  assert.equal(
    rule('.nodestep-breadcrumbs [aria-current="page"]').color,
    "var(--nodestep-color-text-secondary)",
  );
});

test("facts wrap as label and value blocks, and pairs line up in two columns that stack on narrow screens", () => {
  assert.equal(rule(".nodestep-facts")["flex-wrap"], "wrap");
  assert.equal(
    rule(".nodestep-facts dt").color,
    "var(--nodestep-color-text-muted)",
  );
  assert.equal(
    rule(".nodestep-pairs")["grid-template-columns"],
    "fit-content(40%) minmax(0, 1fr)",
  );
  const narrow = blockRules("(max-width: 40rem)");
  assert.equal(
    narrow[".nodestep-pairs"]["grid-template-columns"],
    "minmax(0, 1fr)",
  );
  assert.equal(
    narrow[".nodestep-pairs dd + dt"]["margin-top"],
    "var(--nodestep-space-2)",
  );
});

test("list rows are joined by a line, and panel item titles shorten with an ellipsis", () => {
  assert.equal(
    rule(".nodestep-list-row + .nodestep-list-row")["border-top"],
    "var(--nodestep-border)",
  );
  assert.equal(rule(".nodestep-list-meta")["margin-inline-start"], "auto");
  const title = rule(".nodestep-panel-item-title");
  assert.equal(title["text-overflow"], "ellipsis");
  assert.equal(title["white-space"], "nowrap");
  assert.equal(rule(".nodestep-panel-item-time")["white-space"], "nowrap");
});

test("a details summary reads as secondary text and the content keeps its distance", () => {
  assert.equal(
    rule(".nodestep-details > summary").color,
    "var(--nodestep-color-text-secondary)",
  );
  assert.equal(
    rule(".nodestep-details > summary:hover").color,
    "var(--nodestep-color-text)",
  );
  assert.equal(
    rule(".nodestep-details[open] > summary")["margin-bottom"],
    "var(--nodestep-space-2)",
  );
});

test("the spinner turns with the badge ring and is still a ring under reduced motion", () => {
  const spinner = rule(".nodestep-spinner");
  assert.equal(spinner.animation, "nodestep-spin 0.8s linear infinite");
  assert.equal(spinner["border-right-color"], "transparent");
  assert.equal(spinner["border-radius"], "50%");
});

test("the tooltip floats over the page without catching the pointer", () => {
  const tooltip = rule(".nodestep-tooltip");
  assert.equal(tooltip.position, "absolute");
  assert.equal(tooltip["pointer-events"], "none");
  assert.equal(tooltip["box-shadow"], "var(--nodestep-shadow-overlay)");
  assert.equal(rule(".nodestep-tooltip-anchor").position, "relative");
  assert.equal(
    rule(
      ".nodestep-tooltip-anchor:not(:hover, :focus-within) > .nodestep-tooltip",
    ).display,
    "none",
  );
});

test("the composer shows the shared focus ring while its field has focus", () => {
  const box = rule(
    ".nodestep-composer:has(.nodestep-composer-field:focus-visible)",
  );
  assert.equal(box.outline, "var(--nodestep-focus-ring)");
  assert.equal(box["outline-offset"], "var(--nodestep-focus-offset)");
  assert.equal(box["box-shadow"], "var(--nodestep-focus-halo)");
  assert.deepEqual(rule(".nodestep-composer-field:focus-visible"), {
    outline: "none",
    "box-shadow": "none",
  });
  assert.ok(
    !Object.keys(RULES).some(
      (selector) =>
        selector.includes("composer") && selector.includes(":focus-within"),
    ),
  );
});

test("the send button is round and filled with the accent, and muted while it cannot send", () => {
  const send = rule(".nodestep-composer-send");
  assert.equal(send["border-radius"], "var(--nodestep-radius-pill)");
  assert.equal(send.color, "var(--nodestep-color-on-accent)");
  assert.equal(send.background, "var(--nodestep-color-accent)");
  assert.equal(send.width, "var(--nodestep-control-height)");
  assert.equal(send.height, "var(--nodestep-control-height)");
  const blocked = rule('.nodestep-composer-send[aria-disabled="true"]');
  assert.equal(blocked.color, "var(--nodestep-color-text-muted)");
  assert.equal(blocked.background, "var(--nodestep-color-sunk)");
  assert.equal(rule(".nodestep-composer-send svg").stroke, "currentColor");
  assert.deepEqual(rule(".nodestep-composer-send .nodestep-composer-stop"), {
    fill: "currentColor",
    stroke: "none",
  });
  assert.ok(
    !Object.keys(RULES).some((selector) =>
      /\.nodestep-composer-send[^,]*:focus/.test(selector),
    ),
  );
});

test("chips are pills that take the accent wash on hover and grey out while disabled", () => {
  const chip = rule(".nodestep-chip");
  assert.equal(chip["border-radius"], "var(--nodestep-radius-pill)");
  assert.equal(chip.border, "var(--nodestep-border-strong)");
  assert.equal(
    rule(".nodestep-chip:hover").background,
    "var(--nodestep-color-accent-wash)",
  );
  const disabled = rule('.nodestep-chip[aria-disabled="true"]');
  assert.equal(disabled.color, "var(--nodestep-color-text-muted)");
  assert.equal(disabled.cursor, "not-allowed");
  assert.deepEqual(rule(".nodestep-chip:disabled"), disabled);
});

test("a user message sits on the end side in a bubble, and the log keeps the latest turn in view", () => {
  assert.equal(rule(".nodestep-chat-message-user")["align-items"], "flex-end");
  assert.equal(
    rule(".nodestep-chat-bubble").background,
    "var(--nodestep-color-sunk)",
  );
  assert.equal(rule(".nodestep-chat-text")["white-space"], "pre-wrap");
  const log = rule(".nodestep-chat-log");
  assert.equal(log["flex-direction"], "column-reverse");
  assert.equal(log["overflow-y"], "auto");
  assert.equal(
    rule(".nodestep-chat-dock")["border-top"],
    "var(--nodestep-border)",
  );
});

test("chart bars have an accent-text edge and chart lines and points use accent-text", () => {
  assert.equal(
    rule(".nodestep-chart-bar").fill,
    "var(--nodestep-color-accent)",
  );
  assert.equal(
    rule(".nodestep-chart-bar").stroke,
    "var(--nodestep-color-accent-text)",
  );
  assert.equal(
    rule(".nodestep-chart-line").stroke,
    "var(--nodestep-color-accent-text)",
  );
  assert.equal(
    rule(".nodestep-chart-dot").fill,
    "var(--nodestep-color-accent-text)",
  );
  assert.equal(
    rule(".nodestep-chart-grid").stroke,
    "var(--nodestep-color-border)",
  );
  assert.equal(
    rule(".nodestep-chart-axis").stroke,
    "var(--nodestep-color-border-strong)",
  );
});

test("text and lines in the accent use accent-text", () => {
  const bright = [
    ...withoutComments(STYLESHEET).matchAll(
      /(?<![\w-])(?:color|stroke):\s*var\(--nodestep-color-accent(?:-hover)?\)/g,
    ),
  ].map((match) => match[0]);
  assert.deepEqual(bright, []);
});

test("scroll areas of panels and the chat log use thin scrollbars", () => {
  assert.equal(rule(".nodestep-panel-body")["scrollbar-width"], "thin");
  assert.equal(rule(".nodestep-chat-log")["scrollbar-width"], "thin");
});

test("a landmark or panel title focused by a script shows no ring", () => {
  for (const selector of [
    '.nodestep-main[tabindex="-1"]:focus',
    '.nodestep-app-main[tabindex="-1"]:focus',
    '.nodestep-panel-title[tabindex="-1"]:focus',
  ]) {
    assert.deepEqual(
      rule(selector),
      { outline: "none", "box-shadow": "none" },
      selector,
    );
  }
});

test("form helpers: a labelled check, a fieldset, an input with its button and a square icon button", () => {
  assert.equal(rule(".nodestep-check").display, "inline-flex");
  assert.equal(rule(".nodestep-fieldset").border, "var(--nodestep-border)");
  assert.equal(rule(".nodestep-input-row > .nodestep-input").flex, "1 1 14rem");
  assert.equal(
    rule(".nodestep-button-icon").width,
    "var(--nodestep-control-height)",
  );
  assert.equal(
    rule(".nodestep-button-icon.nodestep-button-small").width,
    "var(--nodestep-control-height-small)",
  );
});

test("timeline names keep their badges and tags whole, and preformatted text in a table wraps", () => {
  assert.equal(rule(".nodestep-timeline-name > .nodestep-badge").flex, "none");
  assert.equal(rule(".nodestep-timeline-name > .nodestep-tag").flex, "none");
  assert.equal(rule(".nodestep-table pre")["white-space"], "pre-wrap");
});

test("a failed card has a danger edge and a completed card the strong neutral edge", () => {
  assert.equal(
    rule(".nodestep-card-failed")["border-inline-start"],
    "4px solid var(--nodestep-color-danger)",
  );
  assert.deepEqual(
    rule(".nodestep-card-completed"),
    rule(".nodestep-card-answered"),
  );
});

test("an empty state spans its container like a notice, with its content centered", () => {
  const empty = rule(".nodestep-empty");
  assert.equal(empty.width, "100%");
  assert.equal(empty["max-width"], undefined);
  assert.equal(empty["margin-inline"], undefined);
  assert.equal(empty["align-items"], "center");
  assert.equal(empty["text-align"], "center");
});

test("the search field is a bordered box with the icon at the start and the clear button at the end", () => {
  assert.deepEqual(rule(".nodestep-search"), {
    position: "relative",
    flex: "none",
    width: "14.625rem",
    height: "var(--nodestep-control-height)",
    background: "var(--nodestep-color-surface)",
    border: "var(--nodestep-border-strong)",
    "border-radius": "var(--nodestep-radius)",
  });
  const input = rule(".nodestep-search-input");
  assert.equal(input.width, "100%");
  assert.equal(input.height, "100%");
  assert.equal(input.padding, "0 2.75rem");
  assert.equal(input["font-size"], "var(--nodestep-text-base)");
  assert.equal(input.color, "var(--nodestep-color-text)");
  assert.equal(input.background, "transparent");
  assert.equal(input.border, "0");
  assert.equal(input.appearance, "none");
  for (const part of [".nodestep-search-icon", ".nodestep-search-clear"]) {
    const found = rule(part);
    assert.equal(found.position, "absolute", part);
    assert.equal(found.top, "0.375rem", part);
    assert.equal(found.width, "1.5rem", part);
    assert.equal(found.height, "1.5rem", part);
    assert.deepEqual(rule(`${part} svg`), {
      width: "1.5rem",
      height: "1.5rem",
      fill: "currentColor",
    });
  }
  assert.equal(rule(".nodestep-search-icon").left, "0.625rem");
  assert.equal(rule(".nodestep-search-icon")["pointer-events"], "none");
  assert.equal(rule(".nodestep-search-clear").right, "0.625rem");
});

test("the search field takes the colors of the docs search: text icon, muted placeholder, secondary clear button", () => {
  assert.equal(rule(".nodestep-search-icon").color, "var(--nodestep-color-text)");
  assert.deepEqual(rule(".nodestep-search-input::placeholder"), {
    color: "var(--nodestep-color-text-muted)",
    opacity: "1",
  });
  assert.equal(rule(".nodestep-search-clear").color, "var(--nodestep-color-text-secondary)");
  assert.deepEqual(rule(".nodestep-search-clear:hover"), { opacity: "0.7" });
  assert.deepEqual(rule(".nodestep-search:hover"), {
    "border-color": "var(--nodestep-color-text-muted)",
  });
});

test("a focused search field turns its border amber, as the docs search does, instead of drawing a ring", () => {
  assert.deepEqual(rule(".nodestep-search:focus-within"), {
    "border-color": "var(--nodestep-color-accent)",
  });
  assert.deepEqual(rule(".nodestep-search-input:focus-visible"), {
    outline: "none",
    "box-shadow": "none",
  });
  assert.deepEqual(rule(".nodestep-search:focus-within .nodestep-search-icon"), {
    color: "var(--nodestep-color-text-secondary)",
  });
  assert.deepEqual(rule(".nodestep-search-input:focus::placeholder"), {
    color: "transparent",
  });
});

test("the clear button shows only while the search field holds text, and the browser's own one never", () => {
  assert.deepEqual(
    rule(".nodestep-search-input:placeholder-shown ~ .nodestep-search-clear"),
    { display: "none" },
  );
  assert.deepEqual(rule(".nodestep-search-input::-webkit-search-cancel-button"), {
    appearance: "none",
  });
});

test("below 60rem the search field folds to its icon, which works as a button and opens the field over the top bar", () => {
  const compact = blockRules("(width < 60rem)");
  assert.deepEqual(compact[".nodestep-search"], {
    width: "var(--nodestep-control-height)",
    background: "transparent",
    border: "0",
  });
  const button = compact[".nodestep-search-icon"];
  assert.equal(button.inset, "0");
  assert.equal(button.width, "100%");
  assert.equal(button.height, "100%");
  assert.equal(button.color, "var(--nodestep-color-text-secondary)");
  assert.equal(button.cursor, "pointer");
  assert.equal(button["pointer-events"], "auto");
  assert.deepEqual(compact[".nodestep-search-icon:hover"], {
    color: "var(--nodestep-color-text)",
    background: "var(--nodestep-color-sunk)",
  });
  assert.deepEqual(compact[".nodestep-search-icon svg"], {
    width: "1.125rem",
    height: "1.125rem",
  });
  const folded = compact[".nodestep-search-input"];
  assert.equal(folded["clip-path"], "inset(50%)");
  assert.equal(folded.display, undefined, "a folded field can still take the focus");
  assert.deepEqual(compact[".nodestep-search:not(:focus-within) .nodestep-search-clear"], {
    display: "none",
  });
  const open = compact[".nodestep-search:focus-within"];
  assert.equal(open.position, "fixed");
  assert.equal(open.inset, "0 0 auto");
  assert.ok(Number(open["z-index"]) > Number(rule("body > .nodestep-topbar")["z-index"]));
  assert.equal(open.width, "auto");
  assert.equal(open.height, "var(--nodestep-bar-height)");
  assert.equal(open.background, "var(--nodestep-color-surface)");
  assert.equal(open["border-bottom"], "var(--nodestep-border)");
  const text = compact[".nodestep-search:focus-within .nodestep-search-input"];
  assert.equal(text["clip-path"], "none");
  assert.equal(text.padding, "0 2.75rem 0 4.5rem");
  assert.equal(text["font-size"], "1.125rem");
  assert.equal(
    compact[".nodestep-search:focus-within .nodestep-search-icon"].left,
    "var(--nodestep-gutter)",
  );
  assert.equal(
    compact[".nodestep-search:focus-within .nodestep-search-clear"].right,
    "var(--nodestep-gutter)",
  );
  assert.deepEqual(compact[".nodestep-search-input:focus::placeholder"], {
    color: "var(--nodestep-color-text-secondary)",
  });
});

test("a rendered diagram collapses whitespace in its labels, so formatted SVG text stays centered in every browser", () => {
  assert.equal(rule(".nodestep-mermaid svg")["white-space"], "normal");
});
