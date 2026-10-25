import { describe, expect, it } from "vitest";
import {
  advisoryNotes,
  checkPrereq,
  creditThreshold,
  describePrereq,
  isSatisfied,
  parsePrereq,
  PrereqParseError,
  referencedCourses,
  unmetParts,
} from "./prereq";

const ctx = (completed: string[], earnedCredits = 0, sameSemester: string[] = []) => ({
  completed: new Set(completed),
  sameSemester: new Set(sameSemester),
  earnedCredits,
});

describe("parsePrereq", () => {
  it("returns null for empty rules", () => {
    expect(parsePrereq(null)).toBeNull();
    expect(parsePrereq("")).toBeNull();
    expect(parsePrereq("   ")).toBeNull();
  });

  it("parses a single course, including letter suffixes", () => {
    expect(parsePrereq("0102220")).toEqual({ kind: "course", code: "0102220" });
    expect(parsePrereq("0408101A")).toEqual({ kind: "course", code: "0408101A" });
  });

  it("parses AND lists and flattens them", () => {
    expect(parsePrereq("A & B & C")).toEqual({
      kind: "all",
      items: [
        { kind: "course", code: "A" },
        { kind: "course", code: "B" },
        { kind: "course", code: "C" },
      ],
    });
  });

  it("gives AND higher precedence than OR", () => {
    expect(parsePrereq("A & B | D")).toEqual({
      kind: "any",
      items: [
        { kind: "all", items: [{ kind: "course", code: "A" }, { kind: "course", code: "B" }] },
        { kind: "course", code: "D" },
      ],
    });
  });

  it("respects parentheses", () => {
    expect(parsePrereq("A & (B | C)")).toEqual({
      kind: "all",
      items: [
        { kind: "course", code: "A" },
        { kind: "any", items: [{ kind: "course", code: "B" }, { kind: "course", code: "C" }] },
      ],
    });
  });

  it("parses credit thresholds, notes, concurrency and minimum grades", () => {
    expect(parsePrereq("credits>=90 & [Department approval]")).toEqual({
      kind: "all",
      items: [
        { kind: "credits", min: 90 },
        { kind: "note", text: "Department approval" },
      ],
    });
    expect(parsePrereq("~0102220")).toEqual({ kind: "course", code: "0102220", concurrent: true });
    expect(parsePrereq("0102220{C}")).toEqual({ kind: "course", code: "0102220", minGrade: "C" });
  });

  it("rejects malformed rules", () => {
    expect(() => parsePrereq("A &")).toThrow(PrereqParseError);
    expect(() => parsePrereq("(A | B")).toThrow(PrereqParseError);
    expect(() => parsePrereq("A B")).toThrow(PrereqParseError);
    expect(() => parsePrereq("[unclosed")).toThrow(PrereqParseError);
    expect(() => parsePrereq("A # B")).toThrow(PrereqParseError);
  });
});

describe("isSatisfied", () => {
  it("handles AND conditions", () => {
    const rule = parsePrereq("A & B");
    expect(isSatisfied(rule, ctx(["A"]))).toBe(false);
    expect(isSatisfied(rule, ctx(["A", "B"]))).toBe(true);
  });

  it("handles OR conditions: (A AND B) OR D", () => {
    const rule = parsePrereq("(A & B) | D");
    expect(isSatisfied(rule, ctx([]))).toBe(false);
    expect(isSatisfied(rule, ctx(["A"]))).toBe(false);
    expect(isSatisfied(rule, ctx(["A", "B"]))).toBe(true);
    expect(isSatisfied(rule, ctx(["D"]))).toBe(true);
  });

  it("checks completed credit thresholds", () => {
    const rule = parsePrereq("credits>=60");
    expect(isSatisfied(rule, ctx([], 59))).toBe(false);
    expect(isSatisfied(rule, ctx([], 60))).toBe(true);
  });

  it("never blocks on advisory notes", () => {
    expect(isSatisfied(parsePrereq("[Department approval]"), ctx([]))).toBe(true);
  });

  it("only counts same-semester courses when the rule allows it", () => {
    expect(isSatisfied(parsePrereq("A"), ctx([], 0, ["A"]))).toBe(false);
    expect(isSatisfied(parsePrereq("~A"), ctx([], 0, ["A"]))).toBe(true);
  });
});

describe("explanations", () => {
  it("lists only the unmet parts", () => {
    const rule = parsePrereq("A & B & credits>=30");
    expect(unmetParts(rule, ctx(["A"], 40))).toEqual([{ kind: "course", code: "B" }]);
    expect(unmetParts(rule, ctx(["A", "B"], 40))).toEqual([]);
  });

  it("produces a checklist", () => {
    const check = checkPrereq(parsePrereq("A | B")!, ctx(["B"]));
    expect(check).toMatchObject({ kind: "any", met: true });
  });

  it("describes rules in plain language", () => {
    const names: Record<string, string> = { A: "Calculus I", B: "Linear Algebra" };
    expect(describePrereq(parsePrereq("A & (B | credits>=60)"), (c) => names[c] ?? c)).toBe(
      "Calculus I and (Linear Algebra or 60 completed credit hours)",
    );
    expect(describePrereq(null)).toBe("None");
  });

  it("collects references, thresholds and notes", () => {
    const rule = parsePrereq("A & (B | C) & credits>=75 & [Dept. approval]");
    expect(referencedCourses(rule).sort()).toEqual(["A", "B", "C"]);
    expect(creditThreshold(rule)).toBe(75);
    expect(advisoryNotes(rule)).toEqual(["Dept. approval"]);
  });
});
