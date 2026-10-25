# UniPath architecture

## Goals that shaped the design

1. **Simple for students.** Six top-level destinations (Home, Academics ▾, Schedule ▾, Campus ▾, Attendance, AI Coach), grouped so the bar never grows; phones get four tabs plus "More". Settings live in a menu or on the page they affect.
2. **Correct before clever.** Academic rules are computed by a deterministic engine with unit tests, never by UI code or a language model.
3. **University-independent.** A curriculum is data. Adding a major means adding a JSON file.
4. **No backend.** Hackathon-friendly, free to host, private by default.

## Layers

```
data (JSON)  →  curriculum (schema, parser, validation, registry)  →  engine (pure functions)
                                                                         ↓
                         state (zustand + versioned localStorage)  →  lib/plan.ts (derived view)  →  UI
```

| Layer | Location | Notes |
| --- | --- | --- |
| Curriculum data | `src/data/curricula` | Mirrors the source documents: requirement sections containing courses. |
| Schema + loader | `src/lib/curriculum/schema.ts`, `load.ts` | Zod validates shape; the loader flattens courses and parses prerequisite rules. |
| Prerequisite rules | `src/lib/curriculum/prereq.ts` | A tiny grammar (`&`, `\|`, parentheses, `credits>=N`, `[note]`, `~` same-semester, `{grade}`) parsed into an expression tree. |
| Validation | `src/lib/curriculum/validate.ts` | Duplicates, missing references, cycles (DFS), credits, group totals, impossible electives, unreachable thresholds. |
| Registry | `src/lib/curriculum/registry.ts` | Only curricula with zero errors are offered. |
| Engine | `src/lib/engine` | Progress, course status, targets (what's left, incl. elective slots), scheduler (roadmap), insights, simulation, academic terms. All pure and deterministic. |
| State | `src/lib/state` | Profiles (`personal`, `demo`), per-curriculum progress (incl. grades, grade semesters, earlier attempts, forecasts), per-curriculum semester schedules, preferences and life settings. Versioned schema (v2) with step-by-step migrations and corrupted-data backups. |
| Schedule engine | `src/lib/schedule` | Class meetings, the unified calendar feed, task ranking, conflict rules, attendance, reminders, today's priorities, deadline extraction. All pure and deterministic; "now" is passed in. |
| Campus | `src/lib/campus` | Registry for verified campus maps (empty for AAU until one is transcribed). |
| View model | `src/lib/plan.ts` | One function turns saved progress into everything a screen needs. |
| UI | `src/components`, `src/app` | Client components inside a browser-only boundary, because progress lives in localStorage. |

## Key decisions

- **Course prerequisites vs degree requirements are separate models.** Prerequisites are expression trees on courses; degree requirements are groups (`all` or `choose N credits`). A course can be allowed but not needed (an extra elective), or needed but not allowed yet.
- **Electives as slots.** UniPath doesn't choose electives for students. The scheduler reserves an elective slot that can be filled by any eligible option; once a student picks a course it becomes concrete and its prerequisites are planned. If no option could ever be eligible, the engine commits to the cheapest option (fewest extra credits) so the plan stays reachable.
- **Heuristic scheduling, honestly labelled.** Scheduling with prerequisites and credit caps is NP-hard in general. The scheduler is a critical-path-first list scheduler (longest chain, then number of dependents, then official semester), plus a fill pass. It computes a lower bound (`max(credit bound, longest chain)`) and only claims "fastest possible" when the plan meets it. For all three bundled majors at 18 credits it does.
- **Same-semester prerequisites are not assumed.** A prerequisite counts only if completed in an earlier semester, unless the rule is marked `~`.
- **Credit-hour thresholds** (e.g. internship ≥ 75) use credits earned before the semester begins.
- **Simulation isolation.** Simulations call the same pure functions on copies of the input; tests freeze the inputs to prove nothing is mutated.
- **Progress per curriculum.** Switching majors keeps each major's progress separate; copying identical course codes is an explicit, opt-in action.
- **Never discard saved data silently.** Unreadable or newer-version data is copied to a backup key and the student is told.
- **Browser-only rendering.** App screens render inside a React `use(browser())` boundary so the server never renders stale or mismatched progress. These routes opt out of Next.js instant-navigation validation (`export const instant = false`) because there is no server-rendered content to validate.

## GPA tracker and forecast

`src/lib/gpa` holds grading scales as data (only scales transcribed from an official source; AAU's undergraduate scale today, including F = 0) and pure functions. `computeGpa` is the original passed-courses calculation. `forecast.ts` builds every graded attempt into entries (final grades, earlier attempts, forecast grades), applies the student's repeat policy (`all` attempts or `latest` only — AAU's page doesn't say, so it's a setting), and sums them: SGPA per semester, CGPA after each semester, a forecast from expected grades, the average needed for a target (a displayed 3.80 means ≥ 3.795 unrounded), and per-course impact. With no attempts recorded, the result equals `computeGpa`, so existing saved grades show the same CGPA after the upgrade.

## Semester schedule

One model drives the whole day:

```
sessions (weekly) + exceptions + extras + term/holidays ─→ class meetings ─┐
tasks (deadlines, exams) ──────────────────────────────────────────────────┼─→ agenda items ─→ calendar, Home,
events (repeating or one-off) ─────────────────────────────────────────────┘        ↓         CampusFlow
                                                                      conflict rules, reminders, priorities
```

- **Meetings** are generated for the whole semester and keyed `sessionId@originalDate`, so a moved class keeps its attendance and its alerts follow the new time. Cancelled and holiday meetings stay in the feed, marked, so they can be shown and excluded from attendance.
- **Conflicts** are recomputed from current data on every change. Alert ids encode the items and their times, so dismissing sticks while nothing changes, and editing a time clears or replaces the alert. Dismissed/resolved/snoozed state is stored per schedule.
- **Thresholds are the student's**: travel time between buildings, minimum gap between exams, deadlines per day, admin warning window, attendance rule. No university policy is assumed.
- **Time zone:** `zonedNow(now, zone)` turns an instant into the campus date and minutes via `Intl`, so "today" is right even when the device is elsewhere.
- **Reminders** are derived (not scheduled): each render computes which reminders are due under the student's offsets; ids are stable, so read state and browser delivery happen once. Browser notifications fire only while a tab is open — there's no push server.
- **Deadline import:** the offline reader (`extract.ts`) and the AI reader (`/api/extract`, sharing the coach's provider and rate limiter, search off) both produce the same `ExtractedItem` shape with flags (no year, no time, ambiguous day/month, no course, past date). The server checks that each AI quote appears in the submitted text. PDFs are converted to text in the browser with unpdf.
- **Demo data** is generated relative to the current date (and regenerated daily) so the sample student always has classes today and something to show.

## "Taking now"

Courses marked as taken this semester are stored separately from completed ones. Progress and GPA use completed courses only; eligibility, the next-semester recommendation, the roadmap and insights use completed + in-progress (assuming they're passed), because those all look ahead to next semester.

## AI Coach

The only server code and the only use of AI at runtime.

```
browser (codes only) → POST /api/coach → zod validation → curriculum lookup → prompt → AiProvider.call()
                                                                                     ↓
                                              Groq gpt-oss-120b + browser_search  |  Gemini 2.5 Flash + Google Search
                                                                                     ↓
browser ← normalized ideas / answer + web sources ← JSON extraction, code filtering, length caps
```

- **Providers** implement one interface (`src/lib/coach/provider.ts`): `call({ system, turns, search })` returns text, sources, search queries and whether a search actually ran. `config.ts` picks Groq when `GROQ_API_KEY` is set, otherwise Gemini when `GEMINI_API_KEY` is set; `AI_PROVIDER` forces one.
- **Groq specifics** (`groq.ts`): OpenAI-compatible chat completions with the built-in `browser_search` tool (`tool_choice: "required"` for ideas, `"auto"` for questions). Browser search can't be combined with structured outputs, so JSON is requested in the prompt and parsed like Gemini's; inline citation markers (`【…】`) are stripped. If a search request is too large for the free tier's tokens-per-minute limit, it retries once without the tool and reports `searched: false`, which the page shows.
- The key is read only in the route handler; the handler itself (`src/lib/coach/handler.ts`) takes a provider object (built with an injectable `fetch`) so it can be tested without a network. `GET /api/coach` returns the provider's name, model and privacy link, never the key.
- The prompt is built from course titles the server looks up, so a client can't inject arbitrary "courses". Free text (interests, questions) is length-limited and stripped of control characters.
- Output is parsed leniently (fences, stray prose) and normalized; `buildsOn` keeps only codes from the student's own list; sources keep only http(s) links. React escapes all text.
- Free-tier protection (`guard.ts`, built from the small limiters in `rate-limit.ts`): a pause when the provider returns 429 (for its `Retry-After`), one in-flight request per visitor, multi-window sliding limits per visitor (separate for ideas and questions), a server-wide parallel cap, and per-provider minute/day caps under the free tier. A request only counts when it is let through, and its in-flight slot is freed even if the AI call fails. Errors carry `retryAfterSeconds` and a `Retry-After` header; the page counts down and disables the buttons. Plus a 30-minute cache of identical idea requests, and the browser keeps the last ideas in localStorage.

## Testing

- `src/**/*.test.ts` (Vitest): parser, AND/OR logic, credit thresholds, notes, corequisites, validation errors, progress and elective capping, status, targets, roadmap validity for every bundled major at several loads (replayed to check prerequisites, caps and completeness), determinism, scenario isolation, persistence, demo data.
- `e2e/` (Playwright, production build): onboarding, refresh persistence, updating recommendations, locked-course explanations, what-if + reset, switching majors, degree map highlighting, axe accessibility scans, mobile navigation and no horizontal scroll.
