import { readFileSync } from "node:fs";

export const ROOT = new URL("../", import.meta.url);

export function read(path: string): string {
  return readFileSync(new URL(path, ROOT), "utf8");
}

export const STYLESHEET = read("nodestep.css");
export const DEMO = read("demo.html");
const CHANGELOG = read("CHANGELOG.md");
export const PACKAGE = JSON.parse(read("package.json")) as PackageManifest;
export const VERSION = releaseVersion(CHANGELOG);
export const MERMAID_OUTPUT = read(
  "tests/fixtures/mermaid-12.0.0-edge-labels.svg",
);
export const SOURCES: Record<string, string> = {
  "nodestep.css": STYLESHEET,
  "demo.html": DEMO,
};

export interface PackageManifest {
  name: string;
  private: boolean;
  type: string;
  engines: Record<string, string>;
  scripts: Record<string, string>;
}

function releaseVersion(changelog: string): string {
  const match = /^## \[([^\]]+)\] - \d{4}-\d{2}-\d{2}$/m.exec(changelog);
  if (match === null) throw new Error("CHANGELOG.md has no release");
  return match[1];
}

export const TEXT_CONTRAST = 4.5;
export const INTERFACE_CONTRAST = 3.0;

export const COLOR_ROLES: Record<string, string[]> = {
  neutral: [
    "page",
    "surface",
    "sunk",
    "border",
    "border-strong",
    "text",
    "text-secondary",
    "text-muted",
    "on-accent",
    "on-danger",
  ],
  accent: ["accent", "accent-hover", "accent-text", "accent-wash"],
  danger: ["danger", "danger-hover", "danger-wash"],
};

export const ALL_ROLES = Object.values(COLOR_ROLES).flat();

const ACCENT_HUES: [number, number] = [30.0, 50.0];
export const ACCENT_HUE_SPREAD = 12.0;
const DANGER_HUES: [number, number][] = [
  [0.0, 12.0],
  [350.0, 360.0],
];
const WARM_HUES: [number, number][] = [
  [0.0, 60.0],
  [340.0, 360.0],
];
const NEUTRAL_CHROMA = 16;
const GRAY_CHROMA = 2;

const NAMED_COLORS = [
  "black",
  "silver",
  "gray",
  "white",
  "maroon",
  "red",
  "purple",
  "fuchsia",
  "green",
  "lime",
  "olive",
  "yellow",
  "navy",
  "blue",
  "teal",
  "aqua",
  "orange",
];

export const TEXT_PAIRS: [string, string][] = [
  ...["text", "text-secondary", "text-muted", "accent-text", "danger"].flatMap(
    (foreground) =>
      ["page", "surface", "sunk"].map((background): [string, string] => [
        foreground,
        background,
      ]),
  ),
  ["text", "accent-wash"],
  ["text-secondary", "accent-wash"],
  ["text-muted", "accent-wash"],
  ["accent-text", "accent-wash"],
  ["on-accent", "accent"],
  ["on-accent", "accent-hover"],
  ["on-danger", "danger"],
  ["on-danger", "danger-hover"],
  ["text", "danger-wash"],
  ["danger", "danger-wash"],
];

export const INTERFACE_PAIRS: [string, string][] = [
  "border-strong",
  "text-muted",
  "accent-text",
  "danger",
].flatMap((foreground) =>
  ["page", "surface", "sunk"].map((background): [string, string] => [
    foreground,
    background,
  ]),
);

export const DARK_INTERFACE_PAIRS: [string, string][] = [
  "page",
  "surface",
  "sunk",
].map((background) => ["accent", background]);

export const LIGHT_FOCUS_EDGE_PAIRS: [string, string][] = [
  "page",
  "surface",
  "sunk",
].map((background) => ["accent-text", background]);

export const TOKEN_KINDS = [
  "keyword",
  "function",
  "identifier",
  "string",
  "number",
  "comment",
  "operator",
];

export const NODE_STATES = [
  "visited",
  "tool-error",
  "current",
  "paused",
  "stopped",
  "failed",
];

export const THEME_BUTTON =
  '<button class="nodestep-theme-button" type="button" aria-label="Dark theme" aria-pressed="false">' +
  '<svg class="nodestep-theme-moon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
  '<path d="M7.14 2.06A6 6 0 1 0 13.94 8.87 5 5 0 0 1 7.14 2.06z"></path></svg>' +
  '<svg class="nodestep-theme-sun" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
  '<circle cx="8" cy="8" r="3"></circle>' +
  '<path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41' +
  'M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"></path></svg>' +
  "</button>";

export type Rules = Record<string, Record<string, string>>;

export function withoutComments(stylesheet: string): string {
  return stylesheet.replace(/\/\*[\s\S]*?\*\//g, "");
}

export function markupClasses(document: string): Set<string> {
  const plain = document
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, "");
  const classes = new Set<string>();
  for (const tag of plain.matchAll(/<[a-zA-Z][^>]*>/g)) {
    for (const attribute of tag[0].matchAll(
      /\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g,
    )) {
      for (const name of (attribute[1] ?? attribute[2] ?? "").split(/\s+/)) {
        if (name) classes.add(name);
      }
    }
  }
  return classes;
}

export function selectorClasses(stylesheet: string): Set<string> {
  const preludes = [
    ...withoutComments(stylesheet).matchAll(/([^{};]+)\{/g),
  ].map((match) => match[1]);
  const classes = new Set<string>();
  for (const prelude of preludes) {
    if (prelude.trim().startsWith("@")) continue;
    for (const match of prelude.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g))
      classes.add(match[1]);
  }
  return classes;
}

export function colorTokens(
  stylesheet: string,
): Record<string, [string, string]> {
  const pattern =
    /--nodestep-color-([\w-]+):\s*light-dark\(\s*(#[0-9a-fA-F]{6})\s*,\s*(#[0-9a-fA-F]{6})\s*\)/g;
  return Object.fromEntries(
    [...stylesheet.matchAll(pattern)].map((match) => [
      match[1],
      [match[2], match[3]],
    ]),
  );
}

export function declaredRoles(stylesheet: string): Set<string> {
  return new Set(
    [...stylesheet.matchAll(/--nodestep-color-([\w-]+):/g)].map(
      (match) => match[1],
    ),
  );
}

function relativeLuminance(color: string): number {
  const linear = [1, 3, 5].map((index) => {
    const channel = parseInt(color.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

export function colorLiterals(text: string): string[] {
  const pattern =
    /(?<![\w&/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?)\([^)]*\)/g;
  return [...text.matchAll(pattern)].map((match) => match[0]);
}

export function namedColors(text: string): string[] {
  const values = [...withoutComments(text).matchAll(/:\s*([^;{}]+);/g)].map(
    (match) => match[1],
  );
  const names = new RegExp(
    `(?<![\\w-])(?:${NAMED_COLORS.join("|")})(?![\\w-])`,
    "g",
  );
  return values.flatMap((value) =>
    [...value.matchAll(names)].map((match) => match[0]),
  );
}

export function demoStyles(document: string): string {
  const blocks = [...document.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(
    (match) => match[1],
  );
  const attributes = [...document.matchAll(/style="([^"]*)"/g)].map(
    (match) => `${match[1]};`,
  );
  return [...blocks, ...attributes].join("\n");
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function hueValue(low: number, high: number, hue: number): number {
  const turned = modulo(hue, 1);
  if (turned < 1 / 6) return low + (high - low) * turned * 6;
  if (turned < 0.5) return high;
  if (turned < 2 / 3) return low + (high - low) * (2 / 3 - turned) * 6;
  return low;
}

function hlsToRgb(
  hue: number,
  lightness: number,
  saturation: number,
): [number, number, number] {
  if (saturation === 0) return [lightness, lightness, lightness];
  const high =
    lightness <= 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const low = 2 * lightness - high;
  return [
    hueValue(low, high, hue + 1 / 3),
    hueValue(low, high, hue),
    hueValue(low, high, hue - 1 / 3),
  ];
}

function rgbHue(red: number, green: number, blue: number): number {
  const highest = Math.max(red, green, blue);
  const lowest = Math.min(red, green, blue);
  if (highest === lowest) return 0;
  const range = highest - lowest;
  const redPart = (highest - red) / range;
  const greenPart = (highest - green) / range;
  const bluePart = (highest - blue) / range;
  let hue: number;
  if (red === highest) hue = bluePart - greenPart;
  else if (green === highest) hue = 2 + redPart - bluePart;
  else hue = 4 + greenPart - redPart;
  return modulo(hue / 6, 1);
}

function channels(literal: string): [number, number, number] {
  if (literal.startsWith("#")) {
    let digits = literal.slice(1);
    if (digits.length === 3 || digits.length === 4)
      digits = [...digits].map((digit) => digit + digit).join("");
    return [0, 2, 4].map((index) =>
      parseInt(digits.slice(index, index + 2), 16),
    ) as [number, number, number];
  }
  const [name, argumentText] = literal.split(/\((.*)/s);
  const parts = argumentText
    .replace(/\)$/, "")
    .trim()
    .split(/[\s,/]+/);
  if (name.startsWith("hsl")) {
    const rgb = hlsToRgb(
      parseFloat(parts[0].replace(/deg$/, "")) / 360,
      parseFloat(parts[2]) / 100,
      parseFloat(parts[1]) / 100,
    );
    return rgb.map((value) => Math.round(value * 255)) as [
      number,
      number,
      number,
    ];
  }
  return parts
    .slice(0, 3)
    .map((part) =>
      Math.round(
        part.endsWith("%") ? parseFloat(part) * 2.55 : parseFloat(part),
      ),
    ) as [number, number, number];
}

export function hueAndChroma(literal: string): [number, number] {
  const [red, green, blue] = channels(literal);
  return [
    rgbHue(red / 255, green / 255, blue / 255) * 360,
    Math.max(red, green, blue) - Math.min(red, green, blue),
  ];
}

function within(hue: number, ranges: [number, number][]): boolean {
  return ranges.some(([low, high]) => low <= hue && hue <= high);
}

export function colorFamily(literal: string): string | null {
  const [hue, chroma] = hueAndChroma(literal);
  if (chroma <= GRAY_CHROMA) return "neutral";
  if (chroma <= NEUTRAL_CHROMA)
    return within(hue, WARM_HUES) ? "neutral" : null;
  if (within(hue, [ACCENT_HUES])) return "accent";
  if (within(hue, DANGER_HUES)) return "danger";
  return null;
}

function splitSelectors(prelude: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of prelude) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  return [...parts, current]
    .filter((part) => part.trim())
    .map((part) => part.trim().split(/\s+/).join(" "));
}

function expandedSelectors(prelude: string): string[] {
  const expanded: string[] = [];
  const pending = splitSelectors(prelude);
  while (pending.length > 0) {
    const selector = pending.shift() as string;
    const match = /:is\(([^()]*)\)/.exec(selector);
    if (match === null) {
      expanded.push(selector);
      continue;
    }
    for (const option of match[1].split(",")) {
      const joined =
        selector.slice(0, match.index) +
        option.trim() +
        selector.slice(match.index + match[0].length);
      pending.push(joined.trim().split(/\s+/).join(" "));
    }
  }
  return expanded;
}

function declarations(body: string): Record<string, string> {
  return Object.fromEntries(
    [...body.matchAll(/([\w-]+)\s*:\s*([^;]+);?/g)].map((match) => [
      match[1],
      match[2].trim().split(/\s+/).join(" "),
    ]),
  );
}

export function stylesheetRules(stylesheet: string): Rules {
  const rules: Rules = {};
  for (const match of withoutComments(stylesheet).matchAll(
    /([^{}]+)\{([^{}]*)\}/g,
  )) {
    for (const selector of expandedSelectors(match[1])) {
      rules[selector] = {
        ...(rules[selector] ?? {}),
        ...declarations(match[2]),
      };
    }
  }
  return rules;
}

export function mermaidColorRules(): [string, string][] {
  const style = /<style>([\s\S]*?)<\/style>/.exec(MERMAID_OUTPUT);
  if (style === null)
    throw new Error("the Mermaid fixture has no style element");
  return Object.entries(stylesheetRules(style[1])).flatMap(
    ([selector, found]) =>
      Object.keys(found)
        .filter((name) => name === "background-color" || name === "fill")
        .map((name): [string, string] => [
          selector.replace(/^#fixture /, ""),
          name,
        ]),
  );
}

export function literalsOutsideTokens(stylesheet: string): string[] {
  const remainder = withoutComments(stylesheet).replace(
    /--nodestep-(?:color|shadow)-[\w-]+:[^;]*;/g,
    "",
  );
  return [...colorLiterals(remainder), ...namedColors(remainder)];
}

export function mediaBlock(query: string): string {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(`@media ${escaped} \\{([\\s\\S]*?)\\n\\}`).exec(
    STYLESHEET,
  );
  if (block === null) throw new Error(`no @media ${query} block`);
  return block[1];
}

export function withoutWhitespaceBetweenTags(markup: string): string {
  return markup.trim().replace(/>\s+</g, "><");
}

export function unescapeHtml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export interface Element {
  tag: string;
  classes: string[];
  attributes: string;
  parent: Element | null;
}

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

export function elements(document: string): Element[] {
  const plain = document
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b([^>]*)>[\s\S]*?<\/\1>/g, "<$1$2></$1>");
  const found: Element[] = [];
  const open: Element[] = [];
  for (const match of plain.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*)>/g)) {
    const [, closing, name, attributes] = match;
    const tag = name.toLowerCase();
    if (closing) {
      const index = open.findLastIndex((element) => element.tag === tag);
      if (index >= 0) open.length = index;
      continue;
    }
    const value = /\sclass="([^"]*)"/.exec(attributes)?.[1] ?? "";
    const element: Element = {
      tag,
      classes: value.split(/\s+/).filter(Boolean),
      attributes,
      parent: open.at(-1) ?? null,
    };
    found.push(element);
    if (!VOID_TAGS.has(tag) && !attributes.trim().endsWith("/"))
      open.push(element);
  }
  return found;
}

export function markupBlocks(document: string): string[] {
  return [
    ...document.matchAll(
      /<details class="nodestep-details demo-markup"(?: open)?>\s*<summary>Markup<\/summary>([\s\S]*?)<\/details>/g,
    ),
  ].map((match) =>
    unescapeHtml(
      [
        ...match[1].matchAll(
          /<span class="nodestep-code-line"[^>]*>(.*?)<\/span>(?=<span class="nodestep-code-line"|<\/code>)/g,
        ),
      ]
        .map((line) => line[1])
        .join("\n"),
    ),
  );
}

export function demoSection(id: string): string {
  const section = new RegExp(
    `<section class="nodestep-section" id="${id}"[\\s\\S]*?(?=<section class="nodestep-section"|<\\/main>)`,
  ).exec(DEMO);
  if (section === null) throw new Error(`demo.html has no section ${id}`);
  return section[0];
}
