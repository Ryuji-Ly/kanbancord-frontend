import { renderToString } from 'react-dom/server'
import { Route, Routes, StaticRouter } from 'react-router-dom'
import { PUBLIC_ROUTES } from './site/publicRoutes'
import { PageHeadContext, type PageHead } from './site/usePageMeta'

/**
 * Renders the public pages at build time (see scripts/prerender.mjs), so each has real HTML and its
 * own title before any script runs. In the browser the app then renders over it as usual.
 */

export const PATHS = PUBLIC_ROUTES.map((route) => route.path)

export function render(path: string): { html: string; head: PageHead } {
  let head: PageHead = {}
  const html = renderToString(
    <PageHeadContext.Provider value={(recorded) => (head = recorded)}>
      <StaticRouter location={path}>
        <Routes>
          {PUBLIC_ROUTES.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
      </StaticRouter>
    </PageHeadContext.Provider>,
  )
  return { html, head }
}
