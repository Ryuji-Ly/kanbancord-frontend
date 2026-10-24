import { useEffect, useState, type ReactNode } from 'react'
import { FiMenu, FiX } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { t } from '../i18n'
import { SiteFooter } from './SiteFooter'
import { usePageMeta } from './usePageMeta'

type PublicLayoutProps = {
  title: string
  description: string
  path: string
  children: ReactNode
  /** Wider than an article, for pages such as the roadmap's board. */
  wide?: boolean
}

/**
 * A page anyone can read without signing in: about, help, updates and the legal documents. The
 * header has the brand with Updates and Roadmap on the left and the page links on the right; on a
 * phone they all move into a menu behind one button.
 */
export function PublicLayout({ title, description, path, children, wide = false }: PublicLayoutProps) {
  usePageMeta(title, description, path)
  const [menuOpen, setMenuOpen] = useState(false)
  const close = () => setMenuOpen(false)

  // The menu closes when one of its links is followed, and with Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="kc-public">
      <header className="kc-public-header">
        <div className="kc-public-start">
          <Link to="/" className="kc-public-brand" aria-label="KanbanCord">
            <img src="/images/kanbancord.png" alt="" width={32} height={32} />
            <span className="kc-public-brand-name">KanbanCord</span>
          </Link>
          <nav className="kc-public-links" aria-label={t('site.nav.news')}>
            <Link to="/updates">{t('site.nav.updates')}</Link>
            <Link to="/roadmap">{t('site.nav.roadmap')}</Link>
          </nav>
        </div>
        <nav className="kc-public-nav" aria-label={t('site.nav.main')}>
          <Link to="/guides">{t('site.nav.guides')}</Link>
          <Link to="/faq">{t('site.nav.faq')}</Link>
          <Link to="/" className="kc-btn kc-btn-primary">
            {t('site.nav.open')}
          </Link>
        </nav>
        <button
          type="button"
          className="kc-public-menu-button"
          aria-expanded={menuOpen}
          aria-controls="kc-public-menu"
          aria-label={menuOpen ? t('site.nav.closeMenu') : t('site.nav.openMenu')}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}
        </button>
        {menuOpen && (
          <nav id="kc-public-menu" className="kc-public-menu" aria-label={t('site.nav.main')} onClick={close}>
            <Link to="/updates">{t('site.nav.updates')}</Link>
            <Link to="/roadmap">{t('site.nav.roadmap')}</Link>
            <Link to="/guides">{t('site.nav.guides')}</Link>
            <Link to="/faq">{t('site.nav.faq')}</Link>
            <Link to="/" className="kc-btn kc-btn-primary">
              {t('site.nav.open')}
            </Link>
          </nav>
        )}
      </header>
      <main className={`kc-public-main${wide ? ' kc-public-main--wide' : ''}`}>
        <article className="kc-public-article">{children}</article>
      </main>
      <SiteFooter />
    </div>
  )
}
