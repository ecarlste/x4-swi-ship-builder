import { XMLParser, XMLValidator } from "fast-xml-parser";
import { ExtractError } from "./errors.ts";

/** An XML element with its children in document order. */
export interface XmlElement {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}
export type XmlNode = XmlElement | string;

/** An element as JSON: attributes become keys, child elements become arrays grouped by tag. */
export interface JsonElement {
  [key: string]: string | JsonElement[];
}

/** An element as JSON whose child elements keep document order, in `#children`. */
export interface OrderedJsonElement {
  [key: string]: string | Record<string, JsonElement | OrderedJsonElement>[];
}

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

type RawNode = { [tag: string]: RawNode[] } & { ":@"?: Record<string, string>; "#text"?: string };

/** Parses an XML document into its root element. `source` names the file in errors. */
export function parseXml(text: string, source: string): XmlElement {
  const body = text.replace(/^﻿/, "");
  const valid = XMLValidator.validate(body);
  if (valid !== true) {
    throw new ExtractError(`${source} isn't well-formed XML (line ${valid.err.line}): ${valid.err.msg}`);
  }
  const roots = (parser.parse(body) as RawNode[]).flatMap(toNodes).filter((n) => typeof n !== "string");
  if (roots.length !== 1) throw new ExtractError(`${source} has ${roots.length} root elements, not 1`);
  return roots[0]!;
}

/** Text is kept exactly as written, except whitespace-only text, which is only layout. */
function toNodes(raw: RawNode): XmlNode[] {
  if ("#text" in raw) {
    const text = String(raw["#text"]);
    return text.trim() === "" ? [] : [text];
  }
  const tag = Object.keys(raw).find((k) => k !== ":@")!;
  return [{ tag, attrs: raw[":@"] ?? {}, children: raw[tag]!.flatMap(toNodes) }];
}

/**
 * Converts an element to JSON. Attributes become keys, child elements become
 * arrays grouped by tag (in document order within each tag), and text becomes
 * `#text`. An attribute that shares its name with a child element's tag is
 * keyed `@name` instead, so neither is lost.
 */
export function toJson(element: XmlElement): JsonElement {
  const childTags = new Set(element.children.flatMap((c) => (typeof c === "string" ? [] : [c.tag])));
  const json: JsonElement = {};
  for (const [name, value] of Object.entries(element.attrs)) {
    json[childTags.has(name) ? `@${name}` : name] = value;
  }
  const text: string[] = [];
  for (const child of element.children) {
    if (typeof child === "string") text.push(child);
    else ((json[child.tag] as JsonElement[] | undefined) ?? (json[child.tag] = [])).push(toJson(child));
  }
  if (text.length > 0) json["#text"] = text.join("");
  return json;
}

/**
 * Converts a file's root element to JSON, as `{ <root tag>: ... }`. Ordinary
 * files use the grouped shape of {@link toJson}. A `<diff>` patch file keeps
 * order instead, because each operation applies to the result of the ones
 * before it: the root's operations, and the elements each operation holds, go
 * in a `#children` list of `{ <tag>: ... }` entries in document order. The
 * elements an operation holds use the grouped shape inside.
 */
export function fileToJson(root: XmlElement): Record<string, JsonElement | OrderedJsonElement> {
  if (root.tag !== "diff") return { [root.tag]: toJson(root) };
  return { diff: toOrderedJson(root, (operation) => toOrderedJson(operation, toJson)) };
}

function toOrderedJson(
  element: XmlElement,
  convertChild: (child: XmlElement) => JsonElement | OrderedJsonElement,
): OrderedJsonElement {
  const json: OrderedJsonElement = { ...element.attrs };
  const children = element.children.flatMap((c) => (typeof c === "string" ? [] : [{ [c.tag]: convertChild(c) }]));
  if (children.length > 0) json["#children"] = children;
  const text = element.children.filter((c) => typeof c === "string");
  if (text.length > 0) json["#text"] = text.join("");
  return json;
}
