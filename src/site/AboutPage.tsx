import { Link } from 'react-router-dom'
import { t } from '../i18n'
import { Trans } from '../i18n/Trans'
import { PublicLayout } from './PublicLayout'
import { SITE, SITE_VALUES } from './siteInfo'

export function AboutPage() {
  return (
    <PublicLayout title={t('site.about.metaTitle')} description={t('site.about.metaDescription')} path="/about">
      <h1>{t('site.about.title', SITE_VALUES)}</h1>
      <p>{t('site.about.p1', SITE_VALUES)}</p>
      <p>{t('site.about.p2')}</p>
      <p>{t('site.about.p3')}</p>

      <h2>{t('site.about.simpleTitle')}</h2>
      <p>
        <Trans k="site.about.simple" />
      </p>

      <h2>{t('site.about.madeByTitle')}</h2>
      <p>
        <Trans
          k="site.about.madeBy"
          values={SITE_VALUES}
          tags={{
            privacy: <Link to="/privacy" />,
            server: <a href={SITE.supportServerUrl} target="_blank" rel="noopener noreferrer" />,
            support: <Link to="/support" />,
          }}
        />
      </p>

      <h2>{t('site.about.findTitle')}</h2>
      <p>
        <Trans
          k="site.about.find"
          values={SITE_VALUES}
          tags={{
            directory: <a href={SITE.appDirectoryUrl} target="_blank" rel="noopener noreferrer" />,
            status: <a href={SITE.statusUrl} target="_blank" rel="noopener noreferrer" />,
          }}
        />
      </p>

      <h2>{t('site.about.startTitle')}</h2>
      <ol>
        <li>{t('site.about.start1')}</li>
        <li>
          <Trans k="site.about.start2" />
        </li>
        <li>
          <Trans k="site.about.start3" />
        </li>
      </ol>
      <p>
        <Trans k="site.about.questions" tags={{ faq: <Link to="/faq" /> }} />
      </p>

      <h2>{t('site.about.translationsTitle')}</h2>
      <p>
        <Trans
          k="site.about.translations"
          values={{ contact: SITE.contactEmail }}
          tags={{ email: <a href={`mailto:${SITE.contactEmail}`} /> }}
        />
      </p>

      <h2>{t('site.about.storyTitle')}</h2>
      <p>{t('site.about.story1')}</p>
      <p>{t('site.about.story2')}</p>
      <p>
        <Trans
          k="site.about.story3"
          values={SITE_VALUES}
          tags={{ other: <a href={SITE.sameNameBotUrl} target="_blank" rel="noopener noreferrer" /> }}
        />
      </p>
      <p>{t('site.about.story4')}</p>
      <p>
        <Trans
          k="site.about.story5"
          tags={{
            bot: <a href={SITE.repos.bot} target="_blank" rel="noopener noreferrer" />,
            website: <a href={SITE.repos.website} target="_blank" rel="noopener noreferrer" />,
            api: <a href={SITE.repos.api} target="_blank" rel="noopener noreferrer" />,
          }}
        />
      </p>
    </PublicLayout>
  )
}
