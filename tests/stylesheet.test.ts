import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACCENT_HUE_SPREAD,
  ALL_ROLES,
  COLOR_ROLES,
  colorFamily,
  colorLiterals,
  colorTokens,
  contrastRatio,
  DARK_INTERFACE_PAIRS,
  declaredRoles,
  DEMO,
  demoStyles,
  hueAndChroma,
  INTERFACE_CONTRAST,
  INTERFACE_PAIRS,
  LIGHT_FOCUS_EDGE_PAIRS,
  literalsOutsideTokens,
  mediaBlock,
  mermaidColorRules,
  namedColors,
  NODE_STATES,
  VERSION,
  type Rules,
  selectorClasses,
  SOURCES,
  STYLESHEET,
  stylesheetRules,
  TEXT_CONTRAST,
  TEXT_PAIRS,
  THEME_BUTTON,
  TOKEN_KINDS,
  withoutComments,
} from "./support.ts";

test("the stylesheet has component classes", () => {
  const components = new Set(
    [...selectorClasses(STYLESHEET)].filter((name) =>
      name.startsWith("nodestep-"),
    ),
  );
  const expected = [
    "nodestep-topbar",
    "nodestep-panel",
    "nodestep-panel-header",
    "nodestep-button-primary",
    "nodestep-button-secondary",
    "nodestep-button-quiet",
    "nodestep-button-danger",
    "nodestep-input",
    "nodestep-select",
    "nodestep-textarea",
    "nodestep-table",
    "nodestep-code",
    "nodestep-badge-completed",
    "nodestep-badge-running",
    "nodestep-badge-paused",
    "nodestep-badge-stopped",
    "nodestep-badge-failed",
    "nodestep-timeline",
    "nodestep-timeline-bar",
    "nodestep-card",
    "nodestep-mermaid",
    "nodestep-theme-button",
    "nodestep-empty",
    "nodestep-toast",
    "nodestep-message",
  ];
  assert.deepEqual(
    expected.filter((name) => !components.has(name)),
    [],
  );
});

for (const kind of TOKEN_KINDS) {
  test(`the code token class for ${kind} exists`, () => {
    assert.ok(selectorClasses(STYLESHEET).has(`nodestep-token-${kind}`));
  });
}

for (const state of [
  "visited",
  "current",
  "paused",
  "failed",
  "stopped",
  "tool-error",
  "edge-taken",
]) {
  test(`the graph state class ${state} exists`, () => {
    assert.match(
      STYLESHEET,
      new RegExp(`\\.nodestep-mermaid[^{]*\\.${state}\\b`),
    );
  });
}

function nodeLook(rules: Rules, state: string): [string, string, string] {
  const base = rules[".nodestep-mermaid .node .label-container path"];
  const shape =
    rules[`.nodestep-mermaid .${state} .label-container path`] ?? {};
  const label = rules[`.nodestep-mermaid .${state} .nodeLabel`] ?? {};
  return [
    shape["stroke-width"] ?? base["stroke-width"],
    shape["stroke-dasharray"] ?? "none",
    label["text-decoration"] ?? "none",
  ];
}

for (const state of ["stopped", "tool-error"]) {
  test(`a ${state} node differs from the other states beyond color`, () => {
    const rules = stylesheetRules(STYLESHEET);
    const look = nodeLook(rules, state);
    const alike = NODE_STATES.filter(
      (other) =>
        other !== state &&
        JSON.stringify(nodeLook(rules, other)) === JSON.stringify(look),
    );
    assert.deepEqual(
      alike,
      [],
      `${state} has the outline and label of ${alike}: ${look}`,
    );
  });
}

test("a node with several states shows the last one in the stylesheet", () => {
  const plain = withoutComments(STYLESHEET);
  const positions = NODE_STATES.map((state) =>
    plain.indexOf(`.nodestep-mermaid .${state} :is(.label-container`),
  );
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(
    positions,
    [...positions].sort((first, second) => first - second),
  );
  const rules = stylesheetRules(STYLESHEET);
  for (const state of NODE_STATES.slice(
    NODE_STATES.indexOf("tool-error") + 1,
  )) {
    assert.ok(
      "stroke-dasharray" in
        rules[`.nodestep-mermaid .${state} .label-container path`],
      state,
    );
  }
});

for (const state of ["paused", "stopped", "failed"]) {
  test(`a current node that is ${state} keeps text-colored labels`, () => {
    const rules = stylesheetRules(STYLESHEET);
    for (const selector of [".nodeLabel", ".label"]) {
      const label = rules[`.nodestep-mermaid .${state} ${selector}`];
      assert.equal(label.color, "var(--nodestep-color-text) !important");
      assert.equal(label.fill, "var(--nodestep-color-text) !important");
    }
    const plain = withoutComments(STYLESHEET);
    assert.ok(
      plain.indexOf(".nodestep-mermaid .current :is(.nodeLabel") <
        plain.indexOf(
          ".nodestep-mermaid :is(.paused, .stopped, .failed) :is(.nodeLabel",
        ),
    );
  });
}

function tokenLook(rules: Rules, kind: string): [string, string, string] {
  const rule = rules[`.nodestep-token-${kind}`];
  return [
    rule.color,
    rule["font-weight"] ?? "var(--nodestep-weight-regular)",
    rule["font-style"] ?? "normal",
  ];
}

test("each code token kind has its own look", () => {
  const rules = stylesheetRules(STYLESHEET);
  const looks = TOKEN_KINDS.map((kind) =>
    JSON.stringify(tokenLook(rules, kind)),
  );
  const shared = TOKEN_KINDS.filter(
    (_, index) => looks.filter((look) => look === looks[index]).length > 1,
  );
  assert.deepEqual(shared, []);
});

for (const kind of TOKEN_KINDS) {
  test(`the ${kind} code token uses a text color with text contrast on the code block`, () => {
    const rules = stylesheetRules(STYLESHEET);
    assert.equal(
      rules[".nodestep-code"].background,
      "var(--nodestep-color-page)",
    );
    const color = /^var\(--nodestep-color-([\w-]+)\)$/.exec(
      tokenLook(rules, kind)[0],
    );
    assert.ok(color);
    assert.ok(
      TEXT_PAIRS.some(
        ([foreground, background]) =>
          foreground === color[1] && background === "page",
      ),
    );
  });
}

test("the version property and the page heading follow the newest changelog release", () => {
  assert.ok(STYLESHEET.includes(`--nodestep-design-version: "${VERSION}";`));
  assert.ok(DEMO.includes(`<h1>Stylesheet ${VERSION}</h1>`));
});

test("themes follow the system and the data-theme attribute", () => {
  assert.match(STYLESHEET, /:root\s*\{[^}]*color-scheme:\s*light dark/);
  assert.match(
    STYLESHEET,
    /:root\[data-theme="light"\]\s*\{[^}]*color-scheme:\s*light;/,
  );
  assert.match(
    STYLESHEET,
    /:root\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark;/,
  );
});

test("every color token has a light and a dark value", () => {
  assert.deepEqual(
    [...declaredRoles(STYLESHEET)].sort(),
    Object.keys(colorTokens(STYLESHEET)).sort(),
  );
});

test("the color roles are one neutral scale, one accent and one danger", () => {
  assert.deepEqual(
    [...declaredRoles(STYLESHEET)].sort(),
    [...ALL_ROLES].sort(),
  );
});

for (const [name, source] of Object.entries(SOURCES)) {
  test(`every color in ${name} is neutral, accent or danger`, () => {
    const strays = colorLiterals(source).filter(
      (literal) => colorFamily(literal) === null,
    );
    assert.deepEqual(strays, [], `${name} has colors outside the palette`);
  });
}

test("each role takes its value from its family", () => {
  const tokens = colorTokens(STYLESHEET);
  const wrong = Object.entries(COLOR_ROLES).flatMap(([family, names]) =>
    names.flatMap((name) =>
      (
        [
          ["light", 0],
          ["dark", 1],
        ] as [string, number][]
      )
        .filter(([, index]) => colorFamily(tokens[name][index]) !== family)
        .map(([theme, index]) => `${name} (${theme} ${tokens[name][index]})`),
    ),
  );
  assert.deepEqual(wrong, []);
});

const BACKGROUNDS = ["page", "surface", "sunk"];
const WARM_TINT_HUES: [number, number] = [25.0, 45.0];
const WARM_TINT_CHROMA: [number, number] = [6, 16];

function luminance(color: string): number {
  return contrastRatio(color, "#000000");
}

test("the light backgrounds have a slight orange tint, darkest to lightest: sunk, page, surface", () => {
  const tokens = colorTokens(STYLESHEET);
  for (const name of BACKGROUNDS) {
    const [hue, chroma] = hueAndChroma(tokens[name][0]);
    assert.ok(
      WARM_TINT_HUES[0] <= hue && hue <= WARM_TINT_HUES[1],
      `${name}: hue ${hue.toFixed(1)}`,
    );
    assert.ok(
      WARM_TINT_CHROMA[0] <= chroma && chroma <= WARM_TINT_CHROMA[1],
      `${name}: chroma ${chroma}`,
    );
  }
  const [sunk, page, surface] = ["sunk", "page", "surface"].map((name) =>
    luminance(tokens[name][0]),
  );
  assert.ok(sunk < page && page < surface);
});

test("the dark backgrounds keep their values", () => {
  const tokens = colorTokens(STYLESHEET);
  assert.deepEqual(
    BACKGROUNDS.map((name) => tokens[name][1]),
    ["#141210", "#1c1a17", "#26231f"],
  );
});

test("the accent is one amber hue", () => {
  const tokens = colorTokens(STYLESHEET);
  const hues = COLOR_ROLES.accent.flatMap((name) =>
    tokens[name].map((value) => hueAndChroma(value)[0]),
  );
  assert.ok(
    Math.max(...hues) - Math.min(...hues) <= ACCENT_HUE_SPREAD,
    String(hues),
  );
});

test("components use only the tokens", () => {
  assert.deepEqual(literalsOutsideTokens(STYLESHEET), []);
  assert.deepEqual(colorLiterals(demoStyles(DEMO)), []);
  assert.deepEqual(namedColors(demoStyles(DEMO)), []);
});

test("every color token in use is declared", () => {
  const declared = declaredRoles(STYLESHEET);
  const used = new Set(
    [...(STYLESHEET + DEMO).matchAll(/var\(--nodestep-color-([\w-]+)/g)].map(
      (match) => match[1],
    ),
  );
  assert.deepEqual(
    [...used].filter((name) => !declared.has(name)),
    [],
  );
});

const THEMES: [string, number][] = [
  ["light", 0],
  ["dark", 1],
];

for (const [foreground, background] of TEXT_PAIRS) {
  test(`text contrast of ${foreground} on ${background}`, () => {
    const tokens = colorTokens(STYLESHEET);
    for (const [theme, index] of THEMES) {
      const ratio = contrastRatio(
        tokens[foreground][index],
        tokens[background][index],
      );
      assert.ok(
        ratio >= TEXT_CONTRAST,
        `${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}`,
      );
    }
  });
}

for (const [foreground, background] of INTERFACE_PAIRS) {
  test(`interface contrast of ${foreground} on ${background}`, () => {
    const tokens = colorTokens(STYLESHEET);
    for (const [theme, index] of THEMES) {
      const ratio = contrastRatio(
        tokens[foreground][index],
        tokens[background][index],
      );
      assert.ok(
        ratio >= INTERFACE_CONTRAST,
        `${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}`,
      );
    }
  });
}

for (const [foreground, background] of DARK_INTERFACE_PAIRS) {
  test(`dark interface contrast of the bright ${foreground} on ${background}`, () => {
    const tokens = colorTokens(STYLESHEET);
    const ratio = contrastRatio(tokens[foreground][1], tokens[background][1]);
    assert.ok(
      ratio >= INTERFACE_CONTRAST,
      `dark: ${foreground} on ${background} is ${ratio.toFixed(2)}`,
    );
  });
}

test("reduced motion turns off animation", () => {
  const block =
    /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(
      STYLESHEET,
    );
  assert.ok(block);
  assert.ok(block[1].includes("animation: none"));
});

test("the Mermaid output sets its own edge label colors", () => {
  const found = new Set(
    mermaidColorRules().map(([selector, name]) => `${selector} ${name}`),
  );
  for (const expected of [
    ".edgeLabel background-color",
    ".edgeLabel p background-color",
    ".edgeLabel rect fill",
    ".labelBkg background-color",
  ]) {
    assert.ok(found.has(expected), expected);
  }
});

test("the Mermaid frame overrides every edge label color of Mermaid", () => {
  const rules = stylesheetRules(STYLESHEET);
  const missing = mermaidColorRules()
    .filter(
      ([selector, name]) =>
        !(rules[`.nodestep-mermaid ${selector}`]?.[name] ?? "").endsWith(
          "!important",
        ),
    )
    .map(([selector, name]) => `${selector} ${name}`);
  assert.deepEqual(missing, []);
});

test("edge labels sit on the page color in one box", () => {
  const rules = stylesheetRules(STYLESHEET);
  const values = new Set(
    mermaidColorRules().map(
      ([selector, name]) => rules[`.nodestep-mermaid ${selector}`][name],
    ),
  );
  assert.deepEqual([...values], ["var(--nodestep-color-page) !important"]);
  assert.equal(
    rules[".nodestep-mermaid .edgeLabel rect"].opacity,
    "1 !important",
  );
});

test("badges in a stacked table keep their own width", () => {
  const narrow = /@media \(max-width: [^)]+\) \{([\s\S]*?)\n\}/.exec(
    STYLESHEET,
  );
  assert.ok(narrow);
  assert.ok(
    narrow[1].includes(
      "  .nodestep-table-stack .nodestep-badge {\n    justify-self: start;\n  }",
    ),
  );
  const table =
    /<table class="nodestep-table nodestep-table-stack">([\s\S]*?)<\/table>/.exec(
      DEMO,
    );
  assert.ok(table);
  assert.ok(table[1].includes('class="nodestep-badge nodestep-badge-'));
});

test("the focus ring is bright amber with a deep amber edge", () => {
  const rules = stylesheetRules(STYLESHEET);
  const tokens = rules[":root"];
  assert.equal(
    tokens["--nodestep-focus-ring"],
    "var(--nodestep-focus-width) solid var(--nodestep-color-accent)",
  );
  assert.equal(
    tokens["--nodestep-focus-edge"],
    "light-dark(var(--nodestep-color-accent-text), transparent)",
  );
  assert.equal(
    tokens["--nodestep-focus-gap"],
    "light-dark(var(--nodestep-color-surface), transparent)",
  );
  assert.equal(
    tokens["--nodestep-focus-halo"],
    "0 0 0 var(--nodestep-focus-offset) var(--nodestep-focus-gap), " +
      "0 0 0 calc(var(--nodestep-focus-offset) + var(--nodestep-focus-width) + 1px) " +
      "var(--nodestep-focus-edge)",
  );
  assert.deepEqual(rules[":focus-visible"], {
    outline: "var(--nodestep-focus-ring)",
    "outline-offset": "var(--nodestep-focus-offset)",
    "box-shadow": "var(--nodestep-focus-halo)",
  });
});

test("focusable components with their own shadow keep the focus edge", () => {
  const rules = stylesheetRules(STYLESHEET);
  const shadowed = Object.entries(rules)
    .filter(
      ([selector, found]) =>
        "box-shadow" in found &&
        !selector.startsWith(":") &&
        /nodestep-(?:choice|panel-item|input|select|textarea)\b/.test(
          selector,
        ) &&
        !selector.includes(":focus-visible"),
    )
    .map(([selector]) => selector);
  assert.ok(shadowed.length > 0);
  for (const selector of shadowed) {
    assert.ok(
      (rules[`${selector}:focus-visible`]?.["box-shadow"] ?? "").endsWith(
        "var(--nodestep-focus-halo)",
      ),
      selector,
    );
  }
});

for (const [foreground, background] of LIGHT_FOCUS_EDGE_PAIRS) {
  test(`light focus edge contrast of ${foreground} on ${background}`, () => {
    const tokens = colorTokens(STYLESHEET);
    const ratio = contrastRatio(tokens[foreground][0], tokens[background][0]);
    assert.ok(
      ratio >= INTERFACE_CONTRAST,
      `light: ${foreground} on ${background} is ${ratio.toFixed(2)}`,
    );
  });
}

test("accent shapes that carry meaning have a deep amber edge", () => {
  const rules = stylesheetRules(STYLESHEET);
  assert.equal(
    rules[".nodestep-timeline-model .nodestep-timeline-bar"].stroke,
    "var(--nodestep-color-accent-text)",
  );
  assert.equal(
    rules[".nodestep-badge-paused"]["--nodestep-badge-border"],
    "var(--nodestep-color-accent-text)",
  );
});

test("the Mermaid frame hides the source until Mermaid has drawn it", () => {
  assert.deepEqual(
    stylesheetRules(STYLESHEET)[".nodestep-mermaid:not([data-processed])"],
    { color: "transparent" },
  );
});

test("the Mermaid frame drops the shadow and font of the Mermaid theme", () => {
  const rules = stylesheetRules(STYLESHEET);
  for (const selector of [".label-container", ".label-container path"]) {
    assert.equal(
      rules[`.nodestep-mermaid .node ${selector}`].filter,
      "none !important",
    );
  }
  for (const selector of [".nodeLabel", ".node .label", ".edgeLabel"]) {
    assert.equal(
      rules[`.nodestep-mermaid ${selector}`]["font-family"],
      "var(--nodestep-font-sans) !important",
    );
  }
});

test("rules that hide the focus ring also hide the focus edge", () => {
  const hidden = Object.entries(stylesheetRules(STYLESHEET)).filter(
    ([, found]) => found.outline === "none",
  );
  assert.ok(hidden.length > 0);
  assert.deepEqual(
    hidden
      .filter(([, found]) => found["box-shadow"] !== "none")
      .map(([selector]) => selector),
    [],
  );
});

test("the page's own top bar stays at the top while the page scrolls", () => {
  const rules = stylesheetRules(STYLESHEET);
  for (const selector of [
    "body > .nodestep-topbar",
    ".nodestep-app > .nodestep-topbar",
  ]) {
    const topbar = rules[selector];
    assert.equal(topbar.position, "sticky", selector);
    assert.equal(topbar.top, "0", selector);
    assert.ok(
      Number(topbar["z-index"]) >
        Number(rules[".nodestep-panel-header"]["z-index"]),
      selector,
    );
  }
});

test("a top bar inside content or in an example stays in flow", () => {
  const sticky = Object.entries(stylesheetRules(STYLESHEET))
    .filter(([, found]) => found.position === "sticky")
    .map(([selector]) => selector)
    .filter((selector) => selector.includes("nodestep-topbar"));
  assert.deepEqual(sticky.sort(), [
    ".nodestep-app > .nodestep-topbar",
    "body > .nodestep-topbar",
  ]);
  assert.ok(!("position" in stylesheetRules(STYLESHEET)[".nodestep-topbar"]));
});

test("the brand mark replaces the ring before the brand", () => {
  const rules = stylesheetRules(STYLESHEET);
  assert.ok(!(".nodestep-brand::before" in rules));
  const mark = rules[".nodestep-brand-mark"];
  assert.equal(mark.width, "1.25rem");
  assert.equal(mark.height, "1.25rem");
  assert.equal(mark.flex, "none");
  assert.equal(mark.fill, "none");
  assert.ok(!(".nodestep-mark-accent-stroke" in rules));
  assert.deepEqual(rules[".nodestep-mark-accent-fill"], {
    fill: "var(--nodestep-color-accent)",
  });
});

test("the running badge is filled with the accent and paused is an outline", () => {
  const rules = stylesheetRules(STYLESHEET);
  assert.deepEqual(rules[".nodestep-badge-running"], {
    "--nodestep-badge-color": "var(--nodestep-color-on-accent)",
    "--nodestep-badge-wash": "var(--nodestep-color-accent)",
    "--nodestep-badge-border": "var(--nodestep-color-accent-text)",
  });
  assert.deepEqual(rules[".nodestep-badge-paused"], {
    "--nodestep-badge-color": "var(--nodestep-color-accent-text)",
    "--nodestep-badge-wash": "transparent",
    "--nodestep-badge-border": "var(--nodestep-color-accent-text)",
  });
});

test("the theme button shows a moon in light and a sun in dark", () => {
  const rules = stylesheetRules(STYLESHEET);
  assert.equal(rules[".nodestep-theme-sun"].display, "none");
  assert.equal(
    rules[':root[data-theme="dark"] .nodestep-theme-moon'].display,
    "none",
  );
  assert.equal(
    rules[':root[data-theme="dark"] .nodestep-theme-sun'].display,
    "block",
  );
  assert.deepEqual(
    stylesheetRules(mediaBlock("(prefers-color-scheme: dark)")),
    {
      ':root:not([data-theme="light"]) .nodestep-theme-moon': {
        display: "none",
      },
      ':root:not([data-theme="light"]) .nodestep-theme-sun': {
        display: "block",
      },
    },
  );
});

test("the theme button draws its icons in the text color", () => {
  const rules = stylesheetRules(STYLESHEET);
  const button = rules[".nodestep-theme-button"];
  assert.equal(button.color, "var(--nodestep-color-text-secondary)");
  assert.equal(button.width, "var(--nodestep-control-height)");
  assert.equal(button.height, "var(--nodestep-control-height)");
  assert.equal(
    rules[".nodestep-theme-button:hover"].color,
    "var(--nodestep-color-text)",
  );
  const icon = rules[".nodestep-theme-button svg"];
  assert.equal(icon.fill, "none");
  assert.equal(icon.stroke, "currentColor");
  assert.doesNotMatch(THEME_BUTTON, /\b(?:fill|stroke)="/);
});

test("the theme button keeps the shared focus ring", () => {
  const styled = Object.entries(stylesheetRules(STYLESHEET))
    .filter(
      ([selector, found]) =>
        selector.includes("nodestep-theme") &&
        ("outline" in found || "box-shadow" in found),
    )
    .map(([selector]) => selector);
  assert.deepEqual(styled, []);
});

test("the three-option theme switch is gone", () => {
  for (const [name, text] of Object.entries(SOURCES)) {
    for (const old of [
      "nodestep-theme-toggle",
      "nodestep-theme-option",
      '"system"',
    ]) {
      assert.ok(!text.includes(old), `${name}: ${old}`);
    }
  }
});
