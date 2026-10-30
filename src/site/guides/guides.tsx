import type { ComponentType } from 'react'
import { ActivityGuide } from './ActivityGuide'
import { AssignTasksGuide } from './AssignTasksGuide'
import { DueDatesGuide } from './DueDatesGuide'
import { FeaturesGuide } from './FeaturesGuide'
import { FeedsThreadsGuide } from './FeedsThreadsGuide'
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
  'features-and-simple-mode': FeaturesGuide,
  'board-posts-and-feeds': PostsFeedsGuide,
  'feeds-and-threads': FeedsThreadsGuide,
  'roles-and-permissions': PermissionsGuide,
  'discord-activity': ActivityGuide,
  'website-board': WebsiteGuide,
}

/** Every guide with its page, in the order they are listed. */
export const GUIDES: (GuideMeta & { Page: ComponentType })[] = GUIDE_META.map((meta) => {
  const Page = PAGES[meta.slug]
  if (!Page) throw new Error(`No page for guide ${meta.slug}`)
  return { ...meta, Page }
})
