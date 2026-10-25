import { expect, test, type Page } from "@playwright/test";

// Captures the README screenshots into docs/screenshots. Run with: SCREENSHOTS=1 npx playwright test screenshots
test.skip(!process.env.SCREENSHOTS, "Set SCREENSHOTS=1 to capture screenshots");

// A Monday morning in Al Ain, so the sample student's day is still ahead of them and every capture shows the same day.
const MORNING = new Date("2026-10-26T07:40:00+04:00");
test.use({ timezoneId: "Asia/Dubai" });

const desktopPages = [
  { name: "home", path: "/overview" },
  { name: "calendar", path: "/calendar" },
  { name: "tasks", path: "/tasks" },
  { name: "courses", path: "/courses" },
  { name: "planner", path: "/planner" },
  { name: "roadmap", path: "/planner#roadmap" },
  { name: "map", path: "/map" },
  { name: "gpa", path: "/gpa" },
];

// Phone captures are one screen tall, so they line up side by side in the README.
const mobilePages = [
  { name: "home", path: "/overview" },
  { name: "calendar", path: "/calendar" },
  { name: "tasks", path: "/tasks" },
  { name: "planner", path: "/planner" },
];

async function enterDemo(page: Page) {
  await page.clock.install({ time: MORNING });
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/overview$/);
}

async function capture(page: Page, path: string, file: string, before?: () => Promise<void>) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  if (before) await before();
  // The demo notice is covered by the README text; leave it out of the pictures.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("div.border-b")) {
      if (el.textContent?.includes("Demo mode.")) (el as HTMLElement).style.display = "none";
    }
  });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${file} scrolls sideways`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `docs/screenshots/${file}.png` });
}

test("screenshots desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await capture(page, "/", "desktop-landing");
  await enterDemo(page);
  for (const p of desktopPages) await capture(page, p.path, `desktop-${p.name}`);
  await capture(page, "/planner#what-if", "desktop-what-if", () =>
    page.getByRole("button", { name: "Lighter load (12 credits)" }).click(),
  );
});

test("screenshots mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterDemo(page);
  for (const p of mobilePages) await capture(page, p.path, `mobile-${p.name}`);
});

test("screenshots light theme", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("unipath:theme", "light"));
  await enterDemo(page);
  for (const p of [desktopPages[0], desktopPages[6]]) await capture(page, p.path, `light-${p.name}`);
});
