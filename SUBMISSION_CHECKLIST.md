# NextSpark Hacks 2026 — submission checklist

Legend: ✅ done in the repository · ⬜ needs the team

## Required

- ✅ **Public GitHub repository** — https://github.com/bilal-feroz/Unipath (⬜ confirm the repository visibility is set to *Public* in GitHub settings)
- ✅ **Setup instructions** — README → *Getting started*. Verified locally: `npm install`, `npm run build`, `npm start`, plus the full test suites.
- ⬜ **1–3 minute demo video** — follow [DEMO_SCRIPT.md](DEMO_SCRIPT.md), record, upload (e.g. YouTube unlisted), add the link to DEVPOST.md.
- ✅ **At least one screenshot** — `docs/screenshots/` (desktop and mobile captures of every screen, regenerate with `SCREENSHOTS=1 npx playwright test screenshots`).
- ✅ **Project description** — [DEVPOST.md](DEVPOST.md) draft. ⬜ Fill in every **[TEAM]** placeholder (inspiration, personal challenges, what you learned, data review).
- ✅ **Technologies and AI disclosure** — README, DEVPOST.md and CREDITS.md.

## Optional

- ✅ **Working deployment URL** — https://unipath-eight-peach.vercel.app (Vercel project `unipath`; redeploys automatically on every push to `main`)
- ⬜ **AI Coach on the live site** — add a free `GROQ_API_KEY` (or `GEMINI_API_KEY`) in Vercel → `unipath` → Settings → Environment Variables, then redeploy. Without it the coach shows a "not switched on yet" message.
- ⬜ **Team contributions** — fill in the table in README.md and `team` in `src/lib/site.ts` (shown in the footer).

## Before submitting

- ⬜ Run `npm run check` and `npm run test:e2e` one last time.
- ⬜ Spot-check a few courses in the app against the official PDFs.
- ✅ Deployed site checked on desktop and phone sizes (demo, planner, what-if, map, theme toggle; no console errors).

## Known incomplete or out-of-scope features

These are intentionally not built; none of them are claimed in the UI:

- Academic standing (warning/probation) alerts
- Reminders when the browser is closed (no push server; reminders work while UniPath is open)
- University portal integration (timetables, deadlines and events are entered or imported by the student)
- A verified campus map, indoor navigation or walking-time estimates (CampusFlow uses the student's own timetable rooms and notes)
- Reading deadlines from screenshots or scanned PDFs (text and text PDFs only)
- Accounts and cross-device sync
- Shareable plan links
- AI explanations of the planner's own results (the AI Coach covers project ideas only)
- Section/timetable/seat availability
- Majors beyond Software Engineering, Computer Science and Cybersecurity at Al Ain University
- Grade and minimum-grade tracking
