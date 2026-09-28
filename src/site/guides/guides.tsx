import type { ComponentType } from 'react'
import { AssignTasksGuide } from './AssignTasksGuide'
import { DueDatesGuide } from './DueDatesGuide'
import { GettingStartedGuide } from './GettingStartedGuide'
import { GUIDE_META, type GuideMeta } from './guideMeta'
import { LabelsPrioritiesGuide } from './LabelsPrioritiesGuide'
import { PermissionsGuide } from './PermissionsGuide'
import { PostsFeedsGuide } from './PostsFeedsGuide'
import { ToDoListGuide } from './ToDoListGuide'
import { WebsiteGuide } from './WebsiteGuide'

const PAGES: Record<string, ComponentType> = {
  'getting-started': GettingStartedGuide,
  'discord-to-do-list': ToDoListGuide,
  'assign-tasks': AssignTasksGuide,
  'due-dates-and-reminders': DueDatesGuide,
  'labels-and-priorities': LabelsPrioritiesGuide,
  'board-posts-and-feeds': PostsFeedsGuide,
  'roles-and-permissions': PermissionsGuide,
  'website-board': WebsiteGuide,
}

/** Every guide with its page, in the order they are listed. */
export const GUIDES: (GuideMeta & { Page: ComponentType })[] = GUIDE_META.map((meta) => {
  const Page = PAGES[meta.slug]
  if (!Page) throw new Error(`No page for guide ${meta.slug}`)
  return { ...meta, Page }
})
