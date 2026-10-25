import { expect, test, type Page } from "@playwright/test";

async function openDemo(page: Page) {
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/overview$/);
}

const STATUS = {
  configured: true,
  provider: "groq",
  label: "Groq",
  model: "openai/gpt-oss-120b",
  privacyUrl: "https://console.groq.com/docs/your-data",
  privacyNote: "Groq says it doesn't use API requests to train models.",
};

const IDEAS = {
  mode: "ideas",
  trends: "Employers expect automated testing, CI/CD and secure coding from new graduates.",
  ideas: [
    {
      title: "Campus study-group finder",
      summary: "A small web app that matches classmates by course.",
      whyItFits: "Uses your object-oriented programming and software engineering foundations.",
      buildsOn: ["0102221", "0103220"],
      skills: ["Unit testing"],
      industryPractices: ["Automated tests run in CI on every push"],
      stack: ["Next.js", "GitHub Actions"],
      difficulty: "beginner",
      timeEstimate: "2–3 weeks",
      firstSteps: ["Sketch the screens", "Create a GitHub repository"],
    },
  ],
  sources: [{ title: "example.org", url: "https://example.org/report" }],
  searchQueries: ["software engineering graduate skills"],
  searched: true,
  provider: "Groq",
  model: "openai/gpt-oss-120b",
  generatedAt: "2026-10-25T10:00:00.000Z",
};

test.describe("GPA tracker", () => {
  test("shows the CGPA on the official scale and updates when a grade changes", async ({ page }) => {
    await openDemo(page);
    // The overview links to the GPA.
    await expect(page.getByRole("link", { name: /CGPA\s*3\.45\s*Very Good/ })).toBeVisible();
    await page.goto("/gpa");
    await expect(page.getByTestId("cgpa")).toHaveText("3.45");
    await expect(page.getByTestId("cgpa-rating")).toHaveText("Very Good");

    // Computer Skills A → B: (169 − 3) / 49 = 3.39
    await page.getByRole("combobox", { name: "Grade for Computer Skills" }).selectOption("B");
    await expect(page.getByTestId("cgpa")).toHaveText("3.39");

    // Clearing a grade leaves that course out and says so.
    await page.getByRole("combobox", { name: "Grade for Computer Skills" }).selectOption("");
    await expect(page.getByText(/1 completed course has no grade yet/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Grade for Computer Skills" })).toHaveValue("");
  });
});

test.describe("taking courses this semester", () => {
  test("plans next semester as if current courses are passed", async ({ page }) => {
    await openDemo(page);
    await page.goto("/courses");
    // The sample student already takes Software Requirements this semester, so nothing plans it again.
    await expect(page.getByTestId("course-0103320").getByText("Taking now").first()).toBeVisible();
    const numerical = page.getByTestId("course-0107201");
    await expect(numerical.getByText("Locked").first()).toBeVisible();

    const calc = page.getByTestId("course-0107104");
    await calc.getByRole("button", { name: "Calculus II: taking this semester" }).click();
    await expect(page.getByText("Taking Calculus II this semester")).toBeVisible();
    await expect(calc.getByText("Taking now").first()).toBeVisible();
    // Introduction to Numerical Methods needs Calculus II, so it opens up for next semester.
    await expect(numerical.getByText("Locked")).toHaveCount(0);

    await page.goto("/planner");
    await expect(page.getByTestId("planned-0107104")).toHaveCount(0);
    await expect(page.getByTestId("planned-0103320")).toHaveCount(0);
  });
});

test.describe("AI coach", () => {
  test("shows project ideas with sources and answers a follow-up question", async ({ page }) => {
    const requests: Record<string, unknown>[] = [];
    await page.route("**/api/coach", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: STATUS });
      const body = route.request().postDataJSON() as Record<string, unknown>;
      requests.push(body);
      if (body.mode === "ideas") return route.fulfill({ json: IDEAS });
      return route.fulfill({
        json: {
          mode: "ask",
          answer: "Start small:\n- Set up the repo\n- Write one **test** first",
          sources: [],
          searchQueries: [],
          searched: false,
          provider: "Groq",
          model: "openai/gpt-oss-120b",
          generatedAt: "2026-10-25T10:01:00.000Z",
        },
      });
    });

    await openDemo(page);
    await page.getByRole("link", { name: /AI Coach/ }).first().click();
    await expect(page.getByRole("heading", { name: "AI coach", level: 1 })).toBeVisible();
    // The privacy note names the provider the server actually uses.
    await expect(page.getByText(/to Groq \(openai\/gpt-oss-120b\)/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Their data policy" })).toHaveAttribute("href", STATUS.privacyUrl);
    await page.getByLabel(/What are you into/).fill("web apps");
    await page.getByRole("button", { name: "Get project ideas" }).click();

    const card = page.getByTestId("idea-card");
    await expect(card.getByRole("heading", { name: "Campus study-group finder" })).toBeVisible();
    await expect(card.getByText("Object-Oriented Programming", { exact: true })).toBeVisible();
    await expect(page.getByText(/Employers expect automated testing/)).toBeVisible();
    await expect(page.getByRole("link", { name: /example\.org/ })).toHaveAttribute("href", "https://example.org/report");

    // Only course codes and interests are sent; the server looks up course names itself.
    expect(requests[0]).toMatchObject({ mode: "ideas", curriculumId: "aau-bsc-software-engineering", interests: "web apps" });
    expect((requests[0].completed as string[]).length).toBe(17);

    await page.getByLabel("Your question").fill("How do I start?");
    await page.getByRole("button", { name: "Send question" }).click();
    await expect(page.getByText("Set up the repo")).toBeVisible();
    await expect(page.locator("strong", { hasText: "test" })).toBeVisible();
    expect(requests[1]).toMatchObject({ mode: "ask", question: "How do I start?", ideaTitles: ["Campus study-group finder"] });

    // Ideas are remembered after a reload.
    await page.reload();
    await expect(page.getByTestId("idea-card")).toHaveCount(1);
  });

  test("says so when an answer didn't use a live web search", async ({ page }) => {
    await page.route("**/api/coach", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: STATUS })
        : route.fulfill({ json: { ...IDEAS, sources: [], searchQueries: [], searched: false } }),
    );
    await openDemo(page);
    await page.goto("/coach");
    await page.getByRole("button", { name: "Get project ideas" }).click();
    await expect(page.getByTestId("idea-card")).toHaveCount(1);
    await expect(page.getByText(/didn.t use a live web search/)).toBeVisible();
  });

  test("counts down and blocks the button while the coach is rate limited", async ({ page }) => {
    await page.route("**/api/coach", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: STATUS })
        : route.fulfill({
            status: 429,
            headers: { "Retry-After": "3" },
            json: { error: "rate_limited", message: "That's a lot of new ideas in a short time!", retryAfterSeconds: 3 },
          }),
    );
    await openDemo(page);
    await page.goto("/coach");
    await page.getByRole("button", { name: "Get project ideas" }).click();
    await expect(page.getByText("Please wait a moment")).toBeVisible();
    await expect(page.getByRole("button", { name: /Try again in \ds/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Get project ideas" })).toBeEnabled({ timeout: 6000 });
    await expect(page.getByText("You can try again now.")).toBeVisible();
  });

  test("explains when the AI isn't set up on the server", async ({ page }) => {
    await page.route("**/api/coach", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: { ...STATUS, configured: false, provider: null, label: null, model: null } })
        : route.fulfill({ status: 503, json: { error: "not_configured", message: "No key." } }),
    );
    await openDemo(page);
    await page.goto("/coach");
    await expect(page.getByText(/isn.t switched on for this site yet/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Get project ideas" })).toBeDisabled();
  });
});
