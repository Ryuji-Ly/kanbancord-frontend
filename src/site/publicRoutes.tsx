import type { ReactElement } from 'react'
import { AboutPage } from './AboutPage'
import { FaqPage } from './FaqPage'
import { SupportPage } from './SupportPage'
import { GuidesIndexPage } from './guides/GuidesIndexPage'
import { GUIDES } from './guides/guides'
import { PrivacyPage } from './legal/PrivacyPage'
import { TermsPage } from './legal/TermsPage'

/**
 * The pages anyone can read without signing in. The app routes to them, and the build renders each
 * to its own HTML file, so search engines and link previews see its content and title without
 * running the app.
 */
export const PUBLIC_ROUTES: { path: string; element: ReactElement }[] = [
  { path: '/about', element: <AboutPage /> },
  { path: '/faq', element: <FaqPage /> },
  { path: '/support', element: <SupportPage /> },
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '/guides', element: <GuidesIndexPage /> },
  ...GUIDES.map((guide) => ({ path: `/guides/${guide.slug}`, element: <guide.Page /> })),
]
