import { expect, test } from "@playwright/test";

// Captures submission screenshots into docs/screenshots. Run with: SCREENSHOTS=1 npx playwright test screenshots
test.skip(!process.env.SCREENSHOTS, "Set SCREENSHOTS=1 to capture screenshots");

const pages = [
  { name: "landing", path: "/" },
  { name: "overview", path: "/overview" },
  { name: "courses", path: "/courses" },
  { name: "planner", path: "/planner" },
  { name: "roadmap", path: "/planner#roadmap" },
  { name: "map", path: "/map" },
];

for (const viewport of [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 390, height: 844 },
]) {
  test(`screenshots ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/demo");
    await expect(page).toHaveURL(/\/overview$/);
    for (const p of pages) {
      await page.goto(p.path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${p.name} scrolls sideways`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `docs/screenshots/${viewport.label}-${p.name}.png`, fullPage: viewport.label === "mobile" });
    }
    await page.goto("/planner#what-if");
    await page.getByRole("button", { name: "Lighter load (12 credits)" }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `docs/screenshots/${viewport.label}-what-if.png`, fullPage: viewport.label === "mobile" });
  });
}

test("screenshots light theme", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("unipath:theme", "light"));
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/overview$/);
  for (const p of [pages[0], pages[1], pages[5]]) {
    await page.goto(p.path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    await page.screenshot({ path: `docs/screenshots/light-${p.name}.png` });
  }
});
