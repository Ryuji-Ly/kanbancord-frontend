import type { FeatureKey } from '../../services/featuresService'
import { themeTokens, type ThemePreference } from './themes'

export type ColorFilter = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia'

export type AccessibilityPreference = {
  /** Draws a distinct pattern on each label, so labels differ by more than colour. */
  labelPatterns?: boolean
  /** Shows each priority's rank (P1 is the most urgent) next to its name. */
  priorityRanks?: boolean
  /** Shifts user-chosen colours (labels, priorities, roles) so they are easier to tell apart. */
  colorFilter?: ColorFilter
  /** 1 is the normal size. */
  textScale?: number
  /** 'system' follows the operating system setting. */
  reduceMotion?: 'system' | 'on' | 'off'
}

/** Features the user hides for themselves; true means hidden. Everyone else still sees them. */
export type SimpleViewPreference = Partial<Record<Exclude<FeatureKey, 'PERMISSIONS'>, boolean>>

export type Preferences = {
  theme?: ThemePreference
  accessibility?: AccessibilityPreference
  simpleView?: SimpleViewPreference
}

export const TEXT_SCALES = [
  { value: 1, label: 'Normal' },
  { value: 1.125, label: 'Large' },
  { value: 1.25, label: 'Larger' },
  { value: 1.5, label: 'Largest' },
]

// ── Colour-blind correction (daltonization) ──────────────────────────────────
//
// Each filter simulates how colours look with the condition (Machado, Oliveira and Fernandes, 2009),
// takes the difference that is lost, and moves it into channels that can still be seen (Fidaner et
// al.). The result is one colour matrix, applied as an SVG filter.

type Matrix = number[][]

const SIMULATION: Record<Exclude<ColorFilter, 'none'>, Matrix> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
}

/** Where the lost difference goes: into green and blue for red-green loss, into red and green for blue-yellow. */
const SHIFT: Record<Exclude<ColorFilter, 'none'>, Matrix> = {
  protanopia: [[0, 0, 0], [0.7, 1, 0], [0.7, 0, 1]],
  deuteranopia: [[0, 0, 0], [0.7, 1, 0], [0.7, 0, 1]],
  tritanopia: [[1, 0, 0.7], [0, 1, 0.7], [0, 0, 0]],
}

function multiply(a: Matrix, b: Matrix): Matrix {
  return a.map((row) => b[0].map((_, j) => row.reduce((sum, value, k) => sum + value * b[k][j], 0)))
}

/** The feColorMatrix `values` for a filter: I + Shift × (I − Simulation), as a 4×5 matrix. */
export function correctionMatrix(filter: Exclude<ColorFilter, 'none'>): string {
  const identity = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  const lost = identity.map((row, i) => row.map((value, j) => value - SIMULATION[filter][i][j]))
  const shifted = multiply(SHIFT[filter], lost)
  const total = identity.map((row, i) => row.map((value, j) => value + shifted[i][j]))
  const rows = total.map((row) => [...row.map((value) => value.toFixed(4)), '0', '0'].join(' '))
  return [...rows, '0 0 0 1 0'].join(' ')
}

// ── Applying preferences to the page ─────────────────────────────────────────

const STORAGE_KEY = 'kanbancord_preferences'
const FILTER_ELEMENT_ID = 'kc-color-filters'
let appliedTokens: string[] = []

function ensureFilters() {
  if (document.getElementById(FILTER_ELEMENT_ID)) return
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.id = FILTER_ELEMENT_ID
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.position = 'absolute'
  svg.innerHTML = (['protanopia', 'deuteranopia', 'tritanopia'] as const)
    .map(
      (filter) =>
        `<filter id="kc-filter-${filter}" color-interpolation-filters="linearRGB">` +
        `<feColorMatrix type="matrix" values="${correctionMatrix(filter)}"/></filter>`,
    )
    .join('')
  document.body.appendChild(svg)
}

/** Sets the theme's colours and the accessibility options on the document. */
export function applyPreferences(preferences: Preferences | undefined) {
  const root = document.documentElement
  const tokens = themeTokens(preferences?.theme)
  for (const name of appliedTokens) {
    if (!(name in tokens)) root.style.removeProperty(name)
  }
  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value)
  appliedTokens = Object.keys(tokens)

  const accessibility = preferences?.accessibility ?? {}
  root.style.fontSize = accessibility.textScale && accessibility.textScale !== 1 ? `${accessibility.textScale * 100}%` : ''
  root.toggleAttribute('data-kc-label-patterns', Boolean(accessibility.labelPatterns))
  root.toggleAttribute('data-kc-priority-ranks', Boolean(accessibility.priorityRanks))
  root.dataset.kcReduceMotion = accessibility.reduceMotion ?? 'system'
  const filter = accessibility.colorFilter ?? 'none'
  if (filter !== 'none' && document.body) ensureFilters()
  root.dataset.kcColorFilter = filter
}

/** The preferences this browser last used, so the page starts in the right theme before signing in. */
export function cachedPreferences(): Preferences | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Preferences) : undefined
  } catch {
    return undefined
  }
}

export function cachePreferences(preferences: Preferences | undefined) {
  try {
    if (preferences) localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable: the page still follows the account's preferences once signed in.
  }
}
