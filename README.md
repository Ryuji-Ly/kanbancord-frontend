# KanbanCord website

**KanbanCord** is a free kanban board for Discord: a Trello-style task board and shared to-do list that lives in your
Discord server. Teams, clubs, study groups and game-dev communities plan their work where they already talk: create
tasks, move them across columns, assign people and roles, set due dates, labels and priorities, and get updates in
their channels, without leaving Discord.

This repository is the **website**, live at **[kanbancord.com](https://kanbancord.com)**. Everyday work happens in
Discord through the bot; the website is there for the big picture and the finer settings.

| Repository | What it is |
| --- | --- |
| [kanbancord-bot](https://github.com/Ryuji-Ly/kanbancord-bot) | The Discord bot: slash commands, buttons, board posts, update feeds and direct messages. |
| **kanbancord-frontend** (this one) | The website at [kanbancord.com](https://kanbancord.com). |
| [kanbancord-api](https://github.com/Ryuji-Ly/kanbancord-api) | The API both of them use: boards, tasks, permissions and notifications. |

**Try it:** sign in at [kanbancord.com](https://kanbancord.com) with Discord, or join the
[support server](https://discord.gg/SDr4ujFPGR).

## What the website does

- **Whole boards on one screen**: every column and task, with drag and drop, search and filters by label, priority,
  assignee and due date. Changes appear live for everyone, in Discord too.
- **Tasks in full**: descriptions with checklists, images and videos, assignees, labels, priorities, due dates and
  comments.
- **Settings for each server and board**: features and simple mode, labels and priority levels, update feeds and what
  they post and mention, task threads, and the audit log of every change.
- **Permissions**: rules per role, per person and per board, and **Check access**, which shows what anyone may do and
  which rule decides it.
- **Your preferences**: notification choices, themes and accessibility options.
- **Public pages and guides**: the [guides](https://kanbancord.com/guides), [FAQ](https://kanbancord.com/faq),
  privacy policy and terms, prerendered as plain HTML so they load fast and search engines can read them.

## Stack

React 19 · TypeScript · Vite · TanStack Query · SCSS. Pages are prerendered at build time; the app itself is a
single-page app served by nginx.

## Running it locally

You need Node.js 22, and the [API](https://github.com/Ryuji-Ly/kanbancord-api) running for anything past the public
pages.

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev
```

| Variable | |
| --- | --- |
| `VITE_API_BASE_URL` | Where the API runs. Leave empty to use the dev server's proxy to `http://localhost:8080`. |
| `VITE_DISCORD_CLIENT_ID` | The Discord application's client ID, for signing in and the "Add to Discord" links. |
| `VITE_DISCORD_REDIRECT_URI` | Where Discord sends you back after signing in; `http://localhost:5173` locally. |
| `VITE_DISCORD_SCOPES` | The OAuth scopes: `identify guilds`. |

**Without an API or Discord application:** `npm run demo` runs the website with made-up example data (a game jam
community with a few boards), so you can click through every screen.

```bash
npm run lint
npm run build   # type-checks, builds, and prerenders the public pages
```

Pushes to `main` build a Docker image (nginx serving the built site) and publish it to the GitHub Container Registry.

## Translating

Every piece of text the website shows is in [`src/i18n/locales/en`](src/i18n/locales/en), one JSON file per area. To
add a language, copy those files to `src/i18n/locales/<code>` (`fr`, `de`, `pt-BR`, ...) and translate the values:
the language is picked up on its own, offered under Preferences → Appearance, and chosen automatically for browsers set
to it. Anything left untranslated shows in English. Missing languages can be requested from the same place; requests
reach the developer by direct message.

- Keep `{placeholders}` and `<tags>` as they are; move them wherever the sentence needs them.
- Text that depends on a number has one entry per plural form (`tasks_one`, `tasks_other`, plus `_zero`, `_two`,
  `_few` or `_many` where the language has them).
- Slash commands such as `/task create` stay in English: they are the bot's commands.
- The Privacy Policy and Terms of Service are only in English.
- `npm run check:i18n` checks each language against English: every message present, with the same placeholders,
  tags and plural forms. It also runs on every push.

The current translations were produced with the help of generative AI. If you notice an error or a wording that could be
improved, please let us know with `/report` in Discord or by email at
[contact@kanbancord.com](mailto:contact@kanbancord.com).

## License

[MIT](LICENSE) © Ryuji Ly. KanbanCord is not affiliated with or endorsed by Discord.
