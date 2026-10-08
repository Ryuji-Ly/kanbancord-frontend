import { t } from '../i18n'
import { Trans } from '../i18n/Trans'
import { PublicLayout } from './PublicLayout'
import { SITE, SITE_VALUES } from './siteInfo'

/** Voluntary donations: what they are for, and that they unlock nothing. */
export function SupportPage() {
  return (
    <PublicLayout title={t('site.support.metaTitle')} description={t('site.support.metaDescription')} path="/support">
      <h1>{t('site.support.title', SITE_VALUES)}</h1>
      <p>{t('site.support.p1', SITE_VALUES)}</p>
      <p>{t('site.support.p2')}</p>
      <p>
        <a className="kc-btn kc-btn-primary" href={SITE.donationUrl} target="_blank" rel="noopener noreferrer">
          {t('site.support.kofi')}
        </a>
      </p>

      <h2>{t('site.support.goodToKnow')}</h2>
      <ul>
        <li>{t('site.support.voluntary', SITE_VALUES)}</li>
        <li>{t('site.support.buysNothing')}</li>
        <li>{t('site.support.payments', SITE_VALUES)}</li>
        <li>
          <Trans k="site.support.refunds" values={SITE_VALUES} tags={{ email: <a href={`mailto:${SITE.email}`} /> }} />
        </li>
      </ul>
      <p>
        <Trans k="site.support.notDonating" values={SITE_VALUES} />
      </p>
    </PublicLayout>
  )
}
