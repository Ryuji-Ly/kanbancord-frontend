/**
 * Themes. The stylesheet defines every colour as a CSS variable with the default (dark) value; a
 * theme is a set of values for those variables, applied on the document root. Three levels:
 *
 * - a preset, chosen from a list;
 * - custom: eight core colours, from which every variable is derived;
 * - advanced: any variable set directly, on top of either.
 */

/** Every theme variable and its default value, as in index.scss. */
export const DEFAULT_TOKENS: Record<string, string> = {
  '--kc-ink': '#0f172a',
  '--kc-nav': '#1f2937',
  '--kc-panel': '#1a243a',
  '--kc-bg': '#2c3440',
  '--kc-card': '#263447',
  '--kc-card-hover': '#314158',
  '--kc-surface': '#31475f',
  '--kc-surface-active': '#334155',
  '--kc-surface-alt': '#3f5975',
  '--kc-surface-hover': '#4f6c8a',
  '--kc-border': '#536b84',
  '--kc-control': '#111827',
  '--kc-control-raised': '#374151',
  '--kc-control-border': '#4b5563',
  '--kc-text-strong': '#f8fafc',
  '--kc-heading': '#f5f3ff',
  '--kc-text': '#f3f4f6',
  '--kc-text-soft': '#e2e8f0',
  '--kc-text-dim': '#cbd5e1',
  '--kc-muted': '#d1d5db',
  '--kc-subtle': '#c5cdd8',
  '--kc-faint': '#94a3b8',
  '--kc-primary': '#1867e3',
  '--kc-primary-hover': '#1551b9',
  '--kc-on-primary': '#ffffff',
  '--kc-accent': '#c4b5fd',
  '--kc-accent-2': '#a5f3fc',
  '--kc-on-accent-2': '#083040',
  '--kc-link': '#a5b4fc',
  '--kc-info': '#60a5fa',
  '--kc-info-soft': '#93c5fd',
  '--kc-danger': '#dc2626',
  '--kc-danger-strong': '#b91c1c',
  '--kc-danger-text': '#fca5a5',
  '--kc-danger-bg': '#7a3850',
  '--kc-danger-border': '#df8390',
  '--kc-on-danger-bg': '#ffe9ec',
  '--kc-success-bg': '#2b6f60',
  '--kc-success-border': '#66c9a0',
  '--kc-success-text': '#86efac',
  '--kc-on-success-bg': '#e3f8ef',
  '--kc-success-strong': '#065f46',
  '--kc-warning': '#eab308',
  '--kc-warning-text': '#fef08a',
  '--kc-shadow': '#000000',
  '--kc-text-on-light': '#111827',
  '--kc-text-on-dark': '#ffffff',
  '--kc-neutral-tag': '#64748b',
  '--kc-allow-border': '#5de68b',
  '--kc-allow-text': '#ccffe8',
  '--kc-allow-badge-bg': '#2b6f60',
  '--kc-allow-badge-text': '#ddfff1',
  '--kc-allow-tint': '#72ddb3',
  '--kc-deny-border': '#ff7575',
  '--kc-deny-text': '#ffe1ea',
  '--kc-deny-badge-bg': '#7a3850',
  '--kc-deny-badge-text': '#ffe4ec',
  '--kc-deny-tint': '#f2a1b9',
}

/** Groups for the advanced editor, in the order shown. */
export const TOKEN_GROUPS: { label: string; prefix: RegExp }[] = [
  { label: 'Surfaces', prefix: /^--kc-(ink|nav|panel|bg|card|surface|border)/ },
  { label: 'Controls', prefix: /^--kc-control/ },
  { label: 'Text', prefix: /^--kc-(text|heading|muted|subtle|faint)/ },
  { label: 'Brand and accents', prefix: /^--kc-(primary|on-primary|accent|on-accent|link|info)/ },
  { label: 'Status', prefix: /^--kc-(danger|on-danger|success|on-success|warning|shadow|neutral)/ },
  { label: 'Permission rules', prefix: /^--kc-(allow|deny)/ },
]

/** The colours the custom level edits; everything else follows from them. */
export type CoreColors = {
  background: string
  surface: string
  text: string
  accent: string
  primary: string
  success: string
  danger: string
  warning: string
}

export const CORE_FIELDS: { key: keyof CoreColors; label: string; hint: string }[] = [
  { key: 'background', label: 'Background', hint: 'Behind everything' },
  { key: 'surface', label: 'Surface', hint: 'Panels, columns and cards' },
  { key: 'text', label: 'Text', hint: 'Body text; headings and hints are derived' },
  { key: 'accent', label: 'Accent', hint: 'Highlights, focus rings, headings tint' },
  { key: 'primary', label: 'Primary', hint: 'Main buttons and links' },
  { key: 'success', label: 'Success', hint: 'Confirmations and allow rules' },
  { key: 'danger', label: 'Danger', hint: 'Errors, delete buttons and deny rules' },
  { key: 'warning', label: 'Warning', hint: 'Cautions and highlights' },
]

export type PresetId = 'dark' | 'light' | 'high-contrast' | 'red-green' | 'blue-yellow'

export type Preset = {
  id: PresetId
  label: string
  description: string
  core: CoreColors
  /** Values set on top of what the core colours derive; the dark preset keeps the stylesheet as is. */
  extra?: Record<string, string>
}

const DARK_CORE: CoreColors = {
  background: '#2c3440',
  surface: '#31475f',
  text: '#f3f4f6',
  accent: '#c4b5fd',
  primary: '#1867e3',
  success: '#34d399',
  danger: '#dc2626',
  warning: '#eab308',
}

export const PRESETS: Preset[] = [
  { id: 'dark', label: 'Dark', description: 'The default.', core: DARK_CORE },
  {
    id: 'light',
    label: 'Light',
    description: 'Dark text on light surfaces.',
    core: {
      background: '#e5e7eb',
      surface: '#f8fafc',
      text: '#111827',
      accent: '#6d28d9',
      primary: '#1d4ed8',
      success: '#15803d',
      danger: '#b91c1c',
      warning: '#a16207',
    },
  },
  {
    id: 'high-contrast',
    label: 'High contrast',
    description: 'Pure black and white with strong borders, for low vision.',
    core: {
      background: '#000000',
      surface: '#0b0b0b',
      text: '#ffffff',
      accent: '#ffd400',
      primary: '#0050d0',
      success: '#00e676',
      danger: '#ff5252',
      warning: '#ffd400',
    },
    extra: { '--kc-border': '#ffffff', '--kc-control-border': '#ffffff', '--kc-subtle': '#e5e5e5', '--kc-faint': '#bdbdbd' },
  },
  {
    // Okabe–Ito colours: sky blue for success and orange for danger stay apart with protanopia and deuteranopia.
    id: 'red-green',
    label: 'Red-green safe',
    description: 'For protanopia and deuteranopia: blue for success, orange for danger.',
    core: { ...DARK_CORE, success: '#56b4e9', danger: '#e69f00', warning: '#f0e442' },
  },
  {
    // Tritanopia confuses blue with green and yellow with violet; red against teal stays clear.
    id: 'blue-yellow',
    label: 'Blue-yellow safe',
    description: 'For tritanopia: teal for success, red for danger, pink for warnings.',
    core: { ...DARK_CORE, accent: '#f9a8d4', success: '#2dd4bf', danger: '#ef4444', warning: '#f472b6' },
  },
]

/** What a user saves: a preset or custom core colours, and optionally single variables on top. */
export type ThemePreference = {
  preset: PresetId | 'custom'
  core?: CoreColors
  overrides?: Record<string, string>
}

// ── Colour arithmetic ────────────────────────────────────────────────────────

function rgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value.slice(0, 6)
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) || 0) as [number, number, number]
}

function hex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')}`
}

/** `a` moved `amount` (0..1) of the way towards `b`. */
export function mix(a: string, b: string, amount: number): string {
  const [x, y] = [rgb(a), rgb(b)]
  return hex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * amount) as [number, number, number])
}

function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The WCAG contrast ratio of two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (la + 0.05) / (lb + 0.05)
}

/** Black or white, whichever reads better on the colour. */
function onColor(background: string): string {
  return contrast(background, '#ffffff') >= contrast(background, '#111827') ? '#ffffff' : '#111827'
}

// ── Deriving a whole theme ───────────────────────────────────────────────────

/** Every theme variable, worked out from the eight core colours. */
export function deriveTokens(core: CoreColors): Record<string, string> {
  const { background: bg, surface, text, accent, primary, success, danger, warning } = core
  const dark = luminance(bg) < 0.4
  // Towards the far end (darker in dark themes) and towards the text (lighter in dark themes).
  const far = dark ? '#000000' : '#ffffff'
  const near = dark ? '#ffffff' : '#000000'
  const successBg = mix(success, bg, 0.55)
  const dangerBg = mix(danger, bg, 0.55)
  const control = mix(bg, far, 0.5)

  return {
    '--kc-ink': dark ? mix(bg, '#000000', 0.6) : '#ffffff',
    '--kc-nav': mix(bg, far, 0.25),
    '--kc-panel': mix(bg, far, 0.35),
    '--kc-bg': bg,
    '--kc-card': mix(surface, far, 0.2),
    '--kc-card-hover': mix(surface, near, 0.06),
    '--kc-surface': surface,
    '--kc-surface-active': mix(surface, near, 0.06),
    '--kc-surface-alt': mix(surface, near, 0.1),
    '--kc-surface-hover': mix(surface, near, 0.18),
    '--kc-border': mix(surface, text, 0.28),
    '--kc-control': control,
    '--kc-control-raised': mix(control, near, 0.15),
    '--kc-control-border': mix(control, text, 0.3),
    '--kc-text-strong': mix(text, near, 0.5),
    '--kc-heading': mix(text, accent, 0.08),
    '--kc-text': text,
    '--kc-text-soft': mix(text, bg, 0.1),
    '--kc-text-dim': mix(text, bg, 0.2),
    '--kc-muted': mix(text, bg, 0.18),
    // As far from the text as hints (4.5:1) and placeholders (3:1) can go on every surface.
    '--kc-subtle': mix(text, bg, 0.2),
    '--kc-faint': mix(text, bg, 0.38),
    '--kc-primary': primary,
    '--kc-primary-hover': mix(primary, '#000000', 0.15),
    '--kc-on-primary': onColor(primary),
    '--kc-accent': accent,
    '--kc-accent-2': mix(primary, text, 0.55),
    '--kc-on-accent-2': onColor(mix(primary, text, 0.55)),
    '--kc-link': mix(accent, text, 0.25),
    '--kc-info': mix(primary, text, 0.3),
    '--kc-info-soft': mix(primary, text, 0.55),
    '--kc-danger': danger,
    '--kc-danger-strong': mix(danger, '#000000', 0.2),
    '--kc-danger-text': mix(danger, text, 0.5),
    '--kc-danger-bg': dangerBg,
    '--kc-danger-border': mix(danger, text, 0.35),
    '--kc-on-danger-bg': onColor(dangerBg),
    '--kc-success-bg': successBg,
    '--kc-success-border': success,
    '--kc-success-text': mix(success, text, 0.45),
    '--kc-on-success-bg': onColor(successBg),
    '--kc-success-strong': mix(success, '#000000', 0.4),
    '--kc-warning': warning,
    '--kc-warning-text': mix(warning, text, 0.5),
    '--kc-shadow': '#000000',
    '--kc-text-on-light': '#111827',
    '--kc-text-on-dark': '#ffffff',
    '--kc-neutral-tag': mix(text, bg, 0.55),
    '--kc-allow-border': success,
    '--kc-allow-text': mix(success, text, 0.7),
    '--kc-allow-badge-bg': successBg,
    '--kc-allow-badge-text': onColor(successBg),
    '--kc-allow-tint': success,
    '--kc-deny-border': danger,
    '--kc-deny-text': mix(danger, text, 0.7),
    '--kc-deny-badge-bg': dangerBg,
    '--kc-deny-badge-text': onColor(dangerBg),
    '--kc-deny-tint': danger,
  }
}

export function presetById(id: string | undefined): Preset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0]
}

/** The core colours a theme starts the custom editor from. */
export function coreOf(theme: ThemePreference | undefined): CoreColors {
  return theme?.preset === 'custom' && theme.core ? theme.core : presetById(theme?.preset).core
}

/**
 * The variables a theme sets. Dark keeps the stylesheet's own values, apart from overrides; every
 * other theme sets all of them, so switching themes never leaves a colour from the previous one.
 */
export function themeTokens(theme: ThemePreference | undefined): Record<string, string> {
  const overrides = theme?.overrides ?? {}
  if (!theme || theme.preset === 'dark') return { ...overrides }
  if (theme.preset === 'custom') return { ...deriveTokens(theme.core ?? DARK_CORE), ...overrides }
  const preset = presetById(theme.preset)
  return { ...deriveTokens(preset.core), ...preset.extra, ...overrides }
}

/** Every variable's value under the theme, for the advanced editor. */
export function resolvedTokens(theme: ThemePreference | undefined): Record<string, string> {
  return { ...DEFAULT_TOKENS, ...themeTokens(theme) }
}
