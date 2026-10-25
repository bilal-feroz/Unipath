import type { PrereqExpr } from "./types";

/**
 * Prerequisite rules are written in a small text format that mirrors the official plans:
 *
 *   0102221 & 0107200            both courses
 *   (0102221 & 0107200) | 0102270   either the pair or the single course
 *   credits>=60                  at least 60 completed credit hours
 *   [Department approval]        a condition UniPath shows but cannot verify
 *   ~0102220                     may be taken in the same semester
 *   0102220{C}                   minimum grade C (shown, not enforced)
 *
 * "&" binds tighter than "|".
 */

type Token =
  | { t: "(" | ")" | "&" | "|" }
  | { t: "course"; code: string; concurrent: boolean; minGrade?: string }
  | { t: "credits"; min: number }
  | { t: "note"; text: string };

export class PrereqParseError extends Error {}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "(" || ch === ")" || ch === "&" || ch === "|") {
      tokens.push({ t: ch });
      i++;
      continue;
    }
    if (ch === "[") {
      const end = input.indexOf("]", i);
      if (end === -1) throw new PrereqParseError(`Unclosed "[" in "${input}"`);
      const text = input.slice(i + 1, end).trim();
      if (!text) throw new PrereqParseError(`Empty note in "${input}"`);
      tokens.push({ t: "note", text });
      i = end + 1;
      continue;
    }
    const credits = /^credits\s*>=\s*(\d+)/i.exec(input.slice(i));
    if (credits) {
      tokens.push({ t: "credits", min: Number(credits[1]) });
      i += credits[0].length;
      continue;
    }
    const course = /^(~?)([A-Za-z0-9]+)(?:\{([A-Za-z+-]+)\})?/.exec(input.slice(i));
    if (course) {
      tokens.push({
        t: "course",
        code: course[2],
        concurrent: course[1] === "~",
        ...(course[3] ? { minGrade: course[3] } : {}),
      });
      i += course[0].length;
      continue;
    }
    throw new PrereqParseError(`Unexpected "${ch}" in "${input}"`);
  }
  return tokens;
}

export function parsePrereq(input: string | null | undefined): PrereqExpr | null {
  if (input == null || input.trim() === "") return null;
  const tokens = tokenize(input);
  let pos = 0;

  const peek = () => tokens[pos];

  function parseOr(): PrereqExpr {
    const items = [parseAnd()];
    while (peek()?.t === "|") {
      pos++;
      items.push(parseAnd());
    }
    return items.length === 1 ? items[0] : { kind: "any", items: flatten("any", items) };
  }

  function parseAnd(): PrereqExpr {
    const items = [parseAtom()];
    while (peek()?.t === "&") {
      pos++;
      items.push(parseAtom());
    }
    return items.length === 1 ? items[0] : { kind: "all", items: flatten("all", items) };
  }

  function parseAtom(): PrereqExpr {
    const tok = tokens[pos++];
    if (!tok) throw new PrereqParseError(`Unexpected end of "${input}"`);
    switch (tok.t) {
      case "(": {
        const inner = parseOr();
        if (tokens[pos++]?.t !== ")") throw new PrereqParseError(`Missing ")" in "${input}"`);
        return inner;
      }
      case "course":
        return {
          kind: "course",
          code: tok.code,
          ...(tok.concurrent ? { concurrent: true } : {}),
          ...(tok.minGrade ? { minGrade: tok.minGrade } : {}),
        };
      case "credits":
        return { kind: "credits", min: tok.min };
      case "note":
        return { kind: "note", text: tok.text };
      default:
        throw new PrereqParseError(`Unexpected "${tok.t}" in "${input}"`);
    }
  }

  const expr = parseOr();
  if (pos !== tokens.length) throw new PrereqParseError(`Unexpected "${tokens[pos].t}" in "${input}"`);
  return expr;
}

function flatten(kind: "all" | "any", items: PrereqExpr[]): PrereqExpr[] {
  return items.flatMap((item) => (item.kind === kind ? item.items : [item]));
}

/** Every course code referenced by a rule. */
export function referencedCourses(expr: PrereqExpr | null): string[] {
  if (!expr) return [];
  switch (expr.kind) {
    case "course":
      return [expr.code];
    case "all":
    case "any":
      return [...new Set(expr.items.flatMap(referencedCourses))];
    default:
      return [];
  }
}

/** The largest credit threshold in a rule (0 if none). */
export function creditThreshold(expr: PrereqExpr | null): number {
  if (!expr) return 0;
  switch (expr.kind) {
    case "credits":
      return expr.min;
    case "all":
    case "any":
      return Math.max(0, ...expr.items.map(creditThreshold));
    default:
      return 0;
  }
}

export interface PrereqContext {
  /** Courses finished before the semester being considered. */
  completed: ReadonlySet<string>;
  /** Courses taken in the same semester (only counts for rules marked concurrent). */
  sameSemester?: ReadonlySet<string>;
  /** Credit hours completed before the semester being considered. */
  earnedCredits: number;
}

export function isSatisfied(expr: PrereqExpr | null, ctx: PrereqContext): boolean {
  if (!expr) return true;
  switch (expr.kind) {
    case "course":
      return ctx.completed.has(expr.code) || (!!expr.concurrent && !!ctx.sameSemester?.has(expr.code));
    case "credits":
      return ctx.earnedCredits >= expr.min;
    case "note":
      return true;
    case "all":
      return expr.items.every((item) => isSatisfied(item, ctx));
    case "any":
      return expr.items.some((item) => isSatisfied(item, ctx));
  }
}

/** A checklist view of a rule, for explaining to students what is done and what is missing. */
export type PrereqCheck =
  | { kind: "course"; code: string; met: boolean; concurrent: boolean; minGrade?: string }
  | { kind: "credits"; min: number; have: number; met: boolean }
  | { kind: "note"; text: string; met: true }
  | { kind: "all" | "any"; met: boolean; items: PrereqCheck[] };

export function checkPrereq(expr: PrereqExpr, ctx: PrereqContext): PrereqCheck {
  switch (expr.kind) {
    case "course":
      return {
        kind: "course",
        code: expr.code,
        met: isSatisfied(expr, ctx),
        concurrent: !!expr.concurrent,
        ...(expr.minGrade ? { minGrade: expr.minGrade } : {}),
      };
    case "credits":
      return { kind: "credits", min: expr.min, have: ctx.earnedCredits, met: ctx.earnedCredits >= expr.min };
    case "note":
      return { kind: "note", text: expr.text, met: true };
    case "all":
    case "any": {
      const items = expr.items.map((item) => checkPrereq(item, ctx));
      const met = expr.kind === "all" ? items.every((i) => i.met) : items.some((i) => i.met);
      return { kind: expr.kind, met, items };
    }
  }
}

/** The unmet parts of a rule, simplified for a one-line explanation. */
export function unmetParts(expr: PrereqExpr | null, ctx: PrereqContext): PrereqExpr[] {
  if (!expr || isSatisfied(expr, ctx)) return [];
  switch (expr.kind) {
    case "all":
      return expr.items.flatMap((item) => unmetParts(item, ctx));
    default:
      return [expr];
  }
}

/** Notes (conditions UniPath cannot verify) attached to a rule. */
export function advisoryNotes(expr: PrereqExpr | null): string[] {
  if (!expr) return [];
  switch (expr.kind) {
    case "note":
      return [expr.text];
    case "all":
    case "any":
      return expr.items.flatMap(advisoryNotes);
    default:
      return [];
  }
}

/** Plain-text rendering, using course titles when available. */
export function describePrereq(
  expr: PrereqExpr | null,
  nameOf: (code: string) => string = (c) => c,
): string {
  if (!expr) return "None";
  const inner = (e: PrereqExpr, nested: boolean): string => {
    switch (e.kind) {
      case "course":
        return `${nameOf(e.code)}${e.minGrade ? ` (grade ${e.minGrade} or better)` : ""}${e.concurrent ? " (can be taken at the same time)" : ""}`;
      case "credits":
        return `${e.min} completed credit hours`;
      case "note":
        return e.text;
      case "all":
      case "any": {
        const joined = e.items.map((i) => inner(i, true)).join(e.kind === "all" ? " and " : " or ");
        return nested ? `(${joined})` : joined;
      }
    }
  };
  return inner(expr, false);
}
