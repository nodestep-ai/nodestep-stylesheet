import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { read } from "./support.ts";

const SCRIPT = read("nodestep-theme.js");

type Listener = () => void;

class FakeButton {
  readonly attributes = new Map<string, string>();
  readonly listeners: Listener[] = [];

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: Listener): void {
    if (type === "click") this.listeners.push(listener);
  }

  click(): void {
    for (const listener of this.listeners) listener();
  }
}

class FakeStorage {
  readonly items = new Map<string, string>();
  readonly calls: string[] = [];

  constructor(initial: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initial))
      this.items.set(key, value);
  }

  getItem(key: string): string | null {
    this.calls.push(`get ${key}`);
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.calls.push(`set ${key}`);
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.calls.push(`remove ${key}`);
    this.items.delete(key);
  }
}

class FakeMedia {
  matches: boolean;
  readonly listeners: Listener[] = [];

  constructor(matches: boolean) {
    this.matches = matches;
  }

  addEventListener(type: string, listener: Listener): void {
    if (type === "change") this.listeners.push(listener);
  }

  change(matches: boolean): void {
    this.matches = matches;
    for (const listener of this.listeners) listener();
  }
}

class FakeNode {
  readonly classes: string[];
  readonly children: FakeNode[] = [];
  readonly parent: FakeNode | null;
  focused = false;

  constructor(classes: string, parent: FakeNode | null = null) {
    this.classes = classes.split(" ").filter(Boolean);
    this.parent = parent;
    parent?.children.push(this);
  }

  closest(selector: string): FakeNode | null {
    for (let node: FakeNode | null = this; node; node = node.parent)
      if (node.classes.includes(selector.slice(1))) return node;
    return null;
  }

  querySelector(selector: string): FakeNode | null {
    for (const child of this.children) {
      if (child.classes.includes(selector.slice(1))) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  focus(): void {
    this.focused = true;
  }
}

interface FakeEvent {
  type: string;
  target: FakeNode;
  defaultPrevented: boolean;
  preventDefault: () => void;
}

interface Page {
  root: { dataset: Record<string, string> };
  buttons: FakeButton[];
  storage: FakeStorage;
  media: FakeMedia;
  ready: () => void;
  fire: (type: string) => void;
  dispatch: (type: string, target: FakeNode) => FakeEvent;
  queries: string[];
}

function searchField(): { form: FakeNode; input: FakeNode; clear: FakeNode; icon: FakeNode } {
  const form = new FakeNode("nodestep-search");
  const icon = new FakeNode("nodestep-search-icon", form);
  const input = new FakeNode("nodestep-search-input", form);
  const clear = new FakeNode("nodestep-search-clear", form);
  return { form, input, clear, icon };
}

function loadPage({
  stored = {},
  systemDark = false,
  buttons = 1,
  readyState = "loading",
  storage,
}: {
  stored?: Record<string, string>;
  systemDark?: boolean;
  buttons?: number;
  readyState?: string;
  storage?: () => unknown;
} = {}): Page {
  const root = { dataset: {} as Record<string, string> };
  const found = Array.from({ length: buttons }, () => new FakeButton());
  const store = new FakeStorage(stored);
  const media = new FakeMedia(systemDark);
  const queries: string[] = [];
  const waiting: Listener[] = [];
  const windowListeners: [string, Listener][] = [];
  const documentListeners: [string, (event: FakeEvent) => void][] = [];
  const document = {
    documentElement: root,
    readyState,
    querySelectorAll(selector: string) {
      queries.push(selector);
      return selector === ".nodestep-theme-button" ? found : [];
    },
    addEventListener(type: string, listener: (event: FakeEvent) => void) {
      if (type === "DOMContentLoaded") waiting.push(listener as Listener);
      else documentListeners.push([type, listener]);
    },
  };
  const context: Record<string, unknown> = {
    document,
    matchMedia(query: string) {
      assert.equal(query, "(prefers-color-scheme: dark)");
      return media;
    },
    addEventListener(type: string, listener: Listener) {
      windowListeners.push([type, listener]);
    },
  };
  Object.defineProperty(context, "localStorage", {
    get: storage ?? (() => store),
  });
  runInNewContext(SCRIPT, context);
  return {
    root,
    buttons: found,
    storage: store,
    media,
    queries,
    ready: () => {
      for (const listener of waiting) listener();
    },
    fire: (type) => {
      for (const [name, listener] of windowListeners)
        if (name === type) listener();
    },
    dispatch: (type, target) => {
      const event: FakeEvent = {
        type,
        target,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
      };
      for (const [name, listener] of documentListeners)
        if (name === type) listener(event);
      return event;
    },
  };
}

const pressed = (page: Page): (string | undefined)[] =>
  page.buttons.map((button) => button.attributes.get("aria-pressed"));

test("a stored light or dark choice is applied before the page draws", () => {
  for (const theme of ["light", "dark"]) {
    const page = loadPage({ stored: { "nodestep-theme": theme } });
    assert.equal(page.root.dataset.theme, theme);
    assert.deepEqual(page.queries, []);
  }
});

test("other stored values are ignored, so the page follows the system", () => {
  for (const value of ["sepia", "system", ""]) {
    const page = loadPage({ stored: { "nodestep-theme": value } });
    assert.equal(page.root.dataset.theme, undefined);
  }
});

test("blocked storage leaves the page on the system theme without an error", () => {
  const page = loadPage({
    storage: () => {
      throw new Error("SecurityError");
    },
  });
  assert.equal(page.root.dataset.theme, undefined);
  page.ready();
  page.buttons[0].click();
  assert.equal(page.root.dataset.theme, "dark");
  assert.deepEqual(pressed(page), ["true"]);
});

test("once the page is parsed every theme button says whether the dark theme is on", () => {
  const page = loadPage({ systemDark: true, buttons: 2 });
  assert.deepEqual(pressed(page), [undefined, undefined]);
  page.ready();
  assert.deepEqual(pressed(page), ["true", "true"]);
});

test("the buttons follow the system until a choice is stored", () => {
  const page = loadPage();
  page.ready();
  assert.deepEqual(pressed(page), ["false"]);
  page.media.change(true);
  assert.deepEqual(pressed(page), ["true"]);
  page.media.change(false);
  assert.deepEqual(pressed(page), ["false"]);
  assert.equal(page.storage.items.size, 0);
});

test("a click switches to the other theme, stores light or dark and updates every button", () => {
  const page = loadPage({ buttons: 2 });
  page.ready();
  page.buttons[1].click();
  assert.equal(page.root.dataset.theme, "dark");
  assert.equal(page.storage.items.get("nodestep-theme"), "dark");
  assert.deepEqual(pressed(page), ["true", "true"]);
  page.buttons[0].click();
  assert.equal(page.root.dataset.theme, "light");
  assert.equal(page.storage.items.get("nodestep-theme"), "light");
  assert.deepEqual(pressed(page), ["false", "false"]);
  page.media.change(true);
  assert.deepEqual(pressed(page), ["false", "false"]);
  assert.deepEqual([...page.storage.items.keys()], ["nodestep-theme"]);
  assert.ok(!page.storage.calls.some((call) => call.startsWith("remove")));
});

test("a click in the dark system theme stores light", () => {
  const page = loadPage({ systemDark: true });
  page.ready();
  page.buttons[0].click();
  assert.equal(page.root.dataset.theme, "light");
  assert.equal(page.storage.items.get("nodestep-theme"), "light");
});

test("a full storage does not stop the switch", () => {
  const page = loadPage();
  page.storage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  page.ready();
  page.buttons[0].click();
  assert.equal(page.root.dataset.theme, "dark");
  assert.deepEqual(pressed(page), ["true"]);
});

test("loaded after the page is parsed, the script wires the buttons at once", () => {
  const page = loadPage({
    readyState: "interactive",
    stored: { "nodestep-theme": "dark" },
  });
  assert.deepEqual(pressed(page), ["true"]);
  page.buttons[0].click();
  assert.equal(page.root.dataset.theme, "light");
});

test("a page shown again from the back and forward cache takes the stored choice", () => {
  const page = loadPage({ stored: { "nodestep-theme": "light" } });
  page.ready();
  page.storage.items.set("nodestep-theme", "dark");
  page.fire("pageshow");
  assert.equal(page.root.dataset.theme, "dark");
  assert.deepEqual(pressed(page), ["true"]);
  page.storage.items.delete("nodestep-theme");
  page.fire("pageshow");
  assert.equal(page.root.dataset.theme, undefined);
  assert.deepEqual(pressed(page), ["false"]);
});

test("a choice made in another tab is applied at once", () => {
  const page = loadPage({ systemDark: true });
  page.ready();
  page.storage.items.set("nodestep-theme", "light");
  page.fire("storage");
  assert.equal(page.root.dataset.theme, "light");
  assert.deepEqual(pressed(page), ["false"]);
  page.storage.items.set("nodestep-theme", "sepia");
  page.fire("storage");
  assert.equal(page.root.dataset.theme, undefined);
  assert.deepEqual(pressed(page), ["true"]);
});

test("with blocked storage a page shown again keeps the choice made on it", () => {
  const page = loadPage({
    storage: () => {
      throw new Error("SecurityError");
    },
  });
  page.ready();
  page.buttons[0].click();
  page.fire("pageshow");
  page.fire("storage");
  assert.equal(page.root.dataset.theme, "dark");
  assert.deepEqual(pressed(page), ["true"]);
});

test("pressing the clear button of a search field leaves the focus in the field, so a folded field stays open", () => {
  const page = loadPage();
  const { input, clear, icon } = searchField();
  const drawing = new FakeNode("", new FakeNode("", clear));
  assert.ok(page.dispatch("mousedown", clear).defaultPrevented);
  assert.ok(page.dispatch("mousedown", drawing).defaultPrevented);
  for (const other of [input, icon, new FakeNode("nodestep-theme-button")])
    assert.ok(!page.dispatch("mousedown", other).defaultPrevented);
});

test("a search field that its clear button resets takes the focus back", () => {
  const page = loadPage();
  const { form, input } = searchField();
  const reset = page.dispatch("reset", form);
  assert.ok(input.focused, "the field has the focus");
  assert.ok(!reset.defaultPrevented, "the field is still emptied");
  const other = new FakeNode("nodestep-stack");
  const field = new FakeNode("nodestep-input", other);
  page.dispatch("reset", other);
  assert.ok(!field.focused, "other forms keep their focus");
});

test("the script runs under script-src 'self': no eval, no inline styles, no markup strings", () => {
  for (const pattern of [
    /\beval\(/,
    /new Function/,
    /\.style\b/,
    /innerHTML|outerHTML|insertAdjacentHTML/,
    /setAttribute\("style"/,
  ]) {
    assert.doesNotMatch(SCRIPT, pattern);
  }
});
