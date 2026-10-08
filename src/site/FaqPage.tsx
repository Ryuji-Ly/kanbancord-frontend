import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { t } from '../i18n'
import { Trans } from '../i18n/Trans'
import { PublicLayout } from './PublicLayout'
import { SITE, SITE_VALUES } from './siteInfo'

const QUESTIONS = [
  'free',
  'start',
  'website',
  'add',
  'access',
  'servers',
  'discord',
  'websiteOnly',
  'notifications',
  'uploads',
  'data',
  'help',
] as const

/** The links answers may use. */
const TAGS: Record<string, ReactElement> = {
  guides: <Link to="/guides" />,
  privacy: <Link to="/privacy" />,
  email: <a href={`mailto:${SITE.email}`} />,
  server: <a href={SITE.supportServerUrl} target="_blank" rel="noopener noreferrer" />,
}

export function FaqPage() {
  return (
    <PublicLayout title={t('site.faq.metaTitle')} description={t('site.faq.metaDescription')} path="/faq">
      <h1>{t('site.faq.title')}</h1>
      <div className="kc-faq">
        {QUESTIONS.map((key) => (
          <details key={key}>
            <summary>{t(`site.faq.${key}.q`, SITE_VALUES)}</summary>
            <p>
              <Trans k={`site.faq.${key}.a`} values={SITE_VALUES} tags={TAGS} />
            </p>
          </details>
        ))}
      </div>
    </PublicLayout>
  )
}
