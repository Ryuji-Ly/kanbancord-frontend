import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { buildBotInviteLink } from '../../features/dashboard/dashboardModel'
import { t } from '../../i18n'
import { Trans } from '../../i18n/Trans'
import { PublicLayout } from '../PublicLayout'
import { SITE_VALUES } from '../siteInfo'
import { GUIDE_META, guideMeta, guideText } from './guideMeta'

/**
 * A guide's page: where it sits among the guides, its content, a way to try it, and the other
 * guides, so each page leads to the next.
 */
export function GuideLayout({ slug, children }: { slug: string; children: ReactNode }) {
  const meta = guideMeta(slug)
  const title = guideText(meta, 'title')
  const others = GUIDE_META.filter((guide) => guide.slug !== slug)
  return (
    <PublicLayout title={title} description={guideText(meta, 'description')} path={`/guides/${slug}`}>
      <nav className="kc-breadcrumbs" aria-label={t('site.nav.breadcrumbs')}>
        <Link to="/guides">{t('site.nav.guides')}</Link> <span aria-hidden="true">›</span> <span>{title}</span>
      </nav>
      <h1>{title}</h1>
      {children}

      <aside className="kc-guide-cta">
        <h2>{t('site.guides.tryTitle')}</h2>
        <p>
          <Trans k="site.guides.try" values={SITE_VALUES} />
        </p>
        <a className="kc-btn kc-btn-primary" href={buildBotInviteLink()} target="_blank" rel="noopener noreferrer">
          {t('site.nav.addToDiscord')}
        </a>
      </aside>

      <h2>{t('site.guides.more')}</h2>
      <ul className="kc-guide-list">
        {others.map((guide) => (
          <li key={guide.slug}>
            <Link to={`/guides/${guide.slug}`}>{guideText(guide, 'title')}</Link>
            <span className="kc-muted"> · {guideText(guide, 'summary')}</span>
          </li>
        ))}
      </ul>
    </PublicLayout>
  )
}
