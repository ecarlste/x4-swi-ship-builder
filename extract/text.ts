import { ExtractError } from "./errors.ts";
import { attr, children, type GameFiles } from "./gameFiles.ts";

/** The game's colour markup at the start of a string: `\033#AARRGGBB#` or `\033X`. */
const COLOUR_MARKUP = /^\\033(?:#[0-9A-Fa-f]{8}#|X)/;

/** A text that ends in a word of one letter coloured on its own, after other text: `… \033#AARRGGBB#G\033X`. */
const COLOURED_LAST_LETTER = /\S.*\s\\033#([0-9A-Fa-f]{8})#(\S)\\033X$/s;

/**
 * Resolves the game's text ids (`{page,id}`) to English, from the merged
 * `t/0001-l044.xml`. Follows the game's text rules: a `{page,id}` inside a
 * text is replaced by that text, an unescaped `(...)` is a comment and is
 * dropped, and `\(`, `\)`, `\{`, `\}` and `\\` stand for the character itself.
 * Colour markup (`\033#AARRGGBB#` starts a colour, `\033X` ends it) is dropped
 * and the text inside it kept, as a coloured letter can be all that tells two
 * wares apart.
 */
export class TextResolver {
  private readonly texts = new Map<string, string>();

  constructor(files: GameFiles) {
    const language = files.requireFile("t/0001-l044.xml");
    for (const page of children(language, "page")) {
      for (const t of children(page, "t")) {
        this.texts.set(`${attr(page, "id")},${attr(t, "id")}`, attr(t, "#text") ?? "");
      }
    }
  }

  /** The English text for a text id such as `{20101,1234}`. Fails if it doesn't resolve to any text. */
  resolve(ref: string, referencedBy: string): string {
    const text = this.expand(ref, referencedBy, 0).trim();
    if (text === "") throw new ExtractError(`${referencedBy}: text ${ref} is empty`);
    return text;
  }

  /**
   * The colour, as the game writes it (`AARRGGBB`), of a text's last word when
   * that word is one letter coloured on its own, as SWI marks a weapon colour
   * variant's R, G, O or B; null otherwise. A colour over the whole text isn't one.
   */
  lastLetterColour(ref: string, referencedBy: string): string | null {
    const text = this.expand(ref, referencedBy, 0, true).trim();
    return COLOURED_LAST_LETTER.exec(text)?.[1] ?? null;
  }

  /** Expands `text`; with `keepColour`, the colour markup is kept rather than dropped. */
  private expand(text: string, referencedBy: string, depth: number, keepColour = false): string {
    if (depth > 10) throw new ExtractError(`${referencedBy}: text references nest too deep at ${text}`);
    let out = "";
    let comment = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text[i]!;
      const colourMarkup = c === "\\" ? COLOUR_MARKUP.exec(text.slice(i)) : null;
      if (colourMarkup) {
        if (keepColour && comment === 0) out += colourMarkup[0];
        i += colourMarkup[0].length - 1;
      } else if (c === "\\" && i + 1 < text.length && "(){}\\".includes(text[i + 1]!)) {
        if (comment === 0) out += text[i + 1];
        i++;
      } else if (c === "(") {
        comment++;
      } else if (c === ")" && comment > 0) {
        comment--;
      } else if (comment > 0) {
        continue;
      } else if (c === "{") {
        const end = text.indexOf("}", i);
        const match = end < 0 ? null : /^\{\s*(\d+)\s*,\s*(\d+)\s*\}$/.exec(text.slice(i, end + 1));
        if (!match) {
          out += c;
          continue;
        }
        const value = this.texts.get(`${match[1]},${match[2]}`);
        if (value === undefined) {
          throw new ExtractError(`${referencedBy}: text {${match[1]},${match[2]}} isn't in t/0001-l044.xml`);
        }
        out += this.expand(value, referencedBy, depth + 1, keepColour);
        i = end;
      } else {
        out += c;
      }
    }
    return out;
  }
}
