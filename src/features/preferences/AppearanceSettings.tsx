import { useState } from 'react'
import { chooseLanguage, chosenLanguage, language, LANGUAGES, languageName, t } from '../../i18n'
import { clearPendingAccountDialog, reopenAccountDialog } from '../account/accountDialog'
import { ColorField } from '../boardSettings/ColorField'
import {
  CORE_FIELDS,
  DEFAULT_TOKENS,
  PRESETS,
  TOKEN_GROUPS,
  contrast,
  coreOf,
  resolvedTokens,
  type CoreColors,
  type ThemePreference,
} from './themes'

type AppearanceSettingsProps = {
  theme: ThemePreference | undefined
  onChange: (theme: ThemePreference) => void
}

/**
 * Three levels, from easy to thorough: pick a preset; or set eight core colours and let the rest
 * follow; or open the advanced editor and set any single colour.
 */
export function AppearanceSettings({ theme, onChange }: AppearanceSettingsProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const current: ThemePreference = theme ?? { preset: 'dark' }
  const core = coreOf(current)
  const overrides = current.overrides ?? {}
  const tokens = resolvedTokens(current)
  const textContrast = contrast(core.text, core.background)

  function setCore(key: keyof CoreColors, value: string) {
    onChange({ ...current, preset: 'custom', core: { ...core, [key]: value } })
  }

  function setOverride(name: string, value: string | null) {
    const next = { ...overrides }
    if (value === null) delete next[name]
    else next[name] = value
    onChange({ ...current, overrides: Object.keys(next).length > 0 ? next : undefined })
  }

  return (
    <div className="kc-appearance">
      {LANGUAGES.length > 1 && <LanguageSection />}

      <section className="kc-appearance-section">
        <h4>{t('account.appearance.theme')}</h4>
        <div className="kc-theme-grid" role="radiogroup" aria-label={t('account.appearance.theme')}>
          {PRESETS.map((preset) => (
            <ThemeCard
              key={preset.id}
              label={t(preset.label)}
              description={t(preset.description)}
              core={preset.core}
              selected={current.preset === preset.id}
              onSelect={() => onChange({ ...current, preset: preset.id, core: undefined })}
            />
          ))}
          <ThemeCard
            label={t('account.appearance.custom')}
            description={t('account.appearance.customHint')}
            core={core}
            selected={current.preset === 'custom'}
            onSelect={() => onChange({ ...current, preset: 'custom', core })}
          />
        </div>
      </section>

      {current.preset === 'custom' && (
        <section className="kc-appearance-section">
          <h4>{t('account.appearance.customColours')}</h4>
          <p className="kc-muted">{t('account.appearance.customColoursHint')}</p>
          <ul className="kc-core-colors">
            {CORE_FIELDS.map((field) => (
              <li key={field} className="kc-core-color">
                <ColorField
                  key={core[field]}
                  value={core[field]}
                  label={t(`account.appearance.core.${field}.label`)}
                  onCommit={(value) => setCore(field, value)}
                />
                <div>
                  <strong>{t(`account.appearance.core.${field}.label`)}</strong>
                  <p className="kc-muted">{t(`account.appearance.core.${field}.hint`)}</p>
                </div>
              </li>
            ))}
          </ul>
          {textContrast < 4.5 && (
            <p className="kc-banner" role="status">
              {t('account.appearance.lowContrast', { contrast: textContrast.toFixed(1) })}
            </p>
          )}
        </section>
      )}

      <section className="kc-appearance-section">
        <button
          type="button"
          className="kc-audit-details-toggle kc-appearance-advanced-toggle"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          {advancedOpen ? '▾' : '▸'} {t('account.appearance.advanced')}
          {Object.keys(overrides).length > 0 && t('account.appearance.changed', { count: Object.keys(overrides).length })}
        </button>
        {advancedOpen && (
          <div className="kc-advanced-colors">
            <p className="kc-muted">
              {t('account.appearance.advancedHint')}
              {Object.keys(overrides).length > 0 && (
                <>
                  {' '}
                  <button type="button" className="kc-link-btn" onClick={() => onChange({ ...current, overrides: undefined })}>
                    {t('account.appearance.resetAll')}
                  </button>
                </>
              )}
            </p>
            {TOKEN_GROUPS.map((group) => (
              <div key={group.label} className="kc-advanced-group">
                <h5>{t(group.label)}</h5>
                <ul>
                  {Object.keys(DEFAULT_TOKENS)
                    .filter((name) => group.prefix.test(name))
                    .map((name) => (
                      <li key={name} className="kc-advanced-color">
                        <ColorField key={tokens[name]} value={tokens[name]} label={name} onCommit={(value) => setOverride(name, value)} />
                        <code>{name.replace('--kc-', '')}</code>
                        {name in overrides && (
                          <button type="button" className="kc-link-btn" onClick={() => setOverride(name, null)}>
                            {t('account.appearance.reset')}
                          </button>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/** The website's language: the browser's, or one picked here (remembered on this browser). */
function LanguageSection() {
  const [chosen, setChosen] = useState(chosenLanguage)
  return (
    <section className="kc-appearance-section">
      <h4>{t('account.appearance.language')}</h4>
      <select
        className="kc-input"
        aria-label={t('account.appearance.language')}
        value={chosen ?? ''}
        onChange={(event) => {
          const code = event.target.value || null
          setChosen(code)
          // The app is drawn afresh in the new language; this dialog opens again where it was.
          const before = language()
          reopenAccountDialog('appearance')
          void chooseLanguage(code).then(() => {
            if (language() === before) clearPendingAccountDialog()
          })
        }}
      >
        <option value="">{t('account.appearance.browserLanguage')}</option>
        {LANGUAGES.map((code) => (
          <option key={code} value={code} lang={code}>
            {languageName(code)}
          </option>
        ))}
      </select>
    </section>
  )
}

function ThemeCard({
  label,
  description,
  core,
  selected,
  onSelect,
}: {
  label: string
  description: string
  core: CoreColors
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`kc-theme-card${selected ? ' kc-theme-card--selected' : ''}`}
      onClick={onSelect}
    >
      <span className="kc-theme-preview" style={{ background: core.background }} aria-hidden="true">
        <span className="kc-theme-preview-panel" style={{ background: core.surface }}>
          <span style={{ background: core.text }} />
          <span style={{ background: core.primary }} />
          <span style={{ background: core.success }} />
          <span style={{ background: core.danger }} />
        </span>
      </span>
      <strong>{label}</strong>
      <span className="kc-muted">{description}</span>
    </button>
  )
}
