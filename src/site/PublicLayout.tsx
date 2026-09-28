import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SiteFooter } from './SiteFooter'
import { usePageMeta } from './usePageMeta'

type PublicLayoutProps = {
  title: string
  description: string
  path: string
  children: ReactNode
}

/** A page anyone can read without signing in: about, help and the legal documents. */
export function PublicLayout({ title, description, path, children }: PublicLayoutProps) {
  usePageMeta(title, description, path)
  return (
    <div className="kc-public">
      <header className="kc-public-header">
        <Link to="/" className="kc-public-brand">
          <img src="/images/kanbancord.png" alt="" width={32} height={32} />
          KanbanCord
        </Link>
        <nav className="kc-public-nav" aria-label="Main">
          <Link to="/guides">Guides</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/" className="kc-btn kc-btn-primary">
            Open KanbanCord
          </Link>
        </nav>
      </header>
      <main className="kc-public-main">
        <article className="kc-public-article">{children}</article>
      </main>
      <SiteFooter />
    </div>
  )
}
