// Writes an HTML file for each public page: the built index.html with the page's own title,
// description and address, and the page already rendered inside it. nginx serves /faq from
// faq.html, so search engines and link previews get the real page without running the app.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

for (const path of PATHS) {
  const { html, head } = render(path)
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

rmSync('dist-ssr', { recursive: true, force: true })
console.log(`Prerendered ${PATHS.length} public pages`)
// Some modules keep handles open (a BroadcastChannel for sign-in state); nothing else is left to do.
process.exit(0)
