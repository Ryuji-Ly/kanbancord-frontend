import { Link } from 'react-router-dom'
import { t } from '../../i18n'
import { Trans } from '../../i18n/Trans'
import { PublicLayout } from '../PublicLayout'
import { SITE_VALUES } from '../siteInfo'
import { GUIDE_META, guideText } from './guideMeta'

export function GuidesIndexPage() {
  return (
    <PublicLayout title={t('site.guides.metaTitle')} description={t('site.guides.metaDescription')} path="/guides">
      <h1>{t('site.guides.title')}</h1>
      <p>{t('site.guides.intro', SITE_VALUES)}</p>
      <p>
        <Trans k="site.guides.inDiscord" />
      </p>
      <ul className="kc-guide-list kc-guide-list--index">
        {GUIDE_META.map((guide) => (
          <li key={guide.slug}>
            <Link to={`/guides/${guide.slug}`}>
              <strong>{guideText(guide, 'title')}</strong>
            </Link>
            <p className="kc-muted">{guideText(guide, 'summary')}</p>
          </li>
        ))}
      </ul>
    </PublicLayout>
  )
}
