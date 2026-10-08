/**
 * The website's words, in the reader's language.
 *
 * Every piece of text people read comes from src/i18n/locales/<language>/<area>.json. English is
 * built in, and is used for anything a translation leaves out. To add a language, copy
 * locales/en/*.json into locales/<code>/ (fr, de, pt-BR, ...) and translate the values: the
 * language is picked up on its own, loaded only by those who use it, and offered in Appearance.
 *
 * Messages may hold `{name}` placeholders. A message that depends on a number has one variant per
 * plural form of the language (`tasks_one`, `tasks_other`, and `_zero`, `_two`, `_few`, `_many`
 * where the language has them), chosen by the `count` value. `<b>bold</b>`-style tags are filled
 * in by <Trans>.
 *
 * Text is read with `t('area.key')`, also outside components. Changing the language renders the
 * app afresh (see I18nProvider), so nothing needs to subscribe.
 */
import en from './locales/en'

type Tree = { [key: string]: string | string[] | Tree }
export type Messages = typeof en

type PluralForm = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'
type Paths<T, Leaf> = {
  [K in keyof T & string]: T[K] extends Leaf
    ? K
    : T[K] extends string | readonly unknown[]
      ? never
      : `${K}.${Paths<T[K], Leaf>}`
}[keyof T & string]
type WithoutPlural<K> = K extends `${infer Base}_${PluralForm}` ? Base : K

/** Every message's key, such as 'board.filters.search'. Keys use camelCase: `_` only marks plural forms. */
export type MessageKey = WithoutPlural<Paths<Messages, string>>
/** Every list's key: messages that are a list of items, such as the points of a guide. */
export type ListKey = Paths<Messages, readonly string[]>
export type MessageValues = Record<string, string | number>

/** Other languages' files, loaded when someone picks the language. */
const TRANSLATIONS = import.meta.glob<Tree>(['./locales/*/*.json', '!./locales/en/*.json'], { import: 'default' })

/** The languages the website can be read in: English and every folder in locales. */
export const LANGUAGES: string[] = [
  'en',
  ...new Set(Object.keys(TRANSLATIONS).map((path) => path.split('/')[2])),
].sort()

const STORAGE_KEY = 'kc.language'
let current: { language: string; messages: Tree } = { language: 'en', messages: en }
const listeners = new Set<() => void>()

/** The language the website is shown in, such as 'en'. */
export function language(): string {
  return current.language
}

/**
 * The locale dates and numbers are written in. The browser's own when it is a variant of the
 * shown language (en-GB writes 08/10/2026, en-US 10/8/2026); for English, the browser's in any
 * case, as English is also what is shown when the reader's language is not available yet.
 */
export function formatLocale(): string | undefined {
  const browser = browserLanguages().find((tag) => baseOf(tag) === baseOf(current.language))
  if (browser) return browser
  return current.language === 'en' ? undefined : current.language
}

/** A language's name in that language ("Français"), for choosing it. */
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1)
  } catch {
    return code
  }
}

/** The language picked in Appearance, or null to follow the browser. */
export function chosenLanguage(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored && LANGUAGES.includes(stored) ? stored : null
  } catch {
    return null
  }
}

/** Shows the website in a language (null follows the browser), remembering the choice on this browser. */
export async function chooseLanguage(code: string | null): Promise<void> {
  try {
    if (code) localStorage.setItem(STORAGE_KEY, code)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Not remembered, but shown all the same.
  }
  await switchTo(code ?? preferredLanguage())
}

/** Loads the reader's language before the app first renders, so English does not flash first. */
export async function startI18n(): Promise<void> {
  await switchTo(chosenLanguage() ?? preferredLanguage())
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The message for a key, with its `{placeholders}` filled in. */
export function t(key: MessageKey, values?: MessageValues): string {
  const message = find(current.messages, key, values) ?? find(en, key, values)
  if (message === undefined) {
    if (import.meta.env.DEV) console.warn(`Missing message: ${key}`)
    return key
  }
  return fill(message, values)
}

/**
 * The message for a key made at run time (such as an event the API names), or `fallback` when there
 * is none: for names the API also sends, in English.
 */
export function tOr(key: string, fallback: string, values?: MessageValues): string {
  const message = find(current.messages, key, values) ?? find(en, key, values)
  return message === undefined ? fallback : fill(message, values)
}

/** The items of a list, with their `{placeholders}` filled in. */
export function tList(key: ListKey, values?: MessageValues): string[] {
  const list = parentOf(current.messages, key)?.[lastOf(key)] ?? parentOf(en, key)?.[lastOf(key)]
  if (!Array.isArray(list)) {
    if (import.meta.env.DEV) console.warn(`Missing list: ${key}`)
    return []
  }
  return list.map((item) => fill(item, values))
}

function parentOf(messages: Tree, key: string): Tree | undefined {
  let node: string | string[] | Tree | undefined = messages
  for (const part of key.split('.').slice(0, -1)) {
    node = node && typeof node === 'object' && !Array.isArray(node) ? node[part] : undefined
  }
  return node && typeof node === 'object' && !Array.isArray(node) ? node : undefined
}

function lastOf(key: string): string {
  return key.slice(key.lastIndexOf('.') + 1)
}

function find(messages: Tree, key: string, values?: MessageValues): string | undefined {
  const node = parentOf(messages, key)
  const last = lastOf(key)
  if (!node) return undefined
  if (typeof values?.count === 'number') {
    const form = pluralRules().select(values.count)
    const plural = node[`${last}_${form}`] ?? node[`${last}_other`]
    if (typeof plural === 'string') return plural
  }
  const message = node[last]
  return typeof message === 'string' ? message : undefined
}

function fill(message: string, values?: MessageValues): string {
  if (!values) return message
  return message.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name]
    return value === undefined ? match : String(value)
  })
}

let rules: { language: string; rules: Intl.PluralRules } | null = null
function pluralRules(): Intl.PluralRules {
  if (rules?.language !== current.language) {
    rules = { language: current.language, rules: new Intl.PluralRules(current.language) }
  }
  return rules.rules
}

async function switchTo(code: string): Promise<void> {
  if (code === current.language) return
  const messages = code === 'en' ? en : await loadTranslation(code)
  current = { language: code, messages }
  if (typeof document !== 'undefined') document.documentElement.lang = code
  listeners.forEach((listener) => listener())
}

async function loadTranslation(code: string): Promise<Tree> {
  const files = Object.entries(TRANSLATIONS).filter(([path]) => path.split('/')[2] === code)
  const areas = await Promise.all(
    files.map(async ([path, load]) => [path.split('/')[3].replace(/\.json$/, ''), await load()] as const),
  )
  return Object.fromEntries(areas)
}

function browserLanguages(): readonly string[] {
  return typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]
}

function baseOf(tag: string): string {
  return tag.toLowerCase().split('-')[0]
}

/** The first of the browser's languages the website has: exactly (pt-BR), or by its base (fr-BE → fr). */
function preferredLanguage(): string {
  for (const tag of browserLanguages()) {
    const exact = LANGUAGES.find((code) => code.toLowerCase() === tag.toLowerCase())
    if (exact) return exact
    const base = LANGUAGES.find((code) => code.toLowerCase() === baseOf(tag))
    if (base) return base
  }
  return 'en'
}
