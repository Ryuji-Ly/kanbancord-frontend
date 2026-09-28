/**
 * Every guide's address, title and description: for its page, the guides index, the links between
 * guides, and search results. Titles say what people search for.
 */
export type GuideMeta = {
  slug: string
  /** The page's heading and title. */
  title: string
  /** For search results and link previews: one or two sentences. */
  description: string
  /** One line on the guides index. */
  summary: string
}

export const GUIDE_META: GuideMeta[] = [
  {
    slug: 'getting-started',
    title: 'Getting started: a kanban board in your Discord server',
    description:
      'Set up KanbanCord in a few minutes: add the bot, create a board, and add and move tasks with slash commands, without leaving Discord.',
    summary: 'Add the bot, create your first board and your first tasks.',
  },
  {
    slug: 'discord-to-do-list',
    title: 'A shared to-do list for your Discord server',
    description:
      'Keep a to-do list in Discord that your whole server can see and update: add tasks, tick them off, and see what is left at a glance.',
    summary: 'A todo list everyone in the server can see, update and tick off.',
  },
  {
    slug: 'assign-tasks',
    title: 'Assigning tasks and sharing work in Discord',
    description:
      'Assign tasks to people or whole Discord roles, so everyone knows who is doing what, and the right people hear about their tasks.',
    summary: 'Give tasks to people or roles, and keep them in the loop.',
  },
  {
    slug: 'due-dates-and-reminders',
    title: 'Due dates and reminders in Discord',
    description:
      'Give tasks due dates and let KanbanCord remind the people on them by direct message, a day before and when a task is overdue.',
    summary: 'Deadlines, and reminders before they pass.',
  },
  {
    slug: 'labels-and-priorities',
    title: 'Organising tasks with labels and priorities',
    description:
      'Sort tasks with coloured labels and priority levels, created and applied with slash commands in Discord, and filter by them on the website.',
    summary: 'Coloured labels and priority levels to sort your tasks.',
  },
  {
    slug: 'board-posts-and-feeds',
    title: 'Keeping your team up to date: board posts and update feeds',
    description:
      'Show where things stand with a live board post that updates itself, or follow every change with an update feed that pings the right people.',
    summary: 'A live board in a channel, or a post for every change.',
  },
  {
    slug: 'roles-and-permissions',
    title: 'Roles and permissions: who can see and change each board',
    description:
      'KanbanCord follows your Discord roles from the start. Fine-tune who can see and change each board, per role and per person.',
    summary: 'Discord roles from the start, fine-tuned per board and per person.',
  },
  {
    slug: 'website-board',
    title: 'The website: every board at a glance',
    description:
      'The KanbanCord website shows whole boards with drag and drop, search and filters, checklists, images and videos, all live with Discord.',
    summary: 'Drag and drop, search, filters and more, live with Discord.',
  },
]

export function guideMeta(slug: string): GuideMeta {
  const meta = GUIDE_META.find((guide) => guide.slug === slug)
  if (!meta) throw new Error(`No guide ${slug}`)
  return meta
}
