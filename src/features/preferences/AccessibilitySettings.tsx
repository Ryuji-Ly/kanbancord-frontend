import { SwitchRow } from '../../components/SwitchRow'
import { TEXT_SCALES, type AccessibilityPreference, type ColorFilter } from './preferencesModel'

const FILTERS: { value: ColorFilter; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'protanopia', label: 'Protanopia (red weak)' },
  { value: 'deuteranopia', label: 'Deuteranopia (green weak)' },
  { value: 'tritanopia', label: 'Tritanopia (blue weak)' },
]

type AccessibilitySettingsProps = {
  accessibility: AccessibilityPreference | undefined
  onChange: (accessibility: AccessibilityPreference) => void
}

/**
 * Aids that do not depend on the theme. Labels, priorities and roles have colours chosen by people,
 * which no theme recolours; patterns, ranks and the colour filter make them distinguishable anyway.
 */
export function AccessibilitySettings({ accessibility, onChange }: AccessibilitySettingsProps) {
  const current = accessibility ?? {}
  const set = (changes: AccessibilityPreference) => onChange({ ...current, ...changes })

  return (
    <div className="kc-features">
      <p className="kc-muted">
        For colour blindness, the Red-green safe and Blue-yellow safe themes recolour the interface. The options
        below help with the colours people choose for labels, priorities and roles.
      </p>
      <ul className="kc-features-list">
        <SwitchRow
          label="Patterns on labels"
          description="Each label gets its own stripe or dot pattern, so labels differ by more than colour."
          on={Boolean(current.labelPatterns)}
          onToggle={(on) => set({ labelPatterns: on })}
        />
        <SwitchRow
          label="Priority ranks"
          description="Shows each priority's rank, P1 being the most urgent, next to its name."
          on={Boolean(current.priorityRanks)}
          onToggle={(on) => set({ priorityRanks: on })}
        />
      </ul>

      <label className="kc-field">
        <span className="kc-field-label">Colour filter for labels, priorities and roles</span>
        <select
          className="kc-input"
          value={current.colorFilter ?? 'none'}
          onChange={(event) => set({ colorFilter: event.target.value as ColorFilter })}
        >
          {FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
        <span className="kc-muted">Shifts colours that are hard to tell apart into ones that are easier to see.</span>
      </label>

      <div className="kc-field">
        <span className="kc-field-label">Text size</span>
        <div className="kc-segmented" role="radiogroup" aria-label="Text size">
          {TEXT_SCALES.map((scale) => (
            <button
              key={scale.value}
              type="button"
              role="radio"
              aria-checked={(current.textScale ?? 1) === scale.value}
              className={`kc-segment${(current.textScale ?? 1) === scale.value ? ' kc-segment--on' : ''}`}
              onClick={() => set({ textScale: scale.value })}
            >
              {scale.label}
            </button>
          ))}
        </div>
      </div>

      <label className="kc-field">
        <span className="kc-field-label">Reduce motion</span>
        <select
          className="kc-input"
          value={current.reduceMotion ?? 'system'}
          onChange={(event) => set({ reduceMotion: event.target.value as AccessibilityPreference['reduceMotion'] })}
        >
          <option value="system">Follow my device</option>
          <option value="on">Always reduce</option>
          <option value="off">Never reduce</option>
        </select>
      </label>
    </div>
  )
}
