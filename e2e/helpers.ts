import { expect, type Page } from "@playwright/test";

/** Completes onboarding for a major, ticking every course in the listed sections. */
export async function onboard(page: Page, major: string, sections: string[] = []) {
  await page.goto("/start");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: new RegExp(major) }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Which courses have you finished?" })).toBeVisible();
  for (const section of sections) {
    await page.getByRole("button", { name: `Select all in ${section}` }).click();
  }
  await page.getByRole("button", { name: "See my plan" }).click();
  await expect(page).toHaveURL(/\/overview$/);
}

/** The large "N of M credit hours" figure on the overview. */
export function creditsFigure(page: Page) {
  return page.getByRole("progressbar", { name: /^Degree progress:/ });
}
