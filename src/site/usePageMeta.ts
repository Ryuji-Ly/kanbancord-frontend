import { createContext, useContext, useEffect } from 'react'
import { SITE } from './siteInfo'

/** A page's title, description and address, collected while pages are rendered at build time. */
export type PageHead = { title?: string; description?: string; path?: string }

/** Given while rendering at build time; each public page reports its head to it (effects do not run there). */
export const PageHeadContext = createContext<((head: PageHead) => void) | null>(null)

/** The full title a page shows: "About · KanbanCord", or just the name for the home page. */
export function fullTitle(title: string): string {
  return title === SITE.name ? title : `${title} · ${SITE.name}`
}

function setMeta(selector: string, attribute: 'content' | 'href', value: string) {
  const element = document.head.querySelector(selector)
  if (element) element.setAttribute(attribute, value)
}

/**
 * The page's title, description and address as search engines and link previews see them. Each
 * public page sets its own; leaving a page puts the site's defaults back.
 */
export function usePageMeta(title: string, description: string, path: string) {
  const recordHead = useContext(PageHeadContext)
  recordHead?.({ title: fullTitle(title), description, path })
  useEffect(() => {
    const previous = {
      title: document.title,
      description: document.head.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
      canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? SITE.url,
    }
    const pageTitle = fullTitle(title)
    const url = `${SITE.url}${path}`
    document.title = pageTitle
    setMeta('meta[name="description"]', 'content', description)
    setMeta('meta[property="og:title"]', 'content', pageTitle)
    setMeta('meta[property="og:description"]', 'content', description)
    setMeta('meta[property="og:url"]', 'content', url)
    setMeta('link[rel="canonical"]', 'href', url)
    return () => {
      document.title = previous.title
      setMeta('meta[name="description"]', 'content', previous.description)
      setMeta('link[rel="canonical"]', 'href', previous.canonical)
    }
  }, [title, description, path])
}
