---
title: Updates without downtime, and /ping
date: 2026-10-28
---
- **New versions no longer interrupt you.** The website and the API now switch to a new version only once it is running and healthy, so updates happen without the short outage they used to cause, and a broken version never goes live. The bot still restarts in a few seconds.
- **`/ping`** shows how fast KanbanCord answers: its connection to Discord, a request to Discord and back, and KanbanCord's API, each marked good, so-so or slow, with how long the bot has been up.
- The bot's status now shows in the member list again, with the number of servers, boards and tasks it keeps track of.
- Long board names without spaces wrap inside their card instead of pushing the menu button out of it.
