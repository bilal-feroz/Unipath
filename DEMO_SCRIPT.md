# UniPath — demo script (about 2 minutes)

Uses the built-in sample student, so there's nothing to set up. Numbers below are what the demo shows when the "next semester" is **Spring 2027** (the default when demoing between August and December 2026). In other months the term names shift, but the logic and the story are the same.

**Before you start:** open the app in a fresh browser window (or use *Settings → Reset sample student*) so the demo starts clean. Dark theme is the default.

| Time | Screen | Do | Say |
| --- | --- | --- | --- |
| 0:00 | Landing | Point at the headline and the live preview. | "University study plans are PDFs. They don't know what you've already passed. UniPath turns them into a personal roadmap. The preview here isn't a screenshot — it's the real planner running on a sample student." |
| 0:12 | Landing | Click **Try Demo**. | "No sign-up and no API keys. This is a Software Engineering student at Al Ain University, three semesters in, who hasn't taken Calculus II yet." |
| 0:20 | Overview | Point at **49 of 124 credit hours**, then **Spring 2029**. | "In seconds they see where they stand and when they could graduate. It's labelled as an estimate — and UniPath only says *no plan can finish sooner* when it can prove it mathematically." |
| 0:35 | Overview | Point at the **Helpful insight**. | "One insight, computed from the prerequisite graph: taking Software Requirements and Specification next semester unlocks two more courses." |
| 0:45 | My Courses | Click **Locked**. Point at *Computer Ethics — Needs 60 credit hours (you have 49)*. | "Every locked course says exactly what it's waiting for — including credit-hour rules from the official plan." |
| 0:55 | My Courses | Tick **Calculus II**. | "Ticking a course updates everything instantly. The toast tells you what just opened up — Introduction to Numerical Methods — and there's Undo." Click **Undo**. |
| 1:05 | Semester Planner | Open **Semester Planner**. | "Here's the recommended next semester. Every course explains why: this one is the first step in a chain of four courses, this one is needed before Operating Systems." |
| 1:15 | Planner | Click **Add a course**, then **Why?** next to a locked course. | "If you try to plan something you can't take yet, UniPath tells you what to finish first instead of failing silently." Close the dialog. |
| 1:25 | What if? | Open the **What if?** tab and click **Lighter load (12 credits)**. | "What if I only take 12 credits? Graduation moves from Spring 2029 to Spring 2030, and it tells me why — 75 credit hours at 12 per semester needs at least seven semesters." |
| 1:40 | What if? | Click **Study in summers**. | "Adding summer terms moves it the other way, to Fall 2028." Click **Reset simulation**. "And none of this touched my saved plan." |
| 1:50 | Degree Map | Open **Degree Map**, click **Software Design and Development**. | "The degree map shows how everything connects. Click a course and it lights up what you need first and what it leads to." |
| 2:00 | — | — | "UniPath is deterministic, built on the official study plans, works on any phone, and adding a new major is just a data file. Your degree, your direction." |

## Backup lines if asked

- **"Is it AI?"** No. Every recommendation comes from a deterministic engine with unit tests. The same inputs always give the same plan.
- **"Is the data official?"** It's transcribed from Al Ain University's public study plans, validated automatically, and every place the documents disagree is listed on the About page. UniPath isn't affiliated with the university.
- **"Does eligible mean I can register?"** No — UniPath doesn't have section or seat data, and the planner says so.
- **"What about a different major?"** Settings → Switch major. Computer Science and Cybersecurity are loaded too; each major's progress is kept separately.

## Optional extra (if time allows)

- **GPA:** open **GPA** — the sample student has a CGPA of **3.45 (Very Good)** on AAU's official scale. Change Computer Skills from A to B and it drops to 3.39 instantly.
- **AI Coach** (needs `GROQ_API_KEY` or `GEMINI_API_KEY` on the server): in **My Courses**, press the hourglass next to Software Requirements and Specification to mark it as *taking now*, then open **AI Coach** → **Get project ideas**. Point out the "Builds on" chips (real courses from the plan), the industry practices, and the web sources. Ask a follow-up like "Which one should I start with?".

- In What if, choose **Postpone a course → Software Requirements and Specification → by 2 semesters**: graduation moves from Spring 2029 to Fall 2029, because five later courses depend on it.
