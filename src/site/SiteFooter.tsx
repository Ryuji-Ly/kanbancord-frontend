import { Link } from 'react-router-dom'
import { buildBotInviteLink } from '../features/dashboard/dashboardModel'
import { t } from '../i18n'
import { SITE, SITE_VALUES } from './siteInfo'

/**
 * The footer on every page but the board itself: about, help, the bot's App Directory page, status,
 * donations and the legal documents.
 */
export function SiteFooter() {
  return (
    <footer className="kc-site-footer">
      <nav aria-label={t('site.nav.site')}>
        <Link to="/about">{t('site.nav.about')}</Link>
        <Link to="/guides">{t('site.nav.guides')}</Link>
        <Link to="/faq">{t('site.nav.faq')}</Link>
        <Link to="/support">{t('site.nav.support')}</Link>
        <a href={SITE.supportServerUrl} target="_blank" rel="noopener noreferrer">
          {t('site.nav.supportServer')}
        </a>
        <a href={SITE.appDirectoryUrl} target="_blank" rel="noopener noreferrer">
          {t('site.nav.appDirectory')}
        </a>
        <a href={SITE.statusUrl} target="_blank" rel="noopener noreferrer">
          {t('site.nav.status')}
        </a>
        <Link to="/privacy">{t('site.nav.privacy')}</Link>
        <Link to="/terms">{t('site.nav.terms')}</Link>
        <a href={buildBotInviteLink()} target="_blank" rel="noopener noreferrer">
          {t('site.nav.addToDiscord')}
        </a>
      </nav>
      <p className="kc-muted">
        {t('site.footer.notAffiliated', { ...SITE_VALUES, year: new Date().getFullYear() })}
      </p>
    </footer>
  )
}
