// Checks every translation against English: the same messages and lists, the same {placeholders}
// and <tags> in each, and the plural forms the language needs. Run with `npm run check:i18n`.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const LOCALES = join('src', 'i18n', 'locales')
const PLURAL = /_(zero|one|two|few|many|other)$/

const read = (language, file) => JSON.parse(readFileSync(join(LOCALES, language, file), 'utf8'))

/** Every message and list, by its dotted key. */
function flatten(tree, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string' || Array.isArray(value)) out.set(path, value)
    else flatten(value, path, out)
  }
  return out
}

/** The placeholders and tags a message uses, sorted, so they can be compared. */
function markers(message) {
  const text = Array.isArray(message) ? message.join('\n') : message
  const placeholders = [...text.matchAll(/\{(\w+)\}/g)].map((match) => `{${match[1]}}`)
  const tags = [...text.matchAll(/<(\/?\w+)>/g)].map((match) => `<${match[1]}>`)
  return [...placeholders, ...tags].sort().join(' ')
}

const problems = []
const languages = readdirSync(LOCALES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== 'en')
  .map((entry) => entry.name)

for (const language of languages) {
  const forms = new Set(['other', ...new Intl.PluralRules(language).resolvedOptions().pluralCategories])
  for (const file of readdirSync(join(LOCALES, 'en')).filter((name) => name.endsWith('.json'))) {
    const english = flatten(read('en', file))
    let translated
    try {
      translated = flatten(read(language, file))
    } catch {
      problems.push(`${language}/${file}: missing (English is shown instead)`)
      continue
    }
    const area = file.replace(/\.json$/, '')
    const bases = new Map()
    for (const [key, message] of english) {
      const base = key.replace(PLURAL, '')
      if (PLURAL.test(key)) {
        bases.set(base, message)
        continue
      }
      const theirs = translated.get(key)
      if (theirs === undefined) problems.push(`${language}: ${area}.${key} is missing`)
      else if (Array.isArray(message) !== Array.isArray(theirs)) problems.push(`${language}: ${area}.${key} should be a ${Array.isArray(message) ? 'list' : 'message'}`)
      else if (markers(message) !== markers(theirs)) problems.push(`${language}: ${area}.${key} has ${markers(theirs) || 'nothing'} instead of ${markers(message) || 'nothing'}`)
    }
    // Plural messages need every form the language has, each with English's placeholders and tags.
    for (const [base, message] of bases) {
      for (const form of forms) {
        const theirs = translated.get(`${base}_${form}`)
        if (theirs === undefined) problems.push(`${language}: ${area}.${base}_${form} is missing`)
        else if (markers(message) !== markers(theirs)) problems.push(`${language}: ${area}.${base}_${form} has ${markers(theirs) || 'nothing'} instead of ${markers(message) || 'nothing'}`)
      }
    }
    for (const key of translated.keys()) {
      if (!english.has(key) && !bases.has(key.replace(PLURAL, ''))) problems.push(`${language}: ${area}.${key} is not in English (left over?)`)
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  console.error(`\n${problems.length} problem(s)`)
  process.exit(1)
}
console.log(`Translations match English: ${languages.join(', ') || 'none yet'}`)
