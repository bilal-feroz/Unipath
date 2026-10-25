# UniPath architecture

## Goals that shaped the design

1. **Simple for students.** Four destinations (Overview, My Courses, Semester Planner, Degree Map); everything else lives in a settings menu or a detail panel.
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
| State | `src/lib/state` | Profiles (`personal`, `demo`), per-curriculum progress, preferences. Versioned schema, migrations hook, corrupted-data backups. |
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

## GPA tracker

`src/lib/gpa` holds grading scales as data (only scales transcribed from an official source; AAU's undergraduate scale today) and a pure `computeGpa` (credit-weighted grade points ÷ graded credits, rounded to two decimals, rated with the official bands). Grades live in each curriculum's saved progress, next to completed courses.

## "Taking now"

Courses marked as taken this semester are stored separately from completed ones. Progress and GPA use completed courses only; eligibility, the next-semester recommendation, the roadmap and insights use completed + in-progress (assuming they're passed), because those all look ahead to next semester.

## AI Coach

The only server code and the only use of AI at runtime.

```
browser (codes only) → POST /api/coach → zod validation → curriculum lookup → prompt → Gemini 2.5 Flash + Google Search
                                                                                     ↓
browser ← normalized ideas / answer + web sources ← JSON extraction, code filtering, length caps
```

- The key (`GEMINI_API_KEY`) is read only in the route handler; the handler itself (`src/lib/coach/handler.ts`) takes the key and `fetch` as parameters so it can be tested without a network.
- The prompt is built from course titles the server looks up, so a client can't inject arbitrary "courses". Free text (interests, questions) is length-limited and stripped of control characters.
- Output is parsed leniently (fences, stray prose) and normalized; `buildsOn` keeps only codes from the student's own list; sources keep only http(s) links. React escapes all text.
- Free-tier protection: per-visitor sliding-window limit, a per-instance daily cap, and a 30-minute cache of identical idea requests; the browser keeps the last ideas in localStorage.

## Testing

- `src/**/*.test.ts` (Vitest): parser, AND/OR logic, credit thresholds, notes, corequisites, validation errors, progress and elective capping, status, targets, roadmap validity for every bundled major at several loads (replayed to check prerequisites, caps and completeness), determinism, scenario isolation, persistence, demo data.
- `e2e/` (Playwright, production build): onboarding, refresh persistence, updating recommendations, locked-course explanations, what-if + reset, switching majors, degree map highlighting, axe accessibility scans, mobile navigation and no horizontal scroll.
