import { describe, expect, it } from "vitest";
import { getCurriculum } from "@/lib/curriculum/registry";
import { indexCurriculum } from "@/lib/engine/model";
import { DEMO_COMPLETED, DEMO_GRADES } from "@/lib/state/demo";
import { computeGpa, ratingFor, roundGpa } from "./gpa";
import { AAU_UNDERGRADUATE, scaleForUniversity } from "./scales";

const se = () => indexCurriculum(getCurriculum("aau-bsc-software-engineering")!);

describe("AAU grading scale", () => {
  it("matches the official undergraduate table", () => {
    const points = Object.fromEntries(AAU_UNDERGRADUATE.passingGrades.map((g) => [g.symbol, g.points]));
    expect(points).toEqual({ A: 4, "B+": 3.5, B: 3, "C+": 2.5, C: 2, "D+": 1.5, D: 1, P: null, T: null });
    expect(scaleForUniversity("aau")).toBe(AAU_UNDERGRADUATE);
    expect(scaleForUniversity("unknown")).toBeNull();
  });

  it("uses the official rating bands", () => {
    expect(ratingFor(4, AAU_UNDERGRADUATE)).toBe("Excellent");
    expect(ratingFor(3.6, AAU_UNDERGRADUATE)).toBe("Excellent");
    expect(ratingFor(3.59, AAU_UNDERGRADUATE)).toBe("Very Good");
    expect(ratingFor(3.0, AAU_UNDERGRADUATE)).toBe("Very Good");
    expect(ratingFor(2.99, AAU_UNDERGRADUATE)).toBe("Good");
    expect(ratingFor(2.5, AAU_UNDERGRADUATE)).toBe("Good");
    expect(ratingFor(2.49, AAU_UNDERGRADUATE)).toBe("Satisfactory");
    expect(ratingFor(2.0, AAU_UNDERGRADUATE)).toBe("Satisfactory");
    expect(ratingFor(1.99, AAU_UNDERGRADUATE)).toBe("Unsatisfactory");
    expect(ratingFor(0, AAU_UNDERGRADUATE)).toBe("Unsatisfactory");
  });

  it("rates on the rounded value", () => {
    expect(roundGpa(3.595)).toBe(3.6);
    expect(ratingFor(3.595, AAU_UNDERGRADUATE)).toBe("Excellent");
  });
});

describe("computeGpa", () => {
  it("weights grade points by credit hours", () => {
    // Computer Skills (3 cr) A = 12, Physics I Lab (1 cr) D = 1 → 13 / 4 = 3.25
    const result = computeGpa(se(), ["0102120", "0108104"], { "0102120": "A", "0108104": "D" }, AAU_UNDERGRADUATE);
    expect(result.cgpa).toBe(3.25);
    expect(result.rating).toBe("Very Good");
    expect(result.gradedCredits).toBe(4);
    expect(result.qualityPoints).toBe(13);
  });

  it("leaves out ungraded, Pass and Transfer courses", () => {
    const result = computeGpa(
      se(),
      ["0102120", "0401120", "0405100", "0107101"],
      { "0102120": "B", "0401120": "P", "0405100": "T" },
      AAU_UNDERGRADUATE,
    );
    expect(result.cgpa).toBe(3);
    expect(result.gradedCourses).toBe(1);
    expect(result.ungraded).toEqual(["0107101"]);
    expect(result.notCounted.sort()).toEqual(["0401120", "0405100"]);
  });

  it("ignores grades for courses that aren't completed, and unknown grade symbols", () => {
    const result = computeGpa(se(), ["0102120"], { "0102120": "Z", "0107101": "A" }, AAU_UNDERGRADUATE);
    expect(result.cgpa).toBeNull();
    expect(result.rating).toBeNull();
    expect(result.ungraded).toEqual(["0102120"]);
  });

  it("gives the demo student a CGPA of 3.45 (Very Good)", () => {
    const result = computeGpa(se(), DEMO_COMPLETED, DEMO_GRADES, AAU_UNDERGRADUATE);
    expect(result.qualityPoints).toBe(169);
    expect(result.gradedCredits).toBe(49);
    expect(result.cgpa).toBe(3.45);
    expect(result.rating).toBe("Very Good");
  });
});
