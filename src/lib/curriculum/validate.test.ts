import { describe, expect, it } from "vitest";
import { course, rawCurriculum, requiredGroup } from "@/lib/test-utils";
import { loadCurriculum } from "./load";
import { allRegistryEntries, curricula, getCurriculum, majorsByCollege } from "./registry";

const codes = (raw: unknown) => loadCurriculum(raw).issues.map((i) => i.code);

describe("bundled curricula", () => {
  it("all load and validate without errors", () => {
    for (const entry of allRegistryEntries()) {
      const errors = entry.issues.filter((i) => i.severity === "error");
      expect(errors, `${entry.sourceId}: ${errors.map((e) => e.message).join("; ")}`).toEqual([]);
    }
    expect(curricula.length).toBeGreaterThanOrEqual(2);
  });

  it("match the official credit totals", () => {
    expect(getCurriculum("aau-bsc-software-engineering")?.totalCredits).toBe(124);
    expect(getCurriculum("aau-bsc-computer-science")?.totalCredits).toBe(123);
    expect(getCurriculum("aau-bsc-cybersecurity")?.totalCredits).toBe(123);
  });

  it("are structurally distinct majors", () => {
    const se = getCurriculum("aau-bsc-software-engineering")!;
    const cs = getCurriculum("aau-bsc-computer-science")!;
    const seOrg = se.courses.find((c) => c.code === "0102240")!;
    const csOrg = cs.courses.find((c) => c.code === "0102240")!;
    // Same course code, different prerequisite rules in each plan.
    expect(seOrg.prerequisite).toEqual({ kind: "course", code: "0107200" });
    expect(csOrg.prerequisite).toEqual({ kind: "course", code: "0104240" });
  });

  it("are grouped by college for the major picker", () => {
    const groups = majorsByCollege("aau");
    expect(groups[0].college).toBe("College of Engineering");
    expect(groups[0].majors.map((m) => m.majorName)).toEqual(
      expect.arrayContaining(["Software Engineering", "Computer Science", "Cybersecurity"]),
    );
  });
});

describe("validateCurriculum", () => {
  const valid = () =>
    rawCurriculum([requiredGroup("core", [course("A"), course("B", 3, "A"), course("C", 3, "A & B")])]);

  it("accepts a valid curriculum", () => {
    const result = loadCurriculum(valid());
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("reports missing required fields", () => {
    const raw = valid() as Record<string, unknown>;
    delete raw.majorName;
    const result = loadCurriculum(raw);
    expect(result.ok).toBe(false);
    expect(result.curriculum).toBeNull();
    expect(result.issues[0].code).toBe("invalid-field");
    expect(result.issues[0].message).toContain("majorName");
  });

  it("detects duplicate course codes", () => {
    expect(codes(rawCurriculum([requiredGroup("core", [course("A"), course("A")])]))).toContain("duplicate-course");
  });

  it("detects prerequisites that reference missing courses", () => {
    expect(codes(rawCurriculum([requiredGroup("core", [course("A", 3, "ZZZ")])]))).toContain("missing-prerequisite");
  });

  it("detects missing corequisites", () => {
    expect(codes(rawCurriculum([requiredGroup("core", [course("A", 3, undefined, { coreqs: ["LAB"] })])]))).toContain(
      "missing-corequisite",
    );
  });

  it("detects circular prerequisites", () => {
    const raw = rawCurriculum([requiredGroup("core", [course("A", 3, "C"), course("B", 3, "A"), course("C", 3, "B")])]);
    const result = loadCurriculum(raw);
    const cycle = result.issues.find((i) => i.code === "circular-prerequisite");
    expect(cycle?.message).toMatch(/A → .* → A|B → .* → B|C → .* → C/);
  });

  it("allows courses that are corequisites of each other", () => {
    const raw = rawCurriculum([
      requiredGroup("core", [course("LEC", 3, undefined, { coreqs: ["LAB"] }), course("LAB", 1, undefined, { coreqs: ["LEC"] })]),
    ]);
    expect(loadCurriculum(raw).ok).toBe(true);
  });

  it("detects invalid credit values", () => {
    expect(codes(rawCurriculum([requiredGroup("core", [course("A", 0)])]))).toContain("invalid-credits");
    expect(codes(rawCurriculum([requiredGroup("core", [course("A", -3)])]))).toContain("invalid-credits");
  });

  it("detects requirement totals that don't add up", () => {
    const group = { ...requiredGroup("core", [course("A"), course("B")]), minCredits: 9 };
    expect(codes(rawCurriculum([group]))).toContain("group-total-mismatch");
    expect(codes(rawCurriculum([requiredGroup("core", [course("A")])], { totalCredits: 120 }))).toContain(
      "total-mismatch",
    );
  });

  it("detects impossible elective rules", () => {
    const electives = {
      id: "electives",
      title: "Electives",
      category: "major" as const,
      rule: "choose" as const,
      minCredits: 9,
      courses: [course("E1"), course("E2")],
    };
    expect(codes(rawCurriculum([electives]))).toContain("impossible-elective");
  });

  it("detects credit thresholds that can never be reached", () => {
    expect(codes(rawCurriculum([requiredGroup("core", [course("A"), course("B", 3, "credits>=6")])]))).toContain(
      "impossible-credit-threshold",
    );
  });

  it("reports unreadable prerequisite rules", () => {
    expect(codes(rawCurriculum([requiredGroup("core", [course("A"), course("B", 3, "A &")])]))).toContain(
      "invalid-prerequisite",
    );
  });
});
