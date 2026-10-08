import { SwitchRow } from '../../components/SwitchRow'
import { t, type MessageKey } from '../../i18n'
import { TEXT_SCALES, type AccessibilityPreference, type ColorFilter } from './preferencesModel'

const FILTERS: { value: ColorFilter; label: MessageKey }[] = [
  { value: 'none', label: 'account.accessibility.filters.none' },
  { value: 'protanopia', label: 'account.accessibility.filters.protanopia' },
  { value: 'deuteranopia', label: 'account.accessibility.filters.deuteranopia' },
  { value: 'tritanopia', label: 'account.accessibility.filters.tritanopia' },
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
      <p className="kc-muted">{t('account.accessibility.intro')}</p>
      <ul className="kc-features-list">
        <SwitchRow
          label={t('account.accessibility.patterns')}
          description={t('account.accessibility.patternsHint')}
          on={Boolean(current.labelPatterns)}
          onToggle={(on) => set({ labelPatterns: on })}
        />
        <SwitchRow
          label={t('account.accessibility.ranks')}
          description={t('account.accessibility.ranksHint')}
          on={Boolean(current.priorityRanks)}
          onToggle={(on) => set({ priorityRanks: on })}
        />
      </ul>

      <label className="kc-field">
        <span className="kc-field-label">{t('account.accessibility.filter')}</span>
        <select
          className="kc-input"
          value={current.colorFilter ?? 'none'}
          onChange={(event) => set({ colorFilter: event.target.value as ColorFilter })}
        >
          {FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {t(filter.label)}
            </option>
          ))}
        </select>
        <span className="kc-muted">{t('account.accessibility.filterHint')}</span>
      </label>

      <div className="kc-field">
        <span className="kc-field-label">{t('account.accessibility.textSize')}</span>
        <div className="kc-segmented" role="radiogroup" aria-label={t('account.accessibility.textSize')}>
          {TEXT_SCALES.map((scale) => (
            <button
              key={scale.value}
              type="button"
              role="radio"
              aria-checked={(current.textScale ?? 1) === scale.value}
              className={`kc-segment${(current.textScale ?? 1) === scale.value ? ' kc-segment--on' : ''}`}
              onClick={() => set({ textScale: scale.value })}
            >
              {t(scale.label)}
            </button>
          ))}
        </div>
      </div>

      <label className="kc-field">
        <span className="kc-field-label">{t('account.accessibility.motion')}</span>
        <select
          className="kc-input"
          value={current.reduceMotion ?? 'system'}
          onChange={(event) => set({ reduceMotion: event.target.value as AccessibilityPreference['reduceMotion'] })}
        >
          <option value="system">{t('account.accessibility.motionSystem')}</option>
          <option value="on">{t('account.accessibility.motionOn')}</option>
          <option value="off">{t('account.accessibility.motionOff')}</option>
        </select>
      </label>
    </div>
  )
}
