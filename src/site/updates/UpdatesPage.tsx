import { language, t } from '../../i18n'
import { PublicLayout } from '../PublicLayout'
import { UpdateBody } from './UpdateBody'
import { UPDATES } from './updates'

/**
 * Dates as "18 October 2026", in the page's language; the entries themselves stay in English. Not
 * the browser's own locale, so the page reads the same as the version built ahead of time.
 */
function formatDate(date: string): string {
  const locale = language() === 'en' ? 'en-GB' : language()
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** What changed in KanbanCord, newest first, each update with its own link (#slug). */
export function UpdatesPage() {
  return (
    <PublicLayout title={t('site.updates.metaTitle')} description={t('site.updates.metaDescription')} path="/updates">
      <h1>{t('site.updates.title')}</h1>
      <p>{t('site.updates.intro')}</p>
      {language() !== 'en' && <p className="kc-muted">{t('site.updates.englishOnly')}</p>}
      {UPDATES.map((update) => (
        <section key={update.slug} id={update.slug} className="kc-update" lang="en">
          <h2>
            <a href={`#${update.slug}`}>{update.title}</a>
          </h2>
          <p className="kc-update-date">
            <time dateTime={update.date}>{formatDate(update.date)}</time>
          </p>
          <UpdateBody text={update.body} />
        </section>
      ))}
    </PublicLayout>
  )
}
