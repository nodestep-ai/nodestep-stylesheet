type Listener = (event: FakeEvent) => void;

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
const RAW_TEXT_TAGS = new Set(["script", "style"]);
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decode(text: string): string {
  return text.replace(
    /&(?:#(\d+)|#x([0-9a-fA-F]+)|(\w+));/g,
    (entity, decimal: string, hex: string, name: string) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      return NAMED_ENTITIES[name] ?? entity;
    },
  );
}

export class FakeEvent {
  readonly type: string;
  readonly target: FakeElement;
  readonly bubbles: boolean;
  readonly key: string;
  readonly shiftKey: boolean;
  readonly isComposing: boolean;
  defaultPrevented = false;

  constructor(
    type: string,
    target: FakeElement,
    init: {
      bubbles?: boolean;
      key?: string;
      shiftKey?: boolean;
      isComposing?: boolean;
    } = {},
  ) {
    this.type = type;
    this.target = target;
    this.bubbles = init.bubbles ?? true;
    this.key = init.key ?? "";
    this.shiftKey = init.shiftKey ?? false;
    this.isComposing = init.isComposing ?? false;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

export class FakeText {
  #parent: FakeElement | null = null;
  data: string;

  constructor(data: string) {
    this.data = data;
  }

  get parent(): FakeElement | null {
    return this.#parent;
  }

  set parent(element: FakeElement | null) {
    this.#parent = element;
  }

  get textContent(): string {
    return this.data;
  }
}

type FakeNode = FakeElement | FakeText;

interface Compound {
  tag: string | null;
  id: string | null;
  classes: string[];
  attributes: [string, string | null][];
}

function compound(selector: string): Compound {
  const parsed: Compound = { tag: null, id: null, classes: [], attributes: [] };
  const pattern =
    /^([a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/y;
  let position = 0;
  const text = selector.trim();
  while (position < text.length) {
    pattern.lastIndex = position;
    const match = pattern.exec(text);
    if (match === null || match.index !== position)
      throw new Error(`the fake DOM cannot read the selector ${selector}`);
    if (match[1]) parsed.tag = match[1].toUpperCase();
    if (match[2]) parsed.id = match[2];
    if (match[3]) parsed.classes.push(match[3]);
    if (match[4]) parsed.attributes.push([match[4], match[5] ?? null]);
    position = pattern.lastIndex;
  }
  return parsed;
}

export class FakeElement {
  readonly tagName: string;
  readonly attributes = new Map<string, string>();
  value = "";
  readonly #owner: FakeDocument;
  #childNodes: FakeNode[] = [];
  #parent: FakeElement | null = null;
  readonly #listeners: [string, Listener, boolean][] = [];

  constructor(owner: FakeDocument, tag: string) {
    this.#owner = owner;
    this.tagName = tag.toUpperCase();
  }

  get childNodes(): FakeNode[] {
    return this.#childNodes;
  }

  set childNodes(nodes: FakeNode[]) {
    this.#childNodes = nodes;
  }

  get parent(): FakeElement | null {
    return this.#parent;
  }

  set parent(element: FakeElement | null) {
    this.#parent = element;
  }

  get classList() {
    const names = () => (this.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
    return {
      contains: (name: string) => names().includes(name),
      add: (...added: string[]) =>
        this.setAttribute("class", [...new Set([...names(), ...added])].join(" ")),
      remove: (...removed: string[]) =>
        this.setAttribute(
          "class",
          names()
            .filter((name) => !removed.includes(name))
            .join(" "),
        ),
    };
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  toggleAttribute(name: string, force: boolean): boolean {
    if (force) this.attributes.set(name, "");
    else this.attributes.delete(name);
    return force;
  }

  get id(): string {
    return this.getAttribute("id") ?? "";
  }

  get hash(): string {
    const href = this.getAttribute("href") ?? "";
    return href.startsWith("#") ? href : "";
  }

  visible = true;

  checkVisibility(): boolean {
    return this.visible;
  }

  focus(): void {
    this.#owner.activeElement = this;
  }

  get open(): boolean {
    return this.attributes.has("open");
  }

  set open(value: boolean) {
    if (value === this.open) return;
    if (value) this.attributes.set("open", "");
    else this.attributes.delete("open");
  }

  get hidden(): boolean {
    return this.attributes.has("hidden");
  }

  get children(): FakeElement[] {
    return this.childNodes.filter((node) => node instanceof FakeElement);
  }

  get parentElement(): FakeElement | null {
    return this.parent;
  }

  get textContent(): string {
    return this.childNodes.map((node) => node.textContent).join("");
  }

  set textContent(text: string) {
    this.replaceChildren(new FakeText(String(text)));
  }

  append(...nodes: FakeNode[]): void {
    for (const node of nodes) {
      node.parent?.remove(node);
      node.parent = this;
      this.childNodes.push(node);
    }
  }

  replaceChildren(...nodes: FakeNode[]): void {
    for (const node of this.childNodes) node.parent = null;
    this.childNodes = [];
    this.append(...nodes);
  }

  remove(node: FakeNode): void {
    this.childNodes = this.childNodes.filter((child) => child !== node);
    node.parent = null;
  }

  matchesCompound(part: string): boolean {
    const wanted = compound(part);
    return (
      (wanted.tag === null || wanted.tag === this.tagName) &&
      (wanted.id === null || wanted.id === this.getAttribute("id")) &&
      wanted.classes.every((name) => this.classList.contains(name)) &&
      wanted.attributes.every(([name, value]) =>
        value === null ? this.hasAttribute(name) : this.getAttribute(name) === value,
      )
    );
  }

  matches(selector: string): boolean {
    return selector.split(",").some((part) => {
      const [last, ...ancestors] = part.trim().split(/\s+/).reverse();
      if (!this.matchesCompound(last)) return false;
      let node = this.parent;
      for (const ancestor of ancestors) {
        while (node && !node.matchesCompound(ancestor)) node = node.parent;
        if (!node) return false;
        node = node.parent;
      }
      return true;
    });
  }

  closest(selector: string): FakeElement | null {
    for (let node: FakeElement | null = this; node; node = node.parent) {
      if (node.matches(selector)) return node;
    }
    return null;
  }

  descendants(): FakeElement[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.descendants().filter((element) => element.matches(selector));
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  scrollTop = 0;
  scrollHeight = 0;
  clientHeight = 0;

  scrollIntoView(options: unknown): void {
    this.#owner.scrolled.push([this, options]);
  }

  getBoundingClientRect(): { top: number; height: number } {
    return this.#owner.boxes.get(this) ?? { top: 0, height: 0 };
  }

  addEventListener(type: string, listener: Listener, capture = false): void {
    this.#listeners.push([type, listener, capture]);
  }

  listenersFor(type: string, capture: boolean): Listener[] {
    return this.#listeners
      .filter(([name, , phase]) => name === type && phase === capture)
      .map(([, listener]) => listener);
  }
}

export class FakeDocument {
  readonly scrolled: [FakeElement, unknown][] = [];
  readonly boxes = new Map<FakeElement, { top: number; height: number }>();
  activeElement: FakeElement | null = null;
  readyState = "loading";
  readonly #documentElement: FakeElement;
  readonly #listeners: [string, Listener, boolean][] = [];

  constructor() {
    this.#documentElement = new FakeElement(this, "html");
  }

  get documentElement(): FakeElement {
    return this.#documentElement;
  }

  createElement(tag: string): FakeElement {
    return new FakeElement(this, tag);
  }

  createTextNode(text: string): FakeText {
    return new FakeText(text);
  }

  querySelector(selector: string): FakeElement | null {
    return this.documentElement.matches(selector)
      ? this.documentElement
      : this.documentElement.querySelector(selector);
  }

  querySelectorAll(selector: string): FakeElement[] {
    return [
      ...(this.documentElement.matches(selector) ? [this.documentElement] : []),
      ...this.documentElement.querySelectorAll(selector),
    ];
  }

  getElementById(id: string): FakeElement | null {
    return this.querySelector(`#${id}`);
  }

  addEventListener(
    type: string,
    listener: Listener,
    options: boolean | { capture?: boolean } = false,
  ): void {
    const capture = typeof options === "boolean" ? options : Boolean(options.capture);
    this.#listeners.push([type, listener, capture]);
  }

  dispatch(event: FakeEvent): FakeEvent {
    const path: FakeElement[] = [];
    for (let node: FakeElement | null = event.target; node; node = node.parent) path.push(node);
    const own = (capture: boolean) =>
      this.#listeners
        .filter(([name, , phase]) => name === event.type && phase === capture)
        .map(([, listener]) => listener);
    for (const listener of own(true)) listener(event);
    for (const element of [...path].reverse())
      for (const listener of element.listenersFor(event.type, true)) listener(event);
    for (const listener of event.target.listenersFor(event.type, false)) listener(event);
    if (event.bubbles) {
      for (const element of path.slice(1))
        for (const listener of element.listenersFor(event.type, false)) listener(event);
      for (const listener of own(false)) listener(event);
    }
    return event;
  }
}

export function parse(markup: string): FakeDocument {
  const document = new FakeDocument();
  const body = document.createElement("body");
  document.documentElement.append(body);
  const open: FakeElement[] = [body];
  const pattern =
    /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/gi;
  let position = 0;
  const text = (end: number) => {
    if (end > position)
      open.at(-1)?.append(new FakeText(decode(markup.slice(position, end))));
  };
  for (let match = pattern.exec(markup); match; match = pattern.exec(markup)) {
    text(match.index);
    position = pattern.lastIndex;
    const [whole, closing, name, attributes, selfClosing] = match;
    if (whole.startsWith("<!")) continue;
    if (closing) {
      const tag = closing.toUpperCase();
      const index = open.findLastIndex((element) => element.tagName === tag);
      if (index > 0) open.length = index;
      continue;
    }
    const element = document.createElement(name);
    for (const attribute of attributes.matchAll(
      /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g,
    )) {
      element.setAttribute(
        attribute[1].toLowerCase(),
        decode(attribute[2] ?? attribute[3] ?? attribute[4] ?? ""),
      );
    }
    open.at(-1)?.append(element);
    const tag = name.toLowerCase();
    if (RAW_TEXT_TAGS.has(tag)) {
      const end = markup.toLowerCase().indexOf(`</${tag}`, position);
      element.append(new FakeText(markup.slice(position, end)));
      position = end;
      pattern.lastIndex = end;
      continue;
    }
    if (!VOID_TAGS.has(tag) && !selfClosing) open.push(element);
    if (tag === "input") element.value = element.getAttribute("value") ?? "";
  }
  text(markup.length);
  return document;
}
