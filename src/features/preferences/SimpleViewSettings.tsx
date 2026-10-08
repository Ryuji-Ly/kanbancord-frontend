import { SwitchRow } from '../../components/SwitchRow'
import { t } from '../../i18n'
import { FEATURES } from '../../services/featuresService'
import type { SimpleViewPreference } from './preferencesModel'

type SimpleViewSettingsProps = {
  simpleView: SimpleViewPreference | undefined
  onChange: (simpleView: SimpleViewPreference) => void
}

type HideableFeature = keyof SimpleViewPreference

/** Your own simple view: hide features you do not use, on every server. Nobody else is affected. */
export function SimpleViewSettings({ simpleView, onChange }: SimpleViewSettingsProps) {
  const current = simpleView ?? {}
  const hideable = FEATURES.filter((feature) => feature.key !== 'PERMISSIONS')
  const allHidden = hideable.every((feature) => current[feature.key as HideableFeature])

  return (
    <div className="kc-features">
      <p className="kc-muted">{t('account.simpleView.intro')}</p>
      <div className="kc-features-presets">
        <button
          type="button"
          className="kc-btn kc-btn-ghost"
          disabled={allHidden}
          onClick={() => onChange(Object.fromEntries(hideable.map((feature) => [feature.key, true])))}
        >
          {t('account.simpleView.hideAll')}
        </button>
        <button
          type="button"
          className="kc-btn kc-btn-ghost"
          disabled={Object.values(current).every((hidden) => !hidden)}
          onClick={() => onChange({})}
        >
          {t('account.simpleView.showAll')}
        </button>
      </div>
      <ul className="kc-features-list">
        {hideable.map((feature) => (
          <SwitchRow
            key={feature.key}
            label={feature.show}
            description={feature.description}
            on={!current[feature.key as HideableFeature]}
            onToggle={(on) => onChange({ ...current, [feature.key]: !on })}
          />
        ))}
      </ul>
    </div>
  )
}
