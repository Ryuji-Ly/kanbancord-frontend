---
title: Feature suggestions, label progress and reminder times
date: 2026-10-30
---
- **KanbanCord notices when a board does a feature by hand** and suggests the feature that does it for you: tags like `[M]` or `[Bug]` at the start of titles suggest labels, `[E]`, `P1` or "high prio" suggest priorities, deadlines written into titles suggest due dates, and names on tasks suggest assignees. On the website the suggestion shows above the board; in Discord it is a private tip after `/task create` or `/task edit`, at most once a day. Anyone with Manage Server can switch the feature on with one click; everyone else is told who can. Dismiss a suggestion and it does not come back for that board. Nothing is ever switched on by itself.
- New guide: [switching on features](/guides/features-and-simple-mode), in Discord and on the website, and keeping one board simple.
- **How far a label is.** Filter a board by a label on the website and a line says how many of its tasks are done (in the last column, or archived) and who still has open ones. In Discord, `/label list` shows the same for every label.
- **Reminder times before a due date.** Reminders no longer only come a day before: a server can choose up to five times, from 5 minutes to 30 days before (`/kanbancord reminders`, or Server settings → Notifications), and a board can have its own (`/board reminders`, or its settings).
- **Your own reminder times.** Anyone can choose their own times for every board or for one, which replace the board's for their own direct messages: `/notifications reminders:`, Settings → Notifications on the website, or a board's ⋯ menu → Your reminders.
- When several times have passed at once, for a task made due in two hours, only the latest is sent. Everyone is still reminded once a task is overdue.
