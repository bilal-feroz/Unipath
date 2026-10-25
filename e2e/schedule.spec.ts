import { expect, test, type Page } from "@playwright/test";
import { onboard } from "./helpers";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const localDate = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-CA");
const todayShort = () => WEEKDAY[new Date().getDay()];

async function setSemester(page: Page) {
  await page.goto("/timetable");
  await page.getByRole("button", { name: "Set semester dates" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Semester saved")).toBeVisible();
}

async function addClass(page: Page, course: string, start: string, end: string, building = "Building B") {
  await page.getByRole("button", { name: /^(Add class|Add your first class)$/ }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Course").selectOption({ label: course });
  await dialog.getByRole("button", { name: todayShort(), exact: true }).click();
  await dialog.getByLabel("Starts").fill(start);
  await dialog.getByLabel("Ends").fill(end);
  await dialog.getByLabel("Building").fill(building);
  await dialog.getByLabel("Room").fill("204");
  await dialog.getByRole("button", { name: "Add class" }).click();
  await expect(dialog).toHaveCount(0);
}

const dayPanel = (page: Page) => page.locator("section[aria-labelledby=day-title]");

test.describe("timetable and calendar", () => {
  test("a class added to the timetable shows on the calendar and in today's classes", async ({ page }) => {
    await onboard(page, "Software Engineering", ["Year 1 · Semester 1"]);
    await setSemester(page);
    await addClass(page, "Introduction to Programming (0102220)", "09:00", "10:15");

    await page.goto("/overview");
    await expect(page.getByRole("list", { name: "Today's classes" })).toContainText("Introduction to Programming");
    await page.goto("/calendar");
    await expect(dayPanel(page)).toContainText("Introduction to Programming");
    // The class was also marked as taking this semester.
    await page.goto("/courses");
    await expect(page.getByTestId("course-0102220").getByText("Taking now").first()).toBeVisible();
  });

  test("overlapping classes raise a conflict, and moving one clears it", async ({ page }) => {
    await onboard(page, "Software Engineering", ["Year 1 · Semester 1"]);
    await setSemester(page);
    await addClass(page, "Introduction to Programming (0102220)", "09:00", "10:15");
    await addClass(page, "English (2) (0401121)", "10:00", "11:15");
    await expect(page.getByText(/^Two classes overlap/).first()).toBeVisible();

    await page.getByRole("button", { name: /^Lecture · .* · 10:00 AM – 11:15 AM/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Starts").fill("10:30");
    await dialog.getByLabel("Ends").fill("11:45");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/^Two classes overlap/)).toHaveCount(0);
  });
});

test.describe("assignments and exams", () => {
  test("an assignment shows on the calendar and on Home, ranked", async ({ page }) => {
    await onboard(page, "Software Engineering", ["Year 1 · Semester 1"]);
    await page.goto("/tasks");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Programming lab report 1");
    await dialog.getByLabel("Due date").fill(localDate(1));
    await dialog.getByLabel("Weight %").fill("20");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("button", { name: "Programming lab report 1" })).toBeVisible();
    await expect(page.getByText("High priority")).toBeVisible();

    await page.goto("/overview");
    await expect(page.getByTestId("deadlines")).toContainText("Programming lab report 1");
    await expect(page.getByTestId("priorities")).toContainText("Programming lab report 1");
    await page.goto(`/calendar?date=${localDate(1)}`);
    await expect(dayPanel(page)).toContainText("Programming lab report 1");

    // Completing it moves it to the completed view.
    await page.goto("/tasks");
    // A finished task leaves the open list, so click rather than check (which waits for it to stay ticked).
    await page.getByRole("checkbox", { name: "Programming lab report 1 done" }).click();
    await page.getByRole("tab", { name: /Completed/ }).click();
    await expect(page.getByRole("button", { name: "Programming lab report 1" })).toBeVisible();
  });

  test("imports deadlines from pasted text after a review", async ({ page }) => {
    await onboard(page, "Software Engineering", ["Year 1 · Semester 1"]);
    await page.goto("/tasks");
    await page.getByRole("button", { name: "Import deadlines" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Text to read").fill("Database Systems Assignment 3 is due on 2031-01-20 at 11:59 PM.\nSee you in class.");
    await dialog.getByLabel(/Offline reader/).check();
    await dialog.getByRole("button", { name: "Find dates" }).click();
    await expect(dialog.getByLabel("Name")).toHaveValue("Database Systems Assignment 3");
    await expect(dialog.getByLabel("Add Database Systems Assignment 3")).toBeChecked();
    await dialog.getByRole("button", { name: "Add 1 to my calendar" }).click();
    await expect(page.getByRole("button", { name: "Database Systems Assignment 3" })).toBeVisible();
  });
});

test.describe("the sample student", () => {
  test("shows today's plan, priorities, alerts, campus and events without any setup", async ({ page }) => {
    await page.goto("/demo");
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByRole("heading", { name: "Today's classes" })).toBeVisible();
    await expect(page.getByTestId("next-class")).toBeVisible();
    await expect(page.getByTestId("priorities").getByRole("listitem").first()).toBeVisible();
    await expect(page.getByTestId("deadlines")).toContainText("Database Systems Assignment 2");
    await expect(page.getByRole("button", { name: /Notifications, \d+ unread/ })).toBeVisible();

    await page.goto("/notifications");
    await expect(page.getByText(/^Two exams at the same time/).first()).toBeVisible();
    await page.getByRole("button", { name: /^Dismiss: Two exams at the same time/ }).first().click();
    await expect(page.getByText(/^Two exams at the same time/)).toHaveCount(0);

    await page.goto("/campus");
    await expect(page.getByRole("heading", { name: "CampusFlow" })).toBeVisible();
    await expect(page.locator("section[aria-labelledby=dir-title]")).toContainText("Building B");

    await page.goto("/events");
    const fair = page.getByRole("listitem").filter({ hasText: "Career fair" });
    await expect(fair.getByText("Sample", { exact: true })).toBeVisible();
    await fair.getByRole("button", { name: "Add to calendar" }).click();
    await expect(fair.getByRole("button", { name: "On my calendar" })).toBeVisible();
  });

  test("records attendance", async ({ page }) => {
    await page.goto("/demo");
    await expect(page).toHaveURL(/\/overview$/);
    await page.goto("/attendance");
    const toRecord = page.locator("section[aria-labelledby=record-title]");
    await expect(toRecord).toBeVisible();
    await toRecord.getByRole("button", { name: "Present" }).first().click();
    await expect(toRecord).toHaveCount(0);
    await expect(page.getByText("Close to the limit").first()).toBeVisible();
  });

  test("forecasts the CGPA from expected grades without changing the recorded one", async ({ page }) => {
    await page.goto("/demo");
    await expect(page).toHaveURL(/\/overview$/);
    await page.goto("/gpa");
    await expect(page.getByTestId("cgpa")).toHaveText("3.45");
    // (169 + 55.5) / 64 credit hours = 3.51
    await expect(page.getByTestId("predicted-expected")).toHaveText("3.51");
    await page.getByLabel("Expected grade for Data Structures and Algorithms").selectOption("A");
    await expect(page.getByTestId("predicted-expected")).toHaveText("3.53");
    await expect(page.getByTestId("cgpa")).toHaveText("3.45");

    await page.getByLabel("Target CGPA").fill("3.55");
    await expect(page.getByTestId("target-result")).toContainText("A or better in every course");
  });
});
