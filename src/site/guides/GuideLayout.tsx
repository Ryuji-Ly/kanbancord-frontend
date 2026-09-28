import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { buildBotInviteLink } from '../../features/dashboard/dashboardModel'
import { PublicLayout } from '../PublicLayout'
import { SITE } from '../siteInfo'
import { GUIDE_META, guideMeta } from './guideMeta'

/**
 * A guide's page: where it sits among the guides, its content, a way to try it, and the other
 * guides, so each page leads to the next.
 */
export function GuideLayout({ slug, children }: { slug: string; children: ReactNode }) {
  const meta = guideMeta(slug)
  const others = GUIDE_META.filter((guide) => guide.slug !== slug)
  return (
    <PublicLayout title={meta.title} description={meta.description} path={`/guides/${slug}`}>
      <nav className="kc-breadcrumbs" aria-label="Breadcrumbs">
        <Link to="/guides">Guides</Link> <span aria-hidden="true">›</span> <span>{meta.title}</span>
      </nav>
      <h1>{meta.title}</h1>
      {children}

      <aside className="kc-guide-cta">
        <h2>Try it in your server</h2>
        <p>
          {SITE.name} is free. Add it to your server, then run <code>/guide</code> for a step-by-step walkthrough right
          in Discord.
        </p>
        <a className="kc-btn kc-btn-primary" href={buildBotInviteLink()} target="_blank" rel="noopener noreferrer">
          Add to Discord
        </a>
      </aside>

      <h2>More guides</h2>
      <ul className="kc-guide-list">
        {others.map((guide) => (
          <li key={guide.slug}>
            <Link to={`/guides/${guide.slug}`}>{guide.title}</Link>
            <span className="kc-muted"> · {guide.summary}</span>
          </li>
        ))}
      </ul>
    </PublicLayout>
  )
}
