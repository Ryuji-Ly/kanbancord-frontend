// Writes an HTML file for each public page: the built index.html with the page's own title,
// description and address, and the page already rendered inside it. nginx serves /faq from
// faq.html, so search engines and link previews get the real page without running the app.
//
// Also writes sitemap.xml, with the date each page's content last changed. Those dates live in
// scripts/page-dates.json with a fingerprint of each page: a page whose content differs from its
// fingerprint gets today's date, and the file is updated. Commit it along with content changes.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const SITE_URL = 'https://kanbancord.com'
const dist = 'dist'
const { PATHS, render } = await import(pathToFileURL(join('dist-ssr', 'prerender.js')).href)
const template = readFileSync(join(dist, 'index.html'), 'utf8')

const escape = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function replaceOnce(html, pattern, replacement, what, path) {
  if (!pattern.test(html)) throw new Error(`index.html has no ${what} to set for ${path}`)
  return html.replace(pattern, replacement)
}

const DATES_FILE = join('scripts', 'page-dates.json')
const dates = existsSync(DATES_FILE) ? JSON.parse(readFileSync(DATES_FILE, 'utf8')) : {}
const today = new Date().toISOString().slice(0, 10)
let datesChanged = false

/**
 * The page's own content: what is inside its article, so the shared header and footer do not count.
 * React's markers between adjacent pieces of text (<!-- -->) are left out: they change with how the
 * text is put together (such as from translated messages), not with what it says.
 */
function fingerprint(html) {
  const article = html.match(/<article[\s\S]*<\/article>/)
  const content = (article ? article[0] : html).replaceAll('<!-- -->', '')
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

for (const path of PATHS) {
  const { html, head } = render(path)
  const hash = fingerprint(html)
  if (dates[path]?.hash !== hash) {
    dates[path] = { hash, lastmod: today }
    datesChanged = true
  }
  if (!head.title || !head.description) throw new Error(`${path} did not set its title and description`)
  const url = `${SITE_URL}${head.path ?? path}`
  let page = template
  page = replaceOnce(page, /<title>[^<]*<\/title>/, `<title>${escape(head.title)}</title>`, 'title', path)
  page = replaceOnce(page, /(<meta name="description" content=")[^"]*(")/, `$1${escape(head.description)}$2`, 'description', path)
  page = replaceOnce(page, /(<meta property="og:title" content=")[^"]*(")/, `$1${escape(head.title)}$2`, 'og:title', path)
  page = replaceOnce(page, /(<meta property="og:description" content=")[^"]*(")/, `$1${escape(head.description)}$2`, 'og:description', path)
  page = replaceOnce(page, /(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`, 'og:url', path)
  page = replaceOnce(page, /(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`, 'canonical', path)
  page = replaceOnce(page, /<div id="root"><\/div>/, `<div id="root">${html}</div>`, 'root element', path)
  const file = join(dist, `${path.replace(/^\//, '')}.html`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, page)
}

// How often each kind of page changes, and how much it matters, for search engines.
function weight(path) {
  if (path === '/about' || path === '/guides') return { changefreq: 'monthly', priority: '0.8' }
  if (path === '/faq' || path.startsWith('/guides/')) return { changefreq: 'monthly', priority: '0.7' }
  if (path === '/support') return { changefreq: 'yearly', priority: '0.4' }
  return { changefreq: 'yearly', priority: '0.3' }
}

// The home page is drawn by the app (it depends on whether you are signed in), so it has no date.
const entries = [
  `  <url>\n    <loc>${SITE_URL}/</loc>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
  ...PATHS.map((path) => {
    const { changefreq, priority } = weight(path)
    return `  <url>\n    <loc>${SITE_URL}${path}</loc>\n    <lastmod>${dates[path].lastmod}</lastmod>\n`
      + `    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
  }),
]
writeFileSync(join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`)

// Pages no longer published are forgotten.
for (const path of Object.keys(dates)) {
  if (!PATHS.includes(path)) {
    delete dates[path]
    datesChanged = true
  }
}
if (datesChanged) {
  writeFileSync(DATES_FILE, `${JSON.stringify(dates, null, 2)}\n`)
  console.log(`Updated ${DATES_FILE}: commit it with the content changes`)
}

rmSync('dist-ssr', { recursive: true, force: true })
console.log(`Prerendered ${PATHS.length} public pages and the sitemap`)
// Some modules keep handles open (a BroadcastChannel for sign-in state); nothing else is left to do.
process.exit(0)
