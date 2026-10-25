# UniPath

**Your degree, your day, your direction.**

UniPath is a university student's companion for every day of the degree. Open it in the morning and it tells you what classes you have today and where, what's due and what clashes, how your attendance and GPA are looking, and whether you're on track to graduate. Underneath, it turns your university's static study plan into a personal roadmap: what you can take next semester, what's blocking you, and how choices like a lighter workload change your graduation date.

Built for **NextSpark Hacks 2026**. No account and no paid services. Everything runs in the browser and is saved on your device; the optional AI features (project ideas, and reading deadlines out of a course outline) use a free AI API (Groq, or Google Gemini).

**Live demo: https://unipath-eight-peach.vercel.app** — click **Try Demo** to explore a sample student.

![UniPath overview for the sample student](docs/screenshots/desktop-overview.png)

| Semester roadmap | What if? | Phone |
| --- | --- | --- |
| ![Roadmap](docs/screenshots/desktop-roadmap.png) | ![What-if simulator](docs/screenshots/desktop-what-if.png) | ![Overview on a phone](docs/screenshots/mobile-overview.png) |

> UniPath is an independent student project. It is not affiliated with or endorsed by Al Ain University. Course data is transcribed from publicly available study plans and may contain mistakes — always confirm your plan with your academic advisor.

---

## The problem

Degree requirements usually live in PDFs and tables. They don't know what *you* have already passed, so students have to work out by hand:

- which courses they still need, and which ones are blocked by prerequisites,
- what they can register for next semester,
- whether delaying or failing a course pushes back graduation,
- how many semesters are left.

## What UniPath does

### Your day

| Screen | What you get |
| --- | --- |
| **Home** | *"Good morning — you have 3 classes today."* The next class with a countdown, room and **Find classroom**; today's classes with their status (upcoming, in progress, completed, cancelled); **today's priorities**, ranked; upcoming deadlines; the next 7 days; an academic snapshot (CGPA, predicted CGPA, credits, estimated graduation, this semester's courses); and alerts. An optional, skippable setup checklist helps new students fill things in. |
| **Timetable** | Weekly lectures, labs and tutorials (several per course), professor, building, floor and room; semester dates and holidays; cancel or move a single meeting; makeup classes; overlap warnings. Courses marked *Taking now* are suggested. |
| **Calendar** | Month, week and day views of everything — classes, deadlines, exams and events — colour-coded, filterable by type and course, searchable, with conflicts marked. Click any date to see that day. |
| **Assignments and exams** | Assignments, projects, quizzes, midterms, finals, presentations and admin deadlines with course, weight, effort, steps and notes. Ranked automatically (with the reasons shown) or by your own priority; views for All, Due today, This week, Overdue and Completed. **Import deadlines** from pasted text or a PDF, with a review screen before anything is saved. |
| **Attendance** | Mark each class present, absent, late or excused; per-course percentages and allowed absences under **your university's rule** (none is assumed); "what if I miss the next class?", "how many can I still miss?" and "how many must I attend to reach X%?". |
| **CampusFlow** | Your next class and where it is, today's classes in order with tight building changes flagged, and a searchable directory of every building and room in your timetable, with your own notes and map links. |
| **University events** | Workshops, clubs, competitions, career fairs and academic dates you add (or sample ones in the demo), with *Add to calendar*. |
| **Notifications** | Reminders before classes, deadlines, exams and events (timing set by you), timetable changes, and alerts — each alert says what's wrong, why it matters, what it affects and what to do, and can be resolved, snoozed or dismissed. Browser notifications while UniPath is open. |

### Your degree

| Screen | What you get |
| --- | --- |
| **My Courses** | Every course with a clear status — Completed, Planned, Available, Locked — plus search, filters, one-line "why it's locked" reasons, and a detail panel (prerequisite checklist, what it unlocks, which requirement it counts toward). Ticking a course updates everything instantly, with Undo. |
| **Semester Planner** | A recommended next semester with a reason for every course; add/remove courses with clear explanations when something isn't allowed; a warning (with the reason) if your choices delay graduation; a semester-by-semester **roadmap**; **key courses** you shouldn't put off; and a **What if?** simulator. |
| **Degree Map** | An interactive prerequisite graph (zoom, pan, fit, search, filter, click to highlight everything before and after a course), plus a list view for phones and screen readers. |
| **GPA and forecast** | Your CGPA on Al Ain University's official 4.0 scale (A = 4.0 … D = 1.0, F = 0) with its official rating; semester GPA and a trend chart; failed and repeated courses counted by the repeat policy you choose; a **what-if forecast** with best, expected and worst grades for this semester's courses (clearly marked as predicted); the grades needed for a **target CGPA**; and which course moves your CGPA the most. |
| **AI Coach** | Portfolio project ideas built on the courses you've finished and the ones you're taking now, informed by a live web search for current industry practice — with sources, "first steps", and a follow-up chat. |

Courses can also be marked **Taking now**: they don't count as completed, but next semester is planned as if you pass them.

Also: guided onboarding, a **Try Demo** sample student, a frosted-glass design with dark and light themes (the dark colour oozes out of the theme toggle, and is sucked back into it when switching to light, using the View Transitions API), a landing page with smooth scrolling and scroll-driven animations (all disabled for visitors who prefer reduced motion), export/import of progress, printable roadmap, and an About page listing every data source and interpretation.

### Planning engine

All planning is deterministic and lives in [`src/lib/engine`](src/lib/engine), separate from the UI:

- **Prerequisite rules** support AND/OR combinations, minimum completed credit hours (e.g. internship ≥ 75), advisory conditions that can't be checked (department approval), corequisites, same-semester rules and minimum grades.
- **Next semester:** fills your credit limit with eligible courses, prioritising the longest remaining prerequisite chain, then courses with the most dependents, then the official suggested semester. A small "fill pass" swaps end-of-chain courses to use all available credits, so credit-hour thresholds open sooner.
- **Electives:** never picked on your behalf. Unchosen electives are open slots ("Major electives — your choice"); chosen electives pull in their own prerequisites.
- **Roadmap:** repeats the semester step until every requirement is met. It is a heuristic, so it only claims *"no plan can finish sooner"* when it can prove it: the plan's length equals a lower bound from your remaining credits and the longest prerequisite chain.
- **What if:** re-runs the same engine on a copy of your inputs (lighter/heavier load, summer terms, postponing a course, retaking a course) and explains the difference using the actual dependency graph. Your saved progress never changes unless you press **Apply**.
- **GPA:** credit-weighted SGPA and CGPA from AAU's official grade points ([source](https://www.aau.ac.ae/en/admission/undergraduate/course-grading-system)); Pass/Transfer grades aren't counted ([`src/lib/gpa`](src/lib/gpa)). The grading page doesn't say which attempt of a repeated course counts, so that's a visible setting ("every attempt" or "latest only"), never an assumption. Forecasts and targets reuse the same arithmetic; a displayed 3.80 means at least 3.795 before rounding.

### Schedule engine

Everything about the student's day is deterministic code in [`src/lib/schedule`](src/lib/schedule), with no AI:

- **One event model.** Weekly classes are expanded into meetings for the semester (holidays, cancellations, moves and makeup classes applied), then merged with tasks and events into one calendar feed ([`agenda.ts`](src/lib/schedule/agenda.ts)). The calendar, Home, conflict checks and reminders all read from it, so they always agree.
- **Time zone aware.** "Today" and "now" use the campus time zone (your device's by default, changeable in Settings).
- **Task ranking** ([`tasks.ts`](src/lib/schedule/tasks.ts)): deadline proximity, work left, the task's weight (or a typical weight for its type), progress and other deadlines that day, with the reasons shown. A priority you set yourself always wins.
- **Conflict rules** ([`conflicts.ts`](src/lib/schedule/conflicts.ts)): overlapping classes; exams at the same time or closer than your chosen gap; days with several deadlines; events that clash with a class; building changes tighter than the time you said you need; attendance near your limit; registration and payment deadlines coming up. Each alert explains itself and changes or disappears as soon as the underlying data does.
- **Attendance** ([`attendance.ts`](src/lib/schedule/attendance.ts)): percentages from marked meetings (excused ones excluded, late counted as you choose), allowances from your rule (a maximum number of absences or a minimum percentage), and forecasts.
- **Reminders** ([`reminders.ts`](src/lib/schedule/reminders.ts)): fire at the times you set per category, deduplicated, with read/unread state.
- **Deadline import** ([`extract.ts`](src/lib/schedule/extract.ts)): an offline rule-based reader for common date formats, or the AI reader for messy documents. Missing years, missing times and day/month ambiguity are flagged; uncertain items start unticked; nothing is saved until the student confirms.

### AI Coach

The coach (and the optional AI deadline reader, `POST /api/extract`, which shares its provider and rate limits) are the only parts of UniPath that use AI, and they never touch planning, GPA, attendance or conflict rules. The coach lives in [`src/lib/coach`](src/lib/coach) and the route handler `src/app/api/coach/route.ts`:

- **Model:** whichever free key the server has. With `GROQ_API_KEY` it uses **Groq** running **`openai/gpt-oss-120b`** with Groq's built-in **browser search** tool; with `GEMINI_API_KEY` it uses Google **Gemini 2.5 Flash** with the **Google Search** tool (the Gemini model whose free tier includes search). Either way, answers reflect current practice and come with web sources. Both providers sit behind one small interface ([`provider.ts`](src/lib/coach/provider.ts)), so adding another is one file.
- **Honest about search:** if the free search allowance is busy (Groq's free tier has a tokens-per-minute limit), the coach answers once more without searching and the page says so, instead of failing.
- **Key stays on the server:** the key is read only by the route handler; the browser never sees it. `GET /api/coach` tells the page which provider and model are in use (never the key), so the privacy note names them and links their data policy.
- **Grounded in real courses:** the browser sends only course codes; the server validates them against the curriculum, looks up the titles itself, and removes any course the AI mentions that isn't in the student's list.
- **Checked output:** the answer is parsed and normalized before it's shown; unreadable answers produce a clear error instead of broken UI.
- **Protects the free quota** ([`guard.ts`](src/lib/coach/guard.ts)): one request at a time per visitor; per-visitor limits (ideas: 4 per 10 minutes and 15 a day; questions: 5 a minute, 20 per 10 minutes and 60 a day); at most 4 AI calls in parallel per server; a per-provider cap kept under its free tier (Groq: 15 a minute, 450 a day); and when the provider itself says "slow down", every request pauses for as long as it asks (`Retry-After`). Limited answers carry `Retry-After`, and the page shows a countdown and re-enables the buttons when it ends. Identical idea requests are cached for 30 minutes (and don't count), and the browser remembers the last ideas. Limits are kept in memory per server instance, so they guard the free quota rather than act as a security boundary.

## Curriculum data

| Major | Credit hours | Status | Source |
| --- | --- | --- | --- |
| BSc Software Engineering | 124 | Transcribed from official study plan | [AAU study plan](https://engineering.aau.ac.ae/en/programs/bachelor-of-science-in-software-engineering) + Software Engineering Guidance Plan |
| BSc Computer Science | 123 | Transcribed from official study plan | [AAU study plan](https://engineering.aau.ac.ae/en/programs/bachelor-of-science-in-computer-science) + Computer Science Guidance Plan |
| BSc Cybersecurity | 123 | Transcribed from official study plan | [AAU study plan](https://engineering.aau.ac.ae/en/programs/bachelor-of-science-in-cybersecurity) + Cybersecurity Guidance Plan (2022) |

All three were transcribed by hand from public Al Ain University documents (retrieved 25 Oct 2026). **No illustrative or invented curricula are included.** Courses, credits and prerequisites come from each study plan; suggested semesters come from the guidance plans.

Where the documents disagree or reference courses that don't exist in the plan, UniPath records the interpretation as a visible data note (shown on the About page and on the affected course), for example:

- The Cybersecurity plan lists `0102320` as the prerequisite for Computer Forensics, but no such course is in the degree. UniPath shows it as "confirm with your advisor" rather than blocking the course.
- The Cybersecurity plan lists `0102431` as the prerequisite for Capstone Project II. UniPath assumes Capstone Project I comes first, as in the other engineering programs.
- Some guidance plans list courses that aren't in the study plan (or omit required ones). The study plan always wins.

Every bundled curriculum is validated at load time and in the test suite: required fields, duplicate codes, missing prerequisite references, circular prerequisites, invalid credits, requirement totals, impossible elective rules and unreachable credit thresholds. Curricula with errors are never offered to students.

### Adding a major or university

1. Add a JSON file in `src/data/curricula/<university>/` following the existing files (requirement groups containing courses; prerequisites in a small text format such as `0102221 & 0107200`, `(A & B) | D`, `credits>=60`, `[Department approval]`).
2. Register it in [`src/lib/curriculum/registry.ts`](src/lib/curriculum/registry.ts) (and add the university there if it's new).
3. Run `npm test` — the validator test fails if the data has problems.

No planning or UI code needs to change.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Radix UI primitives · Lucide icons · React Flow (`@xyflow/react`) + dagre for the degree map · Zod for data and saved-state validation · Zustand for state · Sonner for toasts · Groq API or Google Gemini API (AI Coach) · Vitest · Playwright + axe-core.

## Getting started

Requirements: **Node.js 20.9 or newer** (developed on Node 22) and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Click **Try Demo** for a pre-filled sample student, or **Start Planning** to set up your own plan.

### Turning on the AI Coach (optional, free)

Everything except the AI Coach works without any key.

1. Create a free API key at [Groq](https://console.groq.com/keys) (recommended) or [Google AI Studio](https://aistudio.google.com/apikey).
2. Add it to `.env.local` in the project folder (see `.env.example`):
   ```
   GROQ_API_KEY=your-key-here
   ```
   or `GEMINI_API_KEY=your-key-here`. If both are set, Groq is used unless `AI_PROVIDER=gemini`. (A Groq key saved under a different variable name is still found, because Groq keys start with `gsk_`.)
3. Restart `npm run dev`.

UniPath only sends the major, course names, and what the student types into the coach. [Groq says](https://console.groq.com/docs/your-data) it doesn't use API requests to train models; on Gemini's free tier, Google may use requests to improve its products.

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright; builds and starts the app on port 3100). Run `npx playwright install chromium` once first. |
| `npm run check` | Typecheck + lint + unit tests |

## Deployment

UniPath is a standard Next.js app with no database. The only server code is the two AI routes (`/api/coach` and `/api/extract`), which need one environment variable: `GROQ_API_KEY` (optional `GROQ_MODEL`, default `openai/gpt-oss-120b`) or `GEMINI_API_KEY` (optional `GEMINI_MODEL`, default `gemini-2.5-flash`). Without one, the coach shows a "not switched on yet" message and everything else works.

- **Vercel (free Hobby plan):** the live site at https://unipath-eight-peach.vercel.app is the Vercel project `unipath`, connected to this GitHub repository — every push to `main` redeploys it automatically. To set up your own copy, import the repository at vercel.com/new and keep the detected Next.js settings.
- **AI Coach on Vercel:** in the Vercel dashboard open the `unipath` project → **Settings → Environment Variables**, add `GROQ_API_KEY` (or `GEMINI_API_KEY`) for Production (and Preview if you like), then redeploy (or push any commit).
- **Anywhere else:** `npm run build && npm start` on Node 20.9+.

## Saving and privacy

Progress, grades, timetable, tasks, events and attendance are stored only in the browser's `localStorage` (versioned and validated with Zod). They never leave the device (except as described for the AI features below), so they're lost if browser data is cleared — use **Export progress** in the settings menu to keep a copy; the export includes everything. Unreadable saved data is never silently discarded: UniPath keeps a backup copy in the browser and tells the student. Saves from older versions are migrated step by step (v1 → v2 added the semester schedule without touching courses or grades). Degree progress and the semester schedule are stored per profile and per major, so the demo student, your own plan and different majors never mix. There is no cloud sync or multi-device support.

The AI features send data only when the student presses a button: the **AI Coach** sends the major, the codes of completed and in-progress courses, and any interests or questions typed; the **AI deadline reader** sends the text being imported (PDFs are turned into text in the browser first). Grades, attendance, names and saved files are never sent. The offline deadline reader sends nothing.

## Limitations

- Eligibility is not availability: UniPath has no section, timetable or seat data.
- Graduation estimates assume courses are offered when planned and passed on the first attempt (except in "retake" simulations).
- Failed and repeated courses count in the GPA only when the student records them, under the repeat policy they choose; academic warning/probation rules aren't modelled.
- **Reminders only reach you while UniPath is open** (in-app and browser notifications). There's no push server, so nothing arrives when the browser is closed.
- **No university system integration:** timetables, deadlines and events are entered or imported by the student; nothing syncs with a university portal.
- **No campus map:** UniPath has no verified map of the campus, so CampusFlow works from the rooms in your timetable and your own notes, and never estimates walking times. The campus registry ([`src/lib/campus`](src/lib/campus)) is ready for verified maps.
- The deadline reader handles pasted text and PDFs with real text; screenshots and scanned pages aren't supported.
- Attendance rules, travel time between buildings and exam gaps are settings the student enters; UniPath doesn't know the university's policies.
- Transfer credit and equivalencies aren't tracked. Department approvals are shown but not checked.
- AI Coach suggestions can be wrong or out of date, and the free Groq and Gemini tiers have per-minute and daily limits.
- Summer credit limits and maximum loads are user settings — check your university's rules.
- Only Al Ain University's Software Engineering, Computer Science and Cybersecurity plans are loaded.
- Transcription errors are possible.

## Project structure

```
src/
  app/                    routes: landing, /start, /demo, /about, (app)/overview|courses|planner|map|gpa|coach|
                          timetable|calendar|tasks|attendance|campus|events|notifications|settings, api/coach, api/extract
  components/             UI, grouped by screen (app-shell, courses, planner, map, gpa, schedule, onboarding, landing, ui)
  data/curricula/aau/     curriculum JSON files
  lib/curriculum/         types, schema, prerequisite parser, validation, registry
  lib/engine/             progress, eligibility, targets, scheduler, insights, simulation, terms
  lib/gpa/                grading scales, CGPA, semester GPA, repeat policies, forecasts and targets
  lib/schedule/           timetable, calendar feed, tasks, conflicts, attendance, reminders, priorities, deadline import
  lib/campus/             verified campus maps (none yet)
  lib/coach/              AI coach: request schema, prompts, Groq and Gemini clients, output parsing, rate limiting
  lib/state/              persisted-state schema, persistence, demo student, store
  lib/plan.ts             derives everything a screen needs from saved progress
e2e/                      Playwright tests
docs/ARCHITECTURE.md      design decisions
```

## Team

| Member | Contributions |
| --- | --- |
| Bilal Feroz | _[add contributions]_ |
| Faheem Abdul Azees | _[add contributions]_ |

## AI assistance disclosure

This project was built with substantial help from **Claude (Anthropic)** via Claude Code, which wrote most of the code, tests and documentation from the team's specification and the official study plan PDFs the team supplied. The team directed the work, chose the scope, and is responsible for reviewing it.

At runtime, only the **AI Coach** and the optional **AI deadline reader** use AI (Groq's `gpt-oss-120b`, or Google Gemini 2.5 Flash). Course eligibility, next-semester recommendations, graduation estimates, simulations, GPA and forecasts, attendance, conflict detection, task ranking and reminders all come from deterministic code.

See [CREDITS.md](CREDITS.md) for all libraries and sources.
