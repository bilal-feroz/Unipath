import { describe, expect, it } from "vitest";
import { isSatisfied } from "@/lib/curriculum/prereq";
import { getCurriculum } from "@/lib/curriculum/registry";
import { course, indexOf, rawCurriculum, requiredGroup } from "@/lib/test-utils";
import { courseImpact, keyCourses, nextStepInsight } from "./insights";
import { creditsOf, indexCurriculum, type CurriculumIndex } from "./model";
import { evaluateProgress } from "./progress";
import { buildRoadmap, type PlanSettings, type Roadmap } from "./scheduler";
import { simulateScenario } from "./simulate";
import { courseStates, unlockedBy } from "./status";
import { resolveTargets } from "./targets";
import { defaultStartTerm, nextTerm, termLabel, termSequence } from "./terms";

const settings = (overrides: Partial<PlanSettings> = {}): PlanSettings => ({
  maxCredits: 18,
  includeSummer: false,
  summerMaxCredits: 6,
  startTerm: { season: "spring", year: 2027 },
  ...overrides,
});

const se = () => indexCurriculum(getCurriculum("aau-bsc-software-engineering")!);
const cs = () => indexCurriculum(getCurriculum("aau-bsc-computer-science")!);
const cyber = () => indexCurriculum(getCurriculum("aau-bsc-cybersecurity")!);

/** Replays a roadmap and checks every academic rule. */
function expectValidRoadmap(index: CurriculumIndex, completed: string[], roadmap: Roadmap, s: PlanSettings) {
  const done = new Set(completed);
  let earned = creditsOf(index, done);
  const slotCredits = new Map<string, number>();
  const taken = new Set<string>();
  for (const sem of roadmap.semesters) {
    const cap = sem.isSummer ? s.summerMaxCredits : s.maxCredits;
    expect(sem.credits, `${sem.label} over credit cap`).toBeLessThanOrEqual(cap);
    expect(sem.credits).toBe(sem.items.reduce((sum, i) => sum + i.item.credits, 0));
    const ctx = { completed: done, earnedCredits: earned };
    const passed: string[] = [];
    for (const { item, failed, retake } of sem.items) {
      if (item.kind === "slot") {
        slotCredits.set(item.groupId, (slotCredits.get(item.groupId) ?? 0) + item.credits);
        continue;
      }
      const c = index.byCode.get(item.code)!;
      expect(isSatisfied(c.prerequisite, ctx), `${item.code} scheduled in ${sem.label} before its prerequisites`).toBe(
        true,
      );
      expect(done.has(item.code), `${item.code} scheduled after completion`).toBe(false);
      if (!retake) {
        expect(taken.has(item.code), `${item.code} scheduled twice`).toBe(false);
      }
      taken.add(item.code);
      if (!failed) passed.push(item.code);
    }
    for (const code of passed) {
      done.add(code);
      earned += index.byCode.get(code)!.credits;
    }
  }
  if (!roadmap.blocked) {
    // Every requirement group must be satisfied by completed courses plus elective slots.
    const progress = evaluateProgress(index, done);
    for (const g of progress.groups) {
      const total = g.countedCredits + (slotCredits.get(g.group.id) ?? 0);
      expect(total, `${g.group.title} not satisfied`).toBeGreaterThanOrEqual(g.requiredCredits);
    }
  }
}

describe("progress", () => {
  it("counts completed credits toward the degree", () => {
    const index = se();
    const p = evaluateProgress(index, ["0102120", "0401120", "0108104"]);
    expect(p.countedCredits).toBe(7);
    expect(p.earnedCredits).toBe(7);
    expect(p.remainingCredits).toBe(124 - 7);
    expect(p.percent).toBe(Math.round((7 / 124) * 100));
  });

  it("caps elective groups at their requirement", () => {
    const index = se();
    // Two Society & Civilization electives; only one counts.
    const p = evaluateProgress(index, ["0406100", "0408100"]);
    const group = p.groups.find((g) => g.group.id === "gen-society")!;
    expect(group.countedCredits).toBe(3);
    expect(group.done).toBe(true);
    expect(p.countedCredits).toBe(3);
    expect(p.earnedCredits).toBe(6);
  });

  it("reports saved codes that are not in the plan instead of counting them", () => {
    const p = evaluateProgress(se(), ["0102120", "NOT-A-COURSE"]);
    expect(p.unknownCodes).toEqual(["NOT-A-COURSE"]);
    expect(p.countedCredits).toBe(3);
  });

  it("marks the degree complete only when every group is done", () => {
    const index = se();
    const everything = index.curriculum.courses.map((c) => c.code);
    expect(evaluateProgress(index, everything).complete).toBe(true);
    expect(evaluateProgress(index, everything.filter((c) => c !== "0103491")).complete).toBe(false);
  });
});

describe("course status", () => {
  it("separates completed, planned, eligible and locked courses", () => {
    const states = courseStates(se(), ["0102120"], ["0102220"]);
    expect(states.get("0102120")!.status).toBe("completed");
    expect(states.get("0102220")!.status).toBe("planned");
    expect(states.get("0107101")!.status).toBe("eligible");
    expect(states.get("0102221")!.status).toBe("locked");
    expect(states.get("0102221")!.missing).toEqual([{ kind: "course", code: "0102220" }]);
  });

  it("explains credit-hour requirements", () => {
    const state = courseStates(se(), ["0102120"]).get("0102453")!;
    expect(state.status).toBe("locked");
    expect(state.missing).toEqual([{ kind: "credits", min: 60 }]);
  });

  it("flags elective options once their requirement is met", () => {
    const states = courseStates(se(), ["0408100"]);
    expect(states.get("0406100")!.notNeeded).toBe(true);
    expect(states.get("0303100")!.notNeeded).toBe(false);
  });

  it("shows what a course unlocks", () => {
    const unlocks = unlockedBy(se(), ["0102120", "0102220", "0107200"], "0102221");
    expect(unlocks).toEqual(expect.arrayContaining(["0102270", "0102330", "0114208"]));
    expect(unlocks).not.toContain("0103430"); // also needs Software Design and Development
  });

  it("reports missing corequisites", () => {
    const index = indexOf(
      rawCurriculum([requiredGroup("core", [course("LEC", 3, undefined, { coreqs: ["LAB"] }), course("LAB", 1)])]),
    );
    expect(courseStates(index, []).get("LEC")!.coreqMissing).toEqual(["LAB"]);
    expect(courseStates(index, [], ["LAB"]).get("LEC")!.coreqMissing).toEqual([]);
  });
});

describe("targets and electives", () => {
  it("uses open slots for electives the student hasn't chosen", () => {
    const t = resolveTargets(se(), []);
    const slots = t.items.filter((i) => i.kind === "slot");
    expect(slots.map((s) => s.id).sort()).toEqual(
      ["slot:gen-managerial:0", "slot:gen-society:0", "slot:major-electives:0", "slot:major-electives:1"].sort(),
    );
    expect(t.items.reduce((sum, i) => sum + i.credits, 0)).toBe(124);
  });

  it("plans chosen electives and their prerequisites", () => {
    // Data and Web Mining needs Design and Analysis of Algorithms, another elective.
    const t = resolveTargets(se(), [], { "major-electives": ["0102481"] });
    expect(t.courseCodes.has("0102481")).toBe(true);
    expect(t.courseCodes.has("0102370")).toBe(true);
    expect(t.items.some((i) => i.kind === "slot" && i.groupId === "major-electives")).toBe(false);
  });

  it("does not add slots for groups already complete", () => {
    const t = resolveTargets(se(), ["0408100"]);
    expect(t.items.some((i) => i.id.startsWith("slot:gen-society"))).toBe(false);
  });

  it("picks the cheaper alternative of an OR prerequisite", () => {
    const index = indexOf(
      rawCurriculum([
        requiredGroup("core", [course("X", 3, "(A & B) | D")]),
        {
          id: "pool",
          title: "Pool",
          category: "major",
          rule: "choose",
          minCredits: 3,
          courses: [course("A"), course("B"), course("D")],
        },
      ]),
    );
    const t = resolveTargets(index, []);
    expect([...t.courseCodes].sort()).toEqual(["D", "X"]);
  });
});

describe("roadmap", () => {
  const majors = [
    ["Software Engineering", se],
    ["Computer Science", cs],
    ["Cybersecurity", cyber],
  ] as const;

  for (const [name, get] of majors) {
    it(`builds a valid full plan for ${name}`, () => {
      const index = get();
      const s = settings();
      const roadmap = buildRoadmap({ index, completed: [], settings: s });
      expect(roadmap.blocked).toBeNull();
      expect(roadmap.semesterCount).toBeGreaterThanOrEqual(7);
      expect(roadmap.semesterCount).toBeLessThanOrEqual(9);
      expect(roadmap.semesterCount).toBeGreaterThanOrEqual(roadmap.lowerBound);
      expectValidRoadmap(index, [], roadmap, s);
    });

    for (const load of [12, 15, 21]) {
      it(`respects a ${load}-credit limit for ${name}`, () => {
        const index = get();
        const s = settings({ maxCredits: load });
        const roadmap = buildRoadmap({ index, completed: [], settings: s });
        expect(roadmap.blocked).toBeNull();
        expectValidRoadmap(index, [], roadmap, s);
      });
    }
  }

  it("respects summer limits and labels summer terms", () => {
    const index = se();
    const s = settings({ includeSummer: true, summerMaxCredits: 6 });
    const roadmap = buildRoadmap({ index, completed: [], settings: s });
    expect(roadmap.summerCount).toBeGreaterThan(0);
    expect(roadmap.semesters.find((x) => x.isSummer)!.label).toMatch(/^Summer \d{4}$/);
    expectValidRoadmap(index, [], roadmap, s);
  });

  it("is deterministic", () => {
    const a = buildRoadmap({ index: cs(), completed: ["0102120"], settings: settings() });
    const b = buildRoadmap({ index: cs(), completed: ["0102120"], settings: settings() });
    expect(a.semesters.map((s) => s.items.map((i) => i.item.id))).toEqual(
      b.semesters.map((s) => s.items.map((i) => i.item.id)),
    );
  });

  it("prioritizes the critical path over filler courses", () => {
    const index = se();
    const roadmap = buildRoadmap({ index, completed: [], settings: settings({ maxCredits: 9 }) });
    const first = roadmap.semesters[0].items.map((i) => i.item.id);
    // Computer Skills starts the longest chain (Intro to Programming → OOP → ...).
    expect(first).toContain("0102120");
    expect(first).not.toContain("0406110"); // Islamic Culture has nothing depending on it
  });

  it("waits for credit-hour thresholds", () => {
    const index = se();
    const roadmap = buildRoadmap({ index, completed: [], settings: settings() });
    const semesterOf = (code: string) => roadmap.placement.get(code)!;
    const creditsBefore = (i: number) => (i === 0 ? 0 : roadmap.semesters.find((s) => s.index === i - 1)!.countedAfter);
    expect(creditsBefore(semesterOf("0103480"))).toBeGreaterThanOrEqual(75);
    expect(creditsBefore(semesterOf("0103490"))).toBeGreaterThanOrEqual(90);
    expect(semesterOf("0103491")).toBeGreaterThan(semesterOf("0103490"));
  });

  it("schedules corequisites together", () => {
    const index = indexOf(
      rawCurriculum([
        requiredGroup("core", [
          course("A"),
          course("LEC", 3, "A", { coreqs: ["LAB"] }),
          course("LAB", 1, "A", { coreqs: ["LEC"] }),
          course("B"),
          course("C"),
        ]),
      ]),
    );
    const s = settings({ maxCredits: 6 });
    const roadmap = buildRoadmap({ index, completed: [], settings: s });
    expect(roadmap.placement.get("LEC")).toBe(roadmap.placement.get("LAB"));
    expectValidRoadmap(index, [], roadmap, s);
  });

  it("handles OR prerequisites when scheduling", () => {
    const index = indexOf(
      rawCurriculum([requiredGroup("core", [course("A"), course("B"), course("D"), course("X", 3, "(A & B) | D")])]),
    );
    const s = settings({ maxCredits: 3 });
    const roadmap = buildRoadmap({ index, completed: [], settings: s });
    expectValidRoadmap(index, [], roadmap, s);
    // With D done, X is allowed straight away even though A and B are not.
    const afterD = buildRoadmap({ index, completed: ["D"], settings: settings({ maxCredits: 9 }) });
    expect(afterD.placement.get("X")).toBe(0);
    expect(courseStates(index, ["D"]).get("X")!.status).toBe("eligible");
    expect(courseStates(index, ["A"]).get("X")!.status).toBe("locked");
  });

  it("keeps the student's own first-semester plan and drops courses that aren't allowed yet", () => {
    const index = se();
    const roadmap = buildRoadmap({
      index,
      completed: ["0102120"],
      settings: settings(),
      firstSemester: ["0102220", "0102270", "0406110"],
    });
    expect(roadmap.semesters[0].items.map((i) => i.item.id)).toEqual(["0102220", "0406110"]);
    expect(roadmap.firstSemesterIssues).toHaveLength(1);
    expect(roadmap.firstSemesterIssues[0].id).toBe("0102270");
    expect(roadmap.firstSemesterIssues[0].message).toMatch(/prerequisites/);
  });

  it("finishes immediately when everything is complete", () => {
    const index = se();
    const roadmap = buildRoadmap({ index, completed: index.curriculum.courses.map((c) => c.code), settings: settings() });
    expect(roadmap.semesterCount).toBe(0);
    expect(roadmap.remainingCredits).toBe(0);
    expect(roadmap.blocked).toBeNull();
  });

  it("only claims 'fastest possible' when the plan meets the proven lower bound", () => {
    for (const load of [9, 12, 15, 18, 21]) {
      const roadmap = buildRoadmap({ index: cs(), completed: [], settings: settings({ maxCredits: load }) });
      if (roadmap.provablyFastest) expect(roadmap.semesterCount).toBe(roadmap.lowerBound);
      expect(roadmap.semesterCount).toBeGreaterThanOrEqual(roadmap.lowerBound);
    }
  });
});

describe("what-if simulations", () => {
  const demoCompleted = [
    "0102120", "0107101", "0408100", "0405100", "0401120", "0108103",
    "0102220", "0107200", "0107102", "0108203", "0501170", "0401121",
    "0103220", "0107103", "0102221", "0108104", "0201100",
  ];
  const base = () => ({ index: se(), completed: demoCompleted, settings: settings() });

  it("does not modify the inputs (scenario isolation)", () => {
    const input = base();
    const frozenCompleted = Object.freeze([...input.completed]);
    const frozenSettings = Object.freeze({ ...input.settings, startTerm: Object.freeze({ ...input.settings.startTerm }) });
    const result = simulateScenario(
      { ...input, completed: frozenCompleted, settings: frozenSettings },
      { maxCredits: 12, includeSummer: true, retake: "0102270", postpone: { code: "0103320", semesters: 1 } },
    );
    expect(frozenCompleted).toEqual(demoCompleted);
    expect(frozenSettings.maxCredits).toBe(18);
    expect(result.baseline.semesters).toEqual(buildRoadmap(input).semesters);
  });

  it("an empty scenario changes nothing", () => {
    const result = simulateScenario(base(), {});
    expect(result.graduationChange).toBe("same");
    expect(result.affected).toEqual([]);
  });

  it("a lighter load never finishes earlier, a heavier one never later", () => {
    const lighter = simulateScenario(base(), { maxCredits: 12 });
    expect(["later", "same"]).toContain(lighter.graduationChange);
    expect(lighter.simulated.semesterCount).toBeGreaterThan(lighter.baseline.semesterCount);
    expect(lighter.reasons[0]).toMatch(/12 credits per semester/);
    const heavier = simulateScenario(base(), { maxCredits: 21 });
    expect(["earlier", "same"]).toContain(heavier.graduationChange);
    expectValidRoadmap(se(), demoCompleted, lighter.simulated, settings({ maxCredits: 12 }));
  });

  it("postponing a critical course delays the courses that depend on it", () => {
    const result = simulateScenario(base(), { postpone: { code: "0103320", semesters: 1 } });
    const moved = result.affected.map((a) => a.id);
    expect(moved).toContain("0103320");
    expect(moved).toContain("0103330"); // Software Design and Development needs it
    expect(result.reasons.join(" ")).toMatch(/needed before/);
    expect(result.simulated.placement.get("0103320")).toBeGreaterThan(result.baseline.placement.get("0103320")!);
  });

  it("a retaken course is scheduled twice and its dependents wait", () => {
    const result = simulateScenario(base(), { retake: "0102270" });
    const attempts = result.simulated.semesters.flatMap((s) => s.items).filter((i) => i.item.id === "0102270");
    expect(attempts).toHaveLength(2);
    expect(attempts[0].failed).toBe(true);
    expect(attempts[1].retake).toBe(true);
    expectValidRoadmap(se(), demoCompleted, result.simulated, settings());
    expect(result.reasons.join(" ")).toMatch(/Retaking Data Structures and Algorithms adds 3 credit hours/);
  });

  it("summer terms never make graduation later", () => {
    const result = simulateScenario(base(), { includeSummer: true });
    expect(["earlier", "same"]).toContain(result.graduationChange);
  });
});

describe("insights", () => {
  it("names the planned course that unlocks the most", () => {
    const insight = nextStepInsight(se(), ["0102120", "0102220", "0107200"], ["0102221", "0107101"]);
    expect(insight?.code).toBe("0102221");
    expect(insight?.message).toMatch(/^Taking Object-Oriented Programming next semester unlocks \d+ more courses/);
  });

  it("returns nothing when no claim can be supported", () => {
    expect(nextStepInsight(se(), [], ["0406110"])).toBeNull();
  });

  it("ranks key courses by the chain they start", () => {
    const top = keyCourses(se(), [], undefined, 3);
    expect(top[0].chainLength).toBeGreaterThanOrEqual(top[1].chainLength);
    expect(top[0].code).toBe("0102120");
    const impact = courseImpact(se(), [], "0103320");
    expect(impact.downstream).toEqual(expect.arrayContaining(["0103330", "0103430", "0103440", "0103441"]));
    expect(impact.required).toBe(true);
  });
});

describe("terms", () => {
  it("labels and advances terms", () => {
    expect(termLabel({ season: "fall", year: 2027 })).toBe("Fall 2027");
    expect(nextTerm({ season: "spring", year: 2027 }, false)).toEqual({ season: "fall", year: 2027 });
    expect(nextTerm({ season: "spring", year: 2027 }, true)).toEqual({ season: "summer", year: 2027 });
    expect(nextTerm({ season: "fall", year: 2027 }, true)).toEqual({ season: "spring", year: 2028 });
    expect(termSequence({ season: "fall", year: 2026 }, false, 3).map(termLabel)).toEqual([
      "Fall 2026",
      "Spring 2027",
      "Fall 2027",
    ]);
  });

  it("starts planning from the next regular semester", () => {
    expect(defaultStartTerm(new Date(2026, 9, 25))).toEqual({ season: "spring", year: 2027 });
    expect(defaultStartTerm(new Date(2027, 2, 1))).toEqual({ season: "fall", year: 2027 });
  });
});
