// Captures the guides' screenshots from demo mode, sharp at twice the pixel density, into
// public/images/guides. With `npm run demo -- --port 5199` running:
//
//   npm i --no-save puppeteer-core
//   node scripts/capture-guide-screenshots.mjs              (all of them)
//   node scripts/capture-guide-screenshots.mjs board task   (only these)
//
// Uses an installed Chrome; set CHROME_PATH if it is somewhere else.
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5199'
const SERVER = '900000000000000001'
const OUT = 'public/images/guides'
const only = process.argv.slice(2)
mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--hide-scrollbars', '--force-color-profile=srgb'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])

const settle = (ms = 900) => new Promise((resolve) => setTimeout(resolve, ms))
async function open(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2' })
  await settle()
}
async function clickText(selector, text) {
  const handles = await page.$$(selector)
  for (const handle of handles) {
    const label = await handle.evaluate((element) => element.textContent.trim() || element.getAttribute('aria-label') || '')
    if (label === text || label.startsWith(text)) {
      await handle.click()
      await settle(600)
      return
    }
  }
  throw new Error(`No ${selector} with text ${text}`)
}
async function shot(name, options = {}) {
  if (only.length > 0 && !only.includes(name)) return
  await page.mouse.move(1, 1)
  await settle(300)
  const file = `${OUT}/${name}.webp`
  await page.screenshot({ path: file, type: 'webp', quality: 92, ...options })
  console.log('saved', file)
}
const want = (name) => only.length === 0 || only.includes(name)

// Wide enough for all five columns; the empty space under them is left out.
const WIDE = { width: 1720, height: 1000, deviceScaleFactor: 2 }
if (want('board')) {
  await page.setViewport(WIDE)
  await open(`/boards/1?serverId=${SERVER}`)
  await shot('board', { clip: { x: 0, y: 0, width: 1720, height: 760 } })
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
}
if (want('task')) {
  await open(`/boards/1?serverId=${SERVER}&task=103`)
  await shot('task')
}
if (want('filters')) {
  await page.setViewport(WIDE)
  await open(`/boards/1?serverId=${SERVER}&label=31`)
  await page.click('.kc-task-search input')
  await settle(500)
  await shot('filters', { clip: { x: 0, y: 0, width: 1720, height: 500 } })
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
}
if (want('task-panel')) {
  await open(`/boards/1?serverId=${SERVER}&task=103`)
  const panel = await page.$('.kc-task-panel')
  const box = await panel.boundingBox()
  await shot('task-panel', { clip: { x: box.x, y: 0, width: box.width, height: 900 } })
}
if (want('due-filter')) {
  await page.setViewport(WIDE)
  await open(`/boards/1?serverId=${SERVER}&due=week`)
  await page.click('.kc-task-search input')
  await settle(500)
  await shot('due-filter', { clip: { x: 0, y: 0, width: 1720, height: 500 } })
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
}
if (want('dashboard')) {
  await open('/')
  await shot('dashboard', { clip: { x: 0, y: 0, width: 1440, height: 580 } })
}
if (want('feeds') || want('permissions')) {
  await open('/')
  await clickText('button', 'Server settings')
  if (want('feeds')) {
    await clickText('button', 'Notifications')
    await clickText('button.kc-feed-category-toggle', 'Tasks')
    await shot('feeds')
  }
  if (want('permissions')) {
    await clickText('button', 'Permissions')
    await shot('permissions')
  }
}

await browser.close()
