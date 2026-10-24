/**
 * The website's updates: one Markdown file per update in `entries/`, named `<date>-<slug>.md`, with a
 * title and date at the top:
 *
 *   ---
 *   title: Board posts, interactive feeds and guides
 *   date: 2026-09-28
 *   ---
 *   - **Board posts:** …
 *
 * They are bundled at build time and shown newest first. Updates are written in English only.
 */

export type Update = {
  /** The file name without its extension, also the entry's anchor on the page. */
  slug: string
  title: string
  /** YYYY-MM-DD. */
  date: string
  body: string
}

const files = import.meta.glob('./entries/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

function parse(path: string, text: string): Update {
  const slug = path.replace(/^.*\//, '').replace(/\.md$/, '')
  const match = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error(`${path} needs a title and date between --- lines at the top`)
  const fields = Object.fromEntries(
    match[1].split('\n').map((line) => {
      const at = line.indexOf(':')
      const value = line.slice(at + 1).trim()
      return [line.slice(0, at).trim(), value.replace(/^"(.*)"$/, '$1')]
    }),
  )
  if (!fields.title || !/^\d{4}-\d{2}-\d{2}$/.test(fields.date ?? '')) {
    throw new Error(`${path} needs a title and a date like 2026-10-18`)
  }
  return { slug, title: fields.title, date: fields.date, body: match[2].trim() }
}

/** Every update, newest first. */
export const UPDATES: Update[] = Object.entries(files)
  .map(([path, text]) => parse(path, text))
  .sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug))
