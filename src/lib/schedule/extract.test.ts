import { describe, expect, it } from "vitest";
import { extractDeadlines } from "./extract";

const courses = [
  { code: "0102330", title: "Database Systems" },
  { code: "0103420", title: "Software Project Management" },
];
const today = "2026-10-25";

describe("deadline extraction", () => {
  it("reads the example from the brief", () => {
    const [item] = extractDeadlines("Database Systems Assignment 2 is due on November 12 at 11:59 PM.", { today, courses });
    expect(item).toMatchObject({
      type: "assignment",
      courseCode: "0102330",
      title: "Database Systems Assignment 2",
      date: "2026-11-12",
      time: "23:59",
      confidence: "medium",
      flags: ["no-year"],
    });
  });

  it("handles several formats in one outline and uses the outline's course", () => {
    const text = [
      "Software Project Management (0103420) — Fall 2026",
      "Quiz 1: 3 Nov 2026, 10:00",
      "Midterm exam on 2026-11-19 at 9:30 am in Building B Room 105.",
      "Project proposal due 12/11/2026.",
      "Final presentation: Dec 10th, 2026",
    ].join("\n");
    const items = extractDeadlines(text, { today, courses });
    expect(items.map((i) => [i.type, i.date, i.time])).toEqual([
      ["quiz", "2026-11-03", "10:00"],
      ["midterm", "2026-11-19", "09:30"],
      ["project", "2026-11-12", null],
      ["presentation", "2026-12-10", null],
    ]);
    expect(items.every((i) => i.courseCode === "0103420")).toBe(true);
    expect(items[1].location).toBe("Building B Room 105");
    expect(items[2].flags).toEqual(["ambiguous-date", "no-time"]);
    expect(items[2].confidence).toBe("low");
  });

  it("flags missing information instead of guessing silently", () => {
    const [reg, unknown, past] = extractDeadlines(
      "Course registration closes 5 January.\nSomething happens on March 3.\nAssignment 1 was due 1 October 2026.",
      { today, courses },
    );
    expect(reg).toMatchObject({ type: "registration", date: "2027-01-05", courseCode: null });
    expect(reg.flags).toEqual(["no-year", "no-time"]);
    expect(unknown.type).toBe("other");
    expect(unknown.flags).toContain("unknown-type");
    expect(past.flags).toContain("past-date");
  });

  it("ignores text without dates", () => {
    expect(extractDeadlines("Please read chapter 4 before class.", { today, courses })).toEqual([]);
  });
});
