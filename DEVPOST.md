# UniPath — Devpost submission draft

> Draft for NextSpark Hacks 2026. Sections marked **[TEAM]** need the team's own words before submitting.

**Tagline:** Your degree, your day, your direction.

## Inspiration

**[TEAM — add your personal story: e.g. a registration week where you couldn't tell which courses you were allowed to take, or a friend who found out late that a missed course delayed graduation.]**

At Al Ain University, like most universities, the degree requirements live in PDFs: a study plan table and a semester-by-semester guidance plan. They're accurate, but they don't know what *you* have already passed. Working out what you can take next, what's blocking you, and whether a delay pushes back graduation means cross-referencing tables by hand.

## What it does

UniPath is the one app a student opens every day — for their day and for their degree.

**Your day**

- **Home:** "Good morning — you have 3 classes today." The next class with a countdown and its room, today's classes, **today's priorities** ranked by urgency and impact, upcoming deadlines, the next 7 days, and an academic snapshot with your CGPA and predicted CGPA.
- **Timetable and calendar:** weekly lectures, labs and tutorials with rooms and professors; cancel or move a single class; makeup classes; month, week and day views of everything, colour-coded and searchable.
- **Assignments and exams:** ranked by deadline, weight, work left and clashes — with the reasons shown — and **import from a course outline or PDF**, reviewed before anything is saved.
- **Smart conflict detection:** overlapping classes, exam clashes, too many deadlines on one day, events clashing with class, tight changes between buildings, attendance near the limit, and registration deadlines. Every alert says what's wrong, why it matters, and what to do.
- **Attendance:** per-course records and forecasts under the student's own rule ("how many classes can I still miss?").
- **CampusFlow:** where your next class is, and a directory of every room in your timetable.
- **Events and notifications:** university events you can add to your calendar, and reminders on your own schedule.

**Your degree**

- **Choose your major** (Software Engineering, Computer Science or Cybersecurity at Al Ain University) and tick the courses you've finished — whole semesters at once.
- **My Courses:** every course labelled Completed, Planned, Available or Locked, with a one-line reason for anything locked and a detail panel showing exactly which prerequisites are done.
- **Semester Planner:** a recommended next semester where every course says *why* it was chosen; add or remove courses with clear explanations; a warning (with the reason) if your choices delay graduation; and a full semester-by-semester roadmap.
- **What if?** Try a lighter or heavier load, summer terms, postponing a course, or retaking one. UniPath compares the result with your current plan and explains the difference using the real dependency chain — without touching your saved progress.
- **Degree Map:** an interactive prerequisite graph. Click a course to light up everything before and after it. Phones get an accessible list view.
- **GPA and forecast:** your CGPA on Al Ain University's official 4.0 scale with its official rating, semester GPA and trend, failed and repeated courses (under the policy you choose), a best/expected/worst what-if forecast, and the grades needed for a target CGPA.
- **AI Coach:** portfolio project ideas built on the courses you've finished and the ones you're taking now. It searches the web for what employers currently expect, shows its sources, and answers follow-up questions.

No sign-up, no API keys. Judges can click **Try Demo** and explore a sample student immediately.

## How we built it

- **Next.js 16 + React 19 + TypeScript + Tailwind CSS 4**, Radix UI primitives for accessible dialogs and menus, React Flow + dagre for the map.
- **Curriculum as data.** We transcribed three official study plans into JSON. Prerequisites use a tiny rule language (`0102221 & 0107200`, `(A & B) | D`, `credits>=75`, `[Department approval]`) parsed into expression trees. Every curriculum is validated with Zod plus custom checks (missing references, cycles, credit totals, impossible electives) before students can use it.
- **A deterministic planning engine**, fully separate from the UI: eligibility, degree-requirement evaluation, a critical-path-first semester scheduler, elective "slots" so the app never picks electives for you, insights, and a what-if simulator that runs on copies of the input.
- **Honest estimates.** Scheduling with prerequisites and credit caps is NP-hard in general, so the scheduler is a heuristic. It computes a lower bound (remaining credits vs. longest prerequisite chain) and only claims "no plan can finish sooner" when the plan matches that bound.
- **An AI coach that can't make things up about your degree.** A free AI API with live web search (Groq's gpt-oss-120b with browser search, or Google Gemini 2.5 Flash with Google Search, behind one small provider interface), called from a server route so the key never reaches the browser. If the free search allowance is busy, it answers without searching and says so. The browser sends only course codes; the server looks up real course names and strips any course the AI mentions that the student hasn't taken. Rate limiting and caching keep it inside the free tier.
- **One event model for the whole day.** Weekly classes expand into real meetings (holidays, cancellations and moves applied) and merge with tasks and events into a single calendar feed. The calendar, Home, conflict checks and reminders all read from it, so they never disagree. Conflict detection, task ranking, attendance and GPA forecasts are deterministic rules with unit tests — AI is only used to read deadlines out of documents (with an offline rule-based reader as the fallback) and for the project coach.
- **Honest by design:** no invented campus map or walking times, no assumed attendance or repeat-course policy (the student enters their university's rule), uncertain imported dates are flagged, and reminders are described as working while the app is open.
- **Local-first storage:** versioned, validated `localStorage` with a migration from the previous format, backups if saved data can't be read, export/import of everything, and data kept separate per profile and major.
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
- Reminders that arrive when the browser is closed (web push needs a small server and a database).
- Verified campus maps and indoor routes, through the campus registry that's already in place.
- Authorised university integrations (timetables, deadlines, official events), if a university offers them.
- Optional accounts and cross-device sync, migrating from the existing local data.
- Minimum-grade rules in the GPA, once the university's policy on them is verified.
- Shareable read-only plans for advisors.
- Let the AI Coach also explain the planner's own results in plain language (without ever overriding them).

## Built with

Next.js, React, TypeScript, Tailwind CSS, Radix UI, Lucide, React Flow, dagre, Zod, Zustand, Sonner, unpdf, Groq API (gpt-oss-120b), Google Gemini API, Vitest, Playwright, axe-core.

## AI usage disclosure

We used **Claude (Anthropic) via Claude Code** heavily: it wrote most of the code, tests and documentation from our specification and the official study plan PDFs we provided, and it transcribed the curricula, which we then **[TEAM — describe how you reviewed the data and code]**. At runtime, only the AI Coach and the optional AI deadline reader use AI (gpt-oss-120b on Groq, or Google Gemini 2.5 Flash); course rules, planning, simulations, GPA and forecasts, attendance, conflict detection, task ranking and reminders are all deterministic code.

## Links

- Repository: https://github.com/bilal-feroz/Unipath
- Live demo: https://unipath-eight-peach.vercel.app
- Demo video: **[TEAM — add video URL]**
