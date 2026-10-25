# UniPath — Devpost submission draft

> Draft for NextSpark Hacks 2026. Sections marked **[TEAM]** need the team's own words before submitting.

**Tagline:** Your degree. Your direction.

## Inspiration

**[TEAM — add your personal story: e.g. a registration week where you couldn't tell which courses you were allowed to take, or a friend who found out late that a missed course delayed graduation.]**

At Al Ain University, like most universities, the degree requirements live in PDFs: a study plan table and a semester-by-semester guidance plan. They're accurate, but they don't know what *you* have already passed. Working out what you can take next, what's blocking you, and whether a delay pushes back graduation means cross-referencing tables by hand.

## What it does

UniPath turns those static documents into a personal roadmap:

- **Choose your major** (Software Engineering, Computer Science or Cybersecurity at Al Ain University) and tick the courses you've finished — whole semesters at once.
- **Overview:** credits done vs required, an estimated graduation term, the courses you can take next, and one insight backed by the prerequisite graph ("Taking Software Requirements and Specification next semester unlocks 2 more courses").
- **My Courses:** every course labelled Completed, Planned, Available or Locked, with a one-line reason for anything locked and a detail panel showing exactly which prerequisites are done.
- **Semester Planner:** a recommended next semester where every course says *why* it was chosen; add or remove courses with clear explanations; a warning (with the reason) if your choices delay graduation; and a full semester-by-semester roadmap.
- **What if?** Try a lighter or heavier load, summer terms, postponing a course, or retaking one. UniPath compares the result with your current plan and explains the difference using the real dependency chain — without touching your saved progress.
- **Degree Map:** an interactive prerequisite graph. Click a course to light up everything before and after it. Phones get an accessible list view.

No sign-up, no API keys. Judges can click **Try Demo** and explore a sample student immediately.

## How we built it

- **Next.js 16 + React 19 + TypeScript + Tailwind CSS 4**, Radix UI primitives for accessible dialogs and menus, React Flow + dagre for the map.
- **Curriculum as data.** We transcribed three official study plans into JSON. Prerequisites use a tiny rule language (`0102221 & 0107200`, `(A & B) | D`, `credits>=75`, `[Department approval]`) parsed into expression trees. Every curriculum is validated with Zod plus custom checks (missing references, cycles, credit totals, impossible electives) before students can use it.
- **A deterministic planning engine**, fully separate from the UI: eligibility, degree-requirement evaluation, a critical-path-first semester scheduler, elective "slots" so the app never picks electives for you, insights, and a what-if simulator that runs on copies of the input.
- **Honest estimates.** Scheduling with prerequisites and credit caps is NP-hard in general, so the scheduler is a heuristic. It computes a lower bound (remaining credits vs. longest prerequisite chain) and only claims "no plan can finish sooner" when the plan matches that bound.
- **Local-first storage:** versioned, validated `localStorage` with backups if saved data can't be read, export/import, and progress stored per major.
- **Tests:** Vitest unit tests for the engine and data, Playwright end-to-end tests (including axe accessibility scans and a phone viewport).

## Challenges we ran into

- **The official documents don't always agree.** Guidance plans used different course codes from the study plans, listed courses that weren't in the degree, or omitted required ones; two prerequisites in the Cybersecurity plan reference course codes that don't exist. We made the study plan the source of truth and recorded every interpretation as a visible data note instead of silently "fixing" it.
- **Electives.** Picking electives on a student's behalf felt wrong, but a planner needs to know when they'll be taken. Elective slots solved it: an open slot counts toward the requirement and becomes a real course when the student chooses one.
- **Credit-hour thresholds.** Courses like the capstone need 90 completed credits, and a single 1-credit lab could push it back a whole semester. A "fill pass" in the scheduler swaps end-of-chain courses to use all available credits.
- **[TEAM — add any challenges from your own experience.]**

## Accomplishments that we're proud of

- Three real study plans load and pass every validation check.
- For all three majors at 18 credits per semester, UniPath's plan provably matches the fastest possible finish under its assumptions (7 semesters for a new student).
- Every recommendation, lock and what-if result comes with a plain-language reason derived from the actual prerequisite graph.
- **[TEAM — add what you're proud of.]**

## What we learned

**[TEAM — add what you learned.]**

## What's next for UniPath

- More majors and universities (the engine is already university-independent).
- Real section and timetable data, so "eligible" can become "offered and has seats".
- Grade tracking, minimum-grade rules and GPA tools where the university's policy is verified.
- Shareable read-only plans for advisors.
- An optional assistant that explains (but never overrides) the engine's results.

## Built with

Next.js, React, TypeScript, Tailwind CSS, Radix UI, Lucide, React Flow, dagre, Zod, Zustand, Sonner, Vitest, Playwright, axe-core.

## AI usage disclosure

We used **Claude (Anthropic) via Claude Code** heavily: it wrote most of the code, tests and documentation from our specification and the official study plan PDFs we provided, and it transcribed the curricula, which we then **[TEAM — describe how you reviewed the data and code]**. UniPath itself uses no AI at runtime — all planning is deterministic.

## Links

- Repository: https://github.com/bilal-feroz/Unipath
- Live demo: **[TEAM — add deployment URL]**
- Demo video: **[TEAM — add video URL]**
