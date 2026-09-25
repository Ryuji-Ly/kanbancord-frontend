import { useState } from 'react'
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
      <section className="kc-appearance-section">
        <h4>Theme</h4>
        <div className="kc-theme-grid" role="radiogroup" aria-label="Theme">
          {PRESETS.map((preset) => (
            <ThemeCard
              key={preset.id}
              label={preset.label}
              description={preset.description}
              core={preset.core}
              selected={current.preset === preset.id}
              onSelect={() => onChange({ ...current, preset: preset.id, core: undefined })}
            />
          ))}
          <ThemeCard
            label="Custom"
            description="Your own colours, starting from the theme above."
            core={core}
            selected={current.preset === 'custom'}
            onSelect={() => onChange({ ...current, preset: 'custom', core })}
          />
        </div>
      </section>

      {current.preset === 'custom' && (
        <section className="kc-appearance-section">
          <h4>Custom colours</h4>
          <p className="kc-muted">Set eight colours; every other colour is worked out from them.</p>
          <ul className="kc-core-colors">
            {CORE_FIELDS.map((field) => (
              <li key={field.key} className="kc-core-color">
                <ColorField
                  key={core[field.key]}
                  value={core[field.key]}
                  label={field.label}
                  onCommit={(value) => setCore(field.key, value)}
                />
                <div>
                  <strong>{field.label}</strong>
                  <p className="kc-muted">{field.hint}</p>
                </div>
              </li>
            ))}
          </ul>
          {textContrast < 4.5 && (
            <p className="kc-banner" role="status">
              Text against the background has a contrast of {textContrast.toFixed(1)}:1; at least 4.5:1 is
              recommended for reading comfortably.
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
          {advancedOpen ? '▾' : '▸'} Advanced: edit every colour
          {Object.keys(overrides).length > 0 && ` (${Object.keys(overrides).length} changed)`}
        </button>
        {advancedOpen && (
          <div className="kc-advanced-colors">
            <p className="kc-muted">
              Changes here apply on top of the theme above and stay when you switch themes.
              {Object.keys(overrides).length > 0 && (
                <>
                  {' '}
                  <button type="button" className="kc-link-btn" onClick={() => onChange({ ...current, overrides: undefined })}>
                    Reset all
                  </button>
                </>
              )}
            </p>
            {TOKEN_GROUPS.map((group) => (
              <div key={group.label} className="kc-advanced-group">
                <h5>{group.label}</h5>
                <ul>
                  {Object.keys(DEFAULT_TOKENS)
                    .filter((name) => group.prefix.test(name))
                    .map((name) => (
                      <li key={name} className="kc-advanced-color">
                        <ColorField key={tokens[name]} value={tokens[name]} label={name} onCommit={(value) => setOverride(name, value)} />
                        <code>{name.replace('--kc-', '')}</code>
                        {name in overrides && (
                          <button type="button" className="kc-link-btn" onClick={() => setOverride(name, null)}>
                            Reset
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
