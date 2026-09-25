import { useEffect } from 'react'
import { SITE } from './siteInfo'

function setMeta(selector: string, attribute: 'content' | 'href', value: string) {
  const element = document.head.querySelector(selector)
  if (element) element.setAttribute(attribute, value)
}

/**
 * The page's title, description and address as search engines and link previews see them. Each
 * public page sets its own; leaving a page puts the site's defaults back.
 */
export function usePageMeta(title: string, description: string, path: string) {
  useEffect(() => {
    const previous = {
      title: document.title,
      description: document.head.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
      canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? SITE.url,
    }
    const fullTitle = title === SITE.name ? title : `${title} · ${SITE.name}`
    const url = `${SITE.url}${path}`
    document.title = fullTitle
    setMeta('meta[name="description"]', 'content', description)
    setMeta('meta[property="og:title"]', 'content', fullTitle)
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
