import { ExtractError } from "./errors.ts";
import type { XmlElement, XmlNode } from "./xml.ts";

/**
 * Applies a `<diff>` patch file to the merged file it targets and returns the
 * patched file. `source` names the patch in errors. The target is changed in
 * place.
 *
 * Operations are applied in order, as RFC 5261 and the game do: `add` (with
 * `pos` append, prepend, before or after, or `type="@name"` to add an
 * attribute), `replace` and `remove`, each on an element or an attribute.
 * An operation with an `if` is skipped when its condition is false.
 *
 * Hard failures, each naming the patch and selector: a selector outside the
 * supported forms (see {@link parseSelector}), a `sel` that matches nothing
 * (unless the operation has `silent="true"` or `silent="1"`), a `sel` that
 * matches more than one node, and an operation other than these.
 *
 * The one exception is a `remove` whose `sel` matches nothing and that
 * `options.allowUnmatchedRemoval` accepts (a known removal of a node the game
 * doesn't have): it is skipped, and its selector returned in
 * `unmatchedRemovals` for the report.
 */
export function applyPatch(
  target: XmlElement,
  diff: XmlElement,
  source: string,
  options: PatchOptions = {},
): PatchResult {
  const doc = new Document(target);
  const unmatchedRemovals: string[] = [];
  for (const op of diff.children) {
    if (typeof op === "string") continue;
    if (applyOperation(doc, op, source, options) === "unmatched removal") unmatchedRemovals.push(op.attrs.sel!);
  }
  return { file: doc.root, unmatchedRemovals };
}

export interface PatchOptions {
  /** Whether a `remove` with this `sel`, which matches nothing, is a known one to skip instead of failing. */
  allowUnmatchedRemoval?: (sel: string) => boolean;
}

export interface PatchResult {
  file: XmlElement;
  /** The `sel` of each allowed `remove` (without `silent`) that matched nothing. */
  unmatchedRemovals: string[];
}

function applyOperation(
  doc: Document,
  op: XmlElement,
  source: string,
  options: PatchOptions,
): "unmatched removal" | undefined {
  if (op.tag !== "add" && op.tag !== "replace" && op.tag !== "remove") {
    throw new ExtractError(`${source}: unsupported operation <${op.tag}>`);
  }
  const sel = op.attrs.sel;
  if (sel === undefined) throw new ExtractError(`${source}: <${op.tag}> has no sel`);
  const path = parseSelector(sel, source);
  if (op.attrs.if !== undefined && !evaluateCondition(doc, parseCondition(op.attrs.if, source))) return;

  const matches = select(doc, path);
  if (matches.length === 0) {
    if (op.attrs.silent === "true" || op.attrs.silent === "1") return;
    if (op.tag === "remove" && options.allowUnmatchedRemoval?.(sel)) return "unmatched removal";
    throw new ExtractError(`${source}: sel "${sel}" matches nothing`);
  }
  if (matches.length > 1) throw new ExtractError(`${source}: sel "${sel}" matches ${matches.length} nodes, not 1`);
  const { element, parent } = matches[0]!;
  const content = op.children.filter((c) => typeof c !== "string");

  if (path.attr !== undefined) {
    if (op.tag === "add") throw new ExtractError(`${source}: sel "${sel}" adds to an attribute`);
    if (op.tag === "replace") element.attrs[path.attr] = textOf(op);
    else delete element.attrs[path.attr];
    doc.changed(parent);
    return;
  }

  if (op.tag === "add") {
    const type = op.attrs.type;
    if (type !== undefined) {
      if (!/^@[\w.-]+$/.test(type)) throw new ExtractError(`${source}: unsupported add type "${type}"`);
      element.attrs[type.slice(1)] = textOf(op);
      doc.changed(parent);
      return;
    }
    const pos = op.attrs.pos ?? "append";
    if (pos === "append") element.children.push(...content);
    else if (pos === "prepend") element.children.unshift(...content);
    else if (pos === "before" || pos === "after") {
      if (parent === doc.node) throw new ExtractError(`${source}: sel "${sel}" adds a sibling to the root element`);
      const at = parent.children.indexOf(element);
      parent.children.splice(pos === "before" ? at : at + 1, 0, ...content);
      doc.changed(parent);
    } else throw new ExtractError(`${source}: unsupported add pos "${pos}"`);
    doc.changed(element);
    return;
  }

  const at = parent.children.indexOf(element);
  if (op.tag === "replace") {
    if (content.length !== 1 || op.children.length !== 1) {
      throw new ExtractError(`${source}: <replace sel="${sel}"> must hold exactly one element`);
    }
    parent.children.splice(at, 1, content[0]!);
  } else {
    if (parent === doc.node) throw new ExtractError(`${source}: sel "${sel}" removes the root element`);
    parent.children.splice(at, 1);
  }
  doc.changed(parent);
}

function textOf(element: XmlElement): string {
  return element.children.filter((c) => typeof c === "string").join("");
}

// --- Selectors -------------------------------------------------------------

/**
 * A `sel`: an absolute location path of element steps, optionally ending in
 * an attribute.
 */
interface Path {
  steps: Step[];
  attr?: string;
}
interface Step {
  /** `//`: the step looks in the context's descendants (and itself), not only its children. */
  descendant: boolean;
  name: string;
  predicates: Predicate[];
}
type Predicate = { kind: "position"; position: number } | { kind: "test"; test: Test };
/** A predicate's test: `a or b or ...`, each term maybe wrapped in `not(...)`. */
type Test = { not: boolean; comparison: Comparison }[];
/** `@a='v'`, `child='v'`, `child/@a='v'`, or a bare `child` / `@a` (exists). */
interface Comparison {
  path: Path;
  value?: string;
}
/** An `if`: an absolute path that must match something, or `not(path)` that must not. */
interface Condition {
  not: boolean;
  path: Path;
}

/**
 * Parses the XPath forms found in the survey of the files we read (#29):
 *
 * - absolute paths of element names, with `/` and `//` steps, e.g.
 *   `/wares/ware`, `//macros`, `//docking/dock`
 * - a final attribute step: `.../@name`
 * - predicates, chained: `[@id='x']` (single quotes), `[2]`,
 *   `[@id='a' or @id='b']`, `[not(child)]`, `[not(child/@a='x')]`
 *
 * Anything else (functions, wildcards, `text()`, `and`, unions, relative
 * paths, double-quoted literals) is unsupported and a hard failure.
 */
function parseSelector(sel: string, source: string): Path {
  return parseWith(sel, source, (p) => p.absolutePath());
}

function parseCondition(expr: string, source: string): Condition {
  return parseWith(expr, source, (p) => {
    if (p.peekName("not") && p.peek(1) === "(") {
      p.next();
      p.expect("(");
      const path = p.absolutePath();
      p.expect(")");
      return { not: true, path };
    }
    return { not: false, path: p.absolutePath() };
  });
}

function parseWith<T>(text: string, source: string, parse: (p: Parser) => T): T {
  const unsupported = () => new ExtractError(`${source}: unsupported selector "${text}"`);
  const tokens = tokenize(text);
  if (tokens === undefined) throw unsupported();
  const parser = new Parser(tokens, unsupported);
  const result = parse(parser);
  if (!parser.done()) throw unsupported();
  return result;
}

const TOKEN = /\s*(\/\/|\/|\[|\]|\(|\)|=|@|'[^']*'|\d+|[A-Za-z_][\w.-]*)/y;

function tokenize(text: string): string[] | undefined {
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < text.length) {
    if (/^\s*$/.test(text.slice(TOKEN.lastIndex))) break;
    const match = TOKEN.exec(text);
    if (!match) return undefined;
    tokens.push(match[1]!);
  }
  return tokens;
}

const NAME = /^[A-Za-z_][\w.-]*$/;

class Parser {
  private at = 0;
  private readonly tokens: string[];
  private readonly fail: () => Error;
  constructor(tokens: string[], fail: () => Error) {
    this.tokens = tokens;
    this.fail = fail;
  }

  done(): boolean {
    return this.at === this.tokens.length;
  }
  peek(ahead = 0): string | undefined {
    return this.tokens[this.at + ahead];
  }
  peekName(name: string): boolean {
    return this.peek() === name;
  }
  next(): string {
    const token = this.tokens[this.at++];
    if (token === undefined) throw this.fail();
    return token;
  }
  expect(token: string): void {
    if (this.next() !== token) throw this.fail();
  }
  name(): string {
    const token = this.next();
    if (!NAME.test(token)) throw this.fail();
    return token;
  }

  absolutePath(): Path {
    const first = this.peek();
    if (first !== "/" && first !== "//") throw this.fail();
    return this.steps(true);
  }

  /** Steps separated by `/` or `//`; `leadingSeparator` when the path starts with one. */
  private steps(leadingSeparator: boolean): Path {
    const steps: Step[] = [];
    let separator = leadingSeparator ? this.next() : "/";
    for (;;) {
      if (this.peek() === "@") {
        if (separator !== "/") throw this.fail();
        this.next();
        return { steps, attr: this.name() };
      }
      const name = this.name();
      const predicates: Predicate[] = [];
      while (this.peek() === "[") predicates.push(this.predicate());
      steps.push({ descendant: separator === "//", name, predicates });
      const after = this.peek();
      if (after !== "/" && after !== "//") return { steps };
      separator = this.next();
    }
  }

  private predicate(): Predicate {
    this.expect("[");
    let predicate: Predicate;
    if (/^\d+$/.test(this.peek() ?? "")) {
      const position = Number(this.next());
      if (position < 1) throw this.fail();
      predicate = { kind: "position", position };
    } else {
      const test: Test = [this.term()];
      while (this.peekName("or")) {
        this.next();
        test.push(this.term());
      }
      predicate = { kind: "test", test };
    }
    this.expect("]");
    return predicate;
  }

  private term(): Test[number] {
    if (this.peekName("not") && this.peek(1) === "(") {
      this.next();
      this.expect("(");
      const comparison = this.comparison();
      this.expect(")");
      return { not: true, comparison };
    }
    return { not: false, comparison: this.comparison() };
  }

  private comparison(): Comparison {
    const path = this.steps(false);
    if (this.peek() !== "=") return { path };
    this.next();
    const literal = this.next();
    if (!literal.startsWith("'")) throw this.fail();
    return { path, value: literal.slice(1, -1) };
  }
}

// --- Evaluation --------------------------------------------------------------

interface Match {
  element: XmlElement;
  parent: XmlElement;
}

/**
 * The patched file, under a document node, with an index of each element's
 * children by tag and id for the `[@id='x']` lookups most patches use.
 */
class Document {
  readonly node: XmlElement;
  private readonly idIndex = new WeakMap<XmlElement, Map<string, XmlElement[]>>();

  constructor(root: XmlElement) {
    this.node = { tag: "#document", attrs: {}, children: [root] };
  }

  get root(): XmlElement {
    return this.node.children[0] as XmlElement;
  }

  /** Call after changing an element's children, or one of its children's attributes. */
  changed(element: XmlElement): void {
    this.idIndex.delete(element);
  }

  /** `parent`'s child elements named `tag` whose `id` is `id`, in document order. */
  childrenById(parent: XmlElement, tag: string, id: string): XmlElement[] {
    let index = this.idIndex.get(parent);
    if (index === undefined) {
      index = new Map();
      for (const child of parent.children) {
        if (typeof child === "string" || child.attrs.id === undefined) continue;
        const key = `${child.tag}\u0000${child.attrs.id}`;
        const list = index.get(key);
        if (list) list.push(child);
        else index.set(key, [child]);
      }
      this.idIndex.set(parent, index);
    }
    return index.get(`${tag}\u0000${id}`) ?? [];
  }
}

/** The elements `path` selects from the document node (with an attribute step: those that have it). */
function select(doc: Document, path: Path): Match[] {
  const matches = selectFrom(doc, doc.node, path.steps);
  return path.attr === undefined ? matches : matches.filter((m) => Object.hasOwn(m.element.attrs, path.attr!));
}

function selectFrom(doc: Document, context: XmlElement, steps: Step[]): Match[] {
  let current: Match[] = [{ element: context, parent: context }];
  for (const step of steps) {
    current = current.flatMap(({ element }) =>
      (step.descendant ? selfAndDescendants(element) : [element]).flatMap((parent) => applyStep(doc, parent, step)),
    );
  }
  return current;
}

function applyStep(doc: Document, parent: XmlElement, step: Step): Match[] {
  let [first, ...rest] = step.predicates;
  let elements: XmlElement[];
  const id = first && idLookup(first);
  if (id !== undefined) elements = doc.childrenById(parent, step.name, id);
  else {
    elements = childElements(parent).filter((c) => c.tag === step.name);
    rest = step.predicates;
  }
  for (const predicate of rest) {
    elements =
      predicate.kind === "position"
        ? elements.slice(predicate.position - 1, predicate.position)
        : elements.filter((e) => predicate.test.some((term) => matchesComparison(doc, e, term.comparison) !== term.not));
  }
  return elements.map((element) => ({ element, parent }));
}

/** The id a `[@id='x']` predicate looks up, if it is one. */
function idLookup(predicate: Predicate): string | undefined {
  if (predicate.kind !== "test" || predicate.test.length !== 1) return undefined;
  const [{ not, comparison }] = predicate.test as [Test[number]];
  if (not || comparison.path.steps.length > 0 || comparison.path.attr !== "id") return undefined;
  return comparison.value;
}

function matchesComparison(doc: Document, element: XmlElement, { path, value }: Comparison): boolean {
  const targets = selectFrom(doc, element, path.steps).map((m) => m.element);
  if (path.attr !== undefined) {
    return targets.some((t) => Object.hasOwn(t.attrs, path.attr!) && (value === undefined || t.attrs[path.attr!] === value));
  }
  return targets.some((t) => value === undefined || stringValue(t) === value);
}

function evaluateCondition(doc: Document, { not, path }: Condition): boolean {
  return (select(doc, path).length > 0) !== not;
}

function childElements(element: XmlElement): XmlElement[] {
  return element.children.filter((c): c is XmlElement => typeof c !== "string");
}

function selfAndDescendants(element: XmlElement): XmlElement[] {
  const all: XmlElement[] = [];
  const walk = (node: XmlNode) => {
    if (typeof node === "string") return;
    all.push(node);
    node.children.forEach(walk);
  };
  walk(element);
  return all;
}

/** An element's XPath string value: all its text, in document order. */
function stringValue(element: XmlElement): string {
  return element.children.map((c) => (typeof c === "string" ? c : stringValue(c))).join("");
}
