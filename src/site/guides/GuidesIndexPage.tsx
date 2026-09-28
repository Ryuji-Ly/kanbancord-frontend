import { Link } from 'react-router-dom'
import { PublicLayout } from '../PublicLayout'
import { SITE } from '../siteInfo'
import { GUIDE_META } from './guideMeta'

export function GuidesIndexPage() {
  return (
    <PublicLayout
      title="Guides"
      description="Guides to KanbanCord: kanban boards, to-do lists and task tracking in Discord, from your first board to reminders, feeds and permissions."
      path="/guides"
    >
      <h1>Guides</h1>
      <p>
        How to plan and track work in your Discord server with {SITE.name}: kanban boards, shared to-do lists, tasks
        for people and roles, due dates and reminders. Almost everything happens with slash commands; a few guides
        cover the website.
      </p>
      <p>
        Already added the bot? Run <code>/guide</code> in Discord for the same steps, ticked off as you go.
      </p>
      <ul className="kc-guide-list kc-guide-list--index">
        {GUIDE_META.map((guide) => (
          <li key={guide.slug}>
            <Link to={`/guides/${guide.slug}`}>
              <strong>{guide.title}</strong>
            </Link>
            <p className="kc-muted">{guide.summary}</p>
          </li>
        ))}
      </ul>
    </PublicLayout>
  )
}
