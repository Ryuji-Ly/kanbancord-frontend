import { Link } from 'react-router-dom'
import { buildBotInviteLink } from '../features/dashboard/dashboardModel'
import { SITE } from './siteInfo'

/** The footer on every page but the board itself: about, help and the legal documents. */
export function SiteFooter() {
  return (
    <footer className="kc-site-footer">
      <nav aria-label="Site">
        <Link to="/about">About</Link>
        <Link to="/faq">FAQ</Link>
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms of Service</Link>
        <a href={buildBotInviteLink()} target="_blank" rel="noopener noreferrer">
          Add to Discord
        </a>
      </nav>
      <p className="kc-muted">
        © {new Date().getFullYear()} {SITE.operator}. {SITE.name} is not affiliated with or endorsed by Discord.
      </p>
    </footer>
  )
}
