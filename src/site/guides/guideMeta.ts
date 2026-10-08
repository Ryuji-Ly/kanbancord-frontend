import { t, type Messages } from '../../i18n'

/**
 * Every guide's address, and where its title and description are in the messages (guides.json):
 * for its page, the guides index, the links between guides, and search results. Titles say what
 * people search for.
 */
export type GuideMeta = {
  slug: string
  /** Its messages: `title` (the page's heading and title), `description` (one or two sentences,
   * for search results and link previews) and `summary` (one line on the guides index). */
  key: keyof Messages['guides']
}

export const GUIDE_META: GuideMeta[] = [
  { slug: 'getting-started', key: 'gettingStarted' },
  { slug: 'discord-to-do-list', key: 'toDoList' },
  { slug: 'assign-tasks', key: 'assignTasks' },
  { slug: 'due-dates-and-reminders', key: 'dueDates' },
  { slug: 'labels-and-priorities', key: 'labelsPriorities' },
  { slug: 'board-posts-and-feeds', key: 'postsFeeds' },
  { slug: 'feeds-and-threads', key: 'feedsThreads' },
  { slug: 'roles-and-permissions', key: 'permissions' },
  { slug: 'website-board', key: 'website' },
]

export function guideMeta(slug: string): GuideMeta {
  const meta = GUIDE_META.find((guide) => guide.slug === slug)
  if (!meta) throw new Error(`No guide ${slug}`)
  return meta
}

export function guideText(guide: GuideMeta, field: 'title' | 'description' | 'summary'): string {
  return t(`guides.${guide.key}.${field}`)
}
