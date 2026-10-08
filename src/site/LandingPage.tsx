import { FiBell, FiCommand, FiEye, FiLayout, FiShield, FiZap } from 'react-icons/fi'
import { buildBotInviteLink } from '../features/dashboard/dashboardModel'
import { t } from '../i18n'
import { Trans } from '../i18n/Trans'
import { usePageMeta } from './usePageMeta'
import { SITE } from './siteInfo'

const FEATURES = [
  { icon: FiCommand, key: 'discord' },
  { icon: FiLayout, key: 'boards' },
  { icon: FiShield, key: 'permissions' },
  { icon: FiBell, key: 'updates' },
  { icon: FiZap, key: 'website' },
  { icon: FiEye, key: 'comfort' },
] as const

/** What a signed-out visitor sees at the site's front door. */
export function LandingPage({ onLogin }: { onLogin: () => void }) {
  usePageMeta(t('site.landing.metaTitle'), t('site.landing.metaDescription'), '/')

  return (
    <div className="kc-landing">
      <section className="kc-landing-hero">
        <img src="/images/kanbancord.png" alt="" width={88} height={88} />
        <h1>{t('site.landing.title')}</h1>
        <p>{t('site.landing.intro')}</p>
        <div className="kc-landing-actions">
          <a className="kc-btn kc-btn-primary" href={buildBotInviteLink()} target="_blank" rel="noopener noreferrer">
            {t('site.nav.addToDiscord')}
          </a>
          <button type="button" className="kc-btn kc-btn-ghost" onClick={onLogin}>
            {t('site.landing.signIn')}
          </button>
        </div>
        <p className="kc-muted kc-landing-free">
          <Trans
            k="site.landing.free"
            tags={{ link: <a href={SITE.appDirectoryUrl} target="_blank" rel="noopener noreferrer" /> }}
          />
        </p>
      </section>

      <section className="kc-landing-features" aria-label={t('site.landing.features')}>
        {FEATURES.map(({ icon: Icon, key }) => (
          <div key={key} className="kc-landing-feature">
            <Icon aria-hidden="true" />
            <h2>{t(`site.landing.feature.${key}.title`)}</h2>
            <p>{t(`site.landing.feature.${key}.text`)}</p>
          </div>
        ))}
      </section>

      <section className="kc-landing-steps">
        <h2>{t('site.landing.stepsTitle')}</h2>
        <ol>
          <li>
            <Trans k="site.landing.step1" />
          </li>
          <li>
            <Trans k="site.landing.step2" />
          </li>
          <li>
            <Trans k="site.landing.step3" />
          </li>
        </ol>
      </section>
    </div>
  )
}
