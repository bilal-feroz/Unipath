# UniPath — demo script (about 2½ minutes)

Uses the built-in sample student, so there's nothing to set up. The sample semester is generated around the day you demo: there are always classes today, deadlines this week and a few conflicts to find. All classes, rooms, people, deadlines and events in the demo are made up and marked as sample data.

**Before you start:** open the app in a fresh browser window (or use *Settings → Reset sample student*). Dark theme is the default. Demo in the morning or early afternoon if you can, so today's classes are still ahead.

| Time | Screen | Do | Say |
| --- | --- | --- | --- |
| 0:00 | Landing | Point at the headline. | "Students juggle a timetable, deadlines, exams, attendance rules, GPA and a degree plan in five different places. UniPath puts their day and their degree in one." |
| 0:10 | Landing | Click **Try Demo**. | "No sign-up. This is a sample Software Engineering student at Al Ain University, in their fourth semester." |
| 0:15 | Home | Point at the greeting and **Your next class**. | "Open it in the morning: how many classes today, the next one with a countdown, the room — and **Find classroom**." |
| 0:30 | Home | Point at **Today's priorities**. | "Then what actually needs attention, ranked: an overdue homework, registration closing, a Database assignment worth 15% due tomorrow. Each one says why it's ranked there." |
| 0:45 | Home | Point at **Worth knowing** (two exams at the same time). | "UniPath doesn't just show information — it finds problems. Two midterms overlap on the same morning. It says what's wrong, why it matters, and what to do." |
| 0:55 | CampusFlow | Click **Find classroom** (or Campus → CampusFlow). | "Today in order — and a warning: five minutes to get from Building B to Building C. That's the travel time the student set, not a guess." |
| 1:05 | Calendar | Schedule → **Calendar**. Click a day. | "Classes, deadlines, exams and events in one calendar, colour-coded, with clashes marked. Click any day to see everything on it." |
| 1:15 | Assignments | Schedule → **Assignments and exams** → **Import deadlines**. Paste: *Database Systems Assignment 3 is due on November 30 at 11:59 PM.* → **Find dates**. | "Students shouldn't type every deadline. Paste a course outline or pick a PDF, and UniPath finds the dates — and flags what it's unsure of, like the missing year. Nothing is saved until you check it." Add it. |
| 1:35 | Attendance | Open **Attendance**. | "Attendance per course, under the student's own rule — UniPath doesn't assume a university policy. Data Structures is close to the limit, and the forecast says how many classes they can still miss." |
| 1:50 | GPA | Academics → **GPA and forecast**. | "CGPA 3.45 on the official scale. Pick expected grades for this semester and see the predicted CGPA — best, expected, worst — clearly marked as a prediction. Type a target and it tells you the grades you'd need." |
| 2:10 | Planner | Academics → **Semester Planner** → **What if?** → **Lighter load (12 credits)**. | "And the degree side is still there: what to take next semester, and what happens to graduation if you lighten your load." |
| 2:25 | — | — | "Every number here is deterministic code — GPA, attendance, conflicts, priorities. AI is only used where it helps: reading deadlines out of documents and suggesting portfolio projects. Your degree, your day, your direction." |

## Backup lines if asked

- **"Is it AI?"** Planning, GPA, attendance, conflicts and priorities are deterministic code with unit tests. AI only reads documents (optional — there's an offline reader) and powers the project coach.
- **"Does it connect to the university portal?"** No. There's no authorised integration, so timetables and deadlines are entered or imported by the student. UniPath never claims otherwise.
- **"Does it send reminders when the browser is closed?"** No — reminders work while UniPath is open. Closed-browser push would need a server, which is on the roadmap.
- **"Is the campus map real?"** There's no verified campus map yet, so CampusFlow uses the rooms in your timetable and your own notes, and never invents walking times.
- **"Where's my data?"** In this browser only. Export it any time from the settings menu.

## Optional extra (if time allows)

- **Timetable:** Schedule → Timetable shows the week grid; open a class meeting from the calendar to **cancel** or **reschedule** just that one — the conflict checks update straight away.
- **Events:** Campus → University events → **Add to calendar** on the sample career fair.
- **AI Coach** (needs `GROQ_API_KEY` or `GEMINI_API_KEY` on the server): **Get project ideas** — project ideas built on the courses taken so far, with current industry sources.
- **Degree Map:** Academics → Degree Map, point at a course to light up everything it needs and unlocks.
