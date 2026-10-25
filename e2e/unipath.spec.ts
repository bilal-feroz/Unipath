import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { creditsFigure, onboard } from "./helpers";

test.describe("first-time student", () => {
  test("opens UniPath, picks a major, marks completed courses and gets a plan", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Your path to graduation/ })).toBeVisible();
    await page.getByRole("link", { name: "Start Planning" }).first().click();

    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("radio", { name: /Computer Science/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Select all in Year 1 · Semester 1" }).click();
    await expect(page.getByText(/6\s*courses\s*·\s*18\s*credit hours/)).toBeVisible();
    await page.getByRole("button", { name: "See my plan" }).click();

    await expect(page.getByRole("heading", { name: "Computer Science" })).toBeVisible();
    await expect(creditsFigure(page)).toHaveAttribute("aria-label", "Degree progress: 18 of 123 credit hours");
    await expect(page.getByText(/Estimated graduation/i).first()).toBeVisible();

    await page.getByRole("link", { name: "Plan my next semester" }).click();
    await expect(page.getByRole("heading", { name: "Recommended next semester" })).toBeVisible();
    const planned = page.getByRole("list", { name: /Courses planned for/ }).getByRole("listitem").filter({ has: page.getByRole("button", { name: /^Remove / }) });
    expect(await planned.count()).toBeGreaterThan(3);
    // Every recommendation explains itself.
    await expect(page.getByText(/Needed before|First step in a chain|Suggested for Year/).first()).toBeVisible();
  });

  test("progress survives a page refresh", async ({ page }) => {
    // Year 1, Semester 1 has 15 required credits; the guidance plan's sixth slot is an elective, listed separately.
    await onboard(page, "Software Engineering", ["Year 1 · Semester 1"]);
    await expect(creditsFigure(page)).toHaveAttribute("aria-label", "Degree progress: 15 of 124 credit hours");
    await page.reload();
    await expect(creditsFigure(page)).toHaveAttribute("aria-label", "Degree progress: 15 of 124 credit hours");
    await page.goto("/courses");
    await expect(page.getByRole("checkbox", { name: "Computer Skills: mark as not completed" })).toBeChecked();
  });
});

test.describe("changing progress", () => {
  test("marking a course complete updates eligibility and recommendations", async ({ page }) => {
    await onboard(page, "Software Engineering", ["Year 1 · Semester 1"]);
    await page.goto("/courses");
    const oop = page.getByTestId("course-0102221");
    await expect(oop.getByText("Locked").first()).toBeVisible();
    await expect(oop.getByText("Needs Introduction to Programming")).toBeVisible();

    await page.getByRole("checkbox", { name: "Introduction to Programming: mark as completed" }).check();
    await expect(page.getByText("Introduction to Programming marked as completed")).toBeVisible();
    await expect(page.getByText(/Now available next semester: .*Object-Oriented Programming/)).toBeVisible();
    await expect(oop.getByText("Locked")).toHaveCount(0);

    await page.goto("/planner");
    await expect(page.getByTestId("planned-0102221")).toBeVisible();

    // Undo puts things back.
    await page.goto("/courses");
    await page.getByRole("checkbox", { name: "Introduction to Programming: mark as not completed" }).uncheck();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("checkbox", { name: "Introduction to Programming: mark as not completed" })).toBeChecked();
  });

  test("planning a locked course explains what's missing", async ({ page }) => {
    await onboard(page, "Software Engineering", ["Year 1 · Semester 1"]);
    await page.goto("/planner");
    await page.getByRole("button", { name: "Add a course" }).click();
    await page.getByRole("button", { name: "Why can't I add Data Structures and Algorithms?" }).click();
    await expect(page.getByText("You can't plan Data Structures and Algorithms yet")).toBeVisible();
    await expect(page.getByText(/Complete first: Object-Oriented Programming and Discrete Mathematics/)).toBeVisible();
  });
});

test.describe("what-if simulator", () => {
  test("runs a scenario, explains it, and resets without touching saved progress", async ({ page }) => {
    await page.goto("/demo");
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByText("Demo mode.", { exact: true })).toBeVisible();
    await expect(creditsFigure(page)).toHaveAttribute("aria-label", "Degree progress: 49 of 124 credit hours");

    await page.goto("/planner#what-if");
    await page.getByRole("button", { name: "Lighter load (12 credits)" }).click();
    await expect(page.getByTestId("sim-change")).toHaveText("Later");
    await expect(page.getByText(/At 12 credits per semester, your remaining 75 credit hours need at least 7 semesters/)).toBeVisible();
    const baseline = await page.getByTestId("sim-baseline").textContent();
    const simulated = await page.getByTestId("sim-result-term").textContent();
    expect(simulated).not.toBe(baseline);

    await page.getByRole("button", { name: "Reset simulation" }).click();
    await expect(page.getByText("Pick a scenario to compare")).toBeVisible();

    // Saved settings and progress are unchanged.
    await page.getByRole("tab", { name: "Next semester" }).click();
    await expect(page.getByRole("radio", { name: "18", exact: true }).first()).toBeChecked();
    await page.goto("/overview");
    await expect(creditsFigure(page)).toHaveAttribute("aria-label", "Degree progress: 49 of 124 credit hours");
  });
});

test.describe("switching majors", () => {
  test("keeps each major's progress separate", async ({ page }) => {
    await onboard(page, "Software Engineering", ["Year 1 · Semester 1", "Year 1 · Semester 2"]);
    await expect(creditsFigure(page)).toHaveAttribute("aria-label", "Degree progress: 33 of 124 credit hours");

    // Switch to Computer Science without copying anything.
    await page.getByRole("button", { name: "Settings and data" }).click();
    await page.getByRole("menuitem", { name: "Switch major" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("radio", { name: /Computer Science/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    // UniPath offers to copy matching course codes, but never does it automatically.
    await expect(page.getByText(/you marked in Software Engineering have the same course code here/)).toBeVisible();
    await page.getByRole("button", { name: "See my plan" }).click();
    await expect(page.getByRole("heading", { name: "Computer Science" })).toBeVisible();
    await expect(creditsFigure(page)).toHaveAttribute("aria-label", "Degree progress: 0 of 123 credit hours");

    // Switch back: Software Engineering progress is intact.
    await page.getByRole("button", { name: "Settings and data" }).click();
    await page.getByRole("menuitem", { name: "Switch major" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("radio", { name: /Software Engineering/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "See my plan" }).click();
    await expect(page.getByRole("heading", { name: "Software Engineering" })).toBeVisible();
    await expect(creditsFigure(page)).toHaveAttribute("aria-label", "Degree progress: 33 of 124 credit hours");
  });
});

test.describe("degree map", () => {
  test("highlights a course's prerequisites and opens details", async ({ page }) => {
    await page.goto("/demo");
    await expect(page).toHaveURL(/\/overview$/);
    await page.getByRole("link", { name: /Degree Map/ }).first().click();
    await page.getByRole("button", { name: /Software Design and Development.*Locked/ }).click();
    await expect(page.getByText(/Needs 3 courses first · leads to 5 later courses/)).toBeVisible();
    await page.getByRole("button", { name: "Open details" }).click();
    await expect(page.getByRole("dialog", { name: "Software Design and Development" })).toBeVisible();
    await expect(page.getByText("Complete the courses marked below first.")).toBeVisible();
  });
});

test.describe("polish", () => {
  test("has no console errors, even when an extension edits <body> before React loads", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    // Grammarly adds these attributes to <body>, which used to cause a hydration error.
    await page.addInitScript(() => {
      new MutationObserver((_, observer) => {
        if (!document.body) return;
        document.body.setAttribute("data-gr-ext-installed", "");
        document.body.setAttribute("data-new-gr-c-s-check-loaded", "14.1341.0");
        observer.disconnect();
      }).observe(document, { childList: true, subtree: true });
    });
    for (const path of ["/", "/start", "/about", "/demo", "/courses", "/planner", "/map", "/gpa", "/coach"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(errors).toEqual([]);
  });

  test("the theme toggle switches themes and remembers the choice", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Switch between light and dark theme" }).click();
    await expect(html).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "light");
    await page.goto("/demo");
    await expect(page).toHaveURL(/\/overview$/);
    await expect(html).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Switch between light and dark theme" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
  });
});

test.describe("accessibility", () => {
  for (const [theme, path] of ["dark", "light"].flatMap((t) => ["/", "/overview", "/courses", "/planner", "/map", "/gpa", "/coach"].map((p) => [t, p]))) {
    test(`has no serious automated accessibility issues on ${path} (${theme} theme)`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("unipath:theme", t), theme);
      await page.goto("/demo");
      await expect(page).toHaveURL(/\/overview$/);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).exclude(".react-flow__renderer").analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
    });
  }
});

test.describe("mobile @mobile", () => {
  test("uses bottom navigation and the list view of the map @mobile", async ({ page }) => {
    await page.goto("/demo");
    await expect(page).toHaveURL(/\/overview$/);
    const nav = page.getByRole("navigation", { name: "Main" }).last();
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Courses" }).click();
    await expect(page.getByRole("heading", { name: "Your courses" })).toBeVisible();
    await nav.getByRole("link", { name: "Map" }).click();
    await expect(page.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Step 1" })).toBeVisible();
    // No sideways scrolling on a phone.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
