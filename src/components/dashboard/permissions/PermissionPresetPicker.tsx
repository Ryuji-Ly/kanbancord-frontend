import { useState } from 'react'
import { t } from '../../../i18n'
import type { ServerRoleEntry } from '../../../services/permissionsService'
import { PERMISSION_PRESETS, staffRoleChoices, type PermissionPreset } from './permissionPresets'

type PermissionPresetPickerProps = {
  /** Every role of the server; @everyone is left out of the staff choices. */
  roles: ServerRoleEntry[]
  /** Board-level wording ("this board") instead of server-wide. */
  board?: boolean
  busy?: boolean
  /** Shown after applying, such as "Applied" or "Save to keep it". */
  message?: string
  onApply: (preset: PermissionPreset, staffRoleId: string | null) => void
}

/** "Quick setup": who can see and work with boards, in one step. */
export function PermissionPresetPicker({ roles, board = false, busy = false, message, onApply }: PermissionPresetPickerProps) {
  const choices = staffRoleChoices(roles)
  const [preset, setPreset] = useState<PermissionPreset>('EVERYONE')
  const [staffRoleId, setStaffRoleId] = useState('')
  const needsStaff = preset !== 'EVERYONE'
  const ready = !needsStaff || staffRoleId !== ''
  const name = board ? 'board-preset' : 'server-preset'

  return (
    <section className="kc-perm-presets" aria-label={t('permissions.presets.title')}>
      <h4>{t('permissions.presets.title')}</h4>
      <p className="kc-muted">{board ? t('permissions.presets.introBoard') : t('permissions.presets.intro')}</p>
      <div className="kc-radio-list" role="radiogroup" aria-label={t('permissions.presets.title')}>
        {PERMISSION_PRESETS.map((value) => (
          <label key={value} className="kc-radio-row">
            <input
              type="radio"
              name={name}
              className="kc-check"
              checked={preset === value}
              onChange={() => setPreset(value)}
            />
            <span>
              <strong>{t(`permissions.presets.${value}.label`)}</strong>
              <span className="kc-muted">{t(`permissions.presets.${value}.description`)}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="kc-perm-presets-apply">
        {needsStaff && (
          <label className="kc-perm-presets-staff">
            <span>{t('permissions.presets.staffRole')}</span>
            <select className="kc-input" value={staffRoleId} onChange={(event) => setStaffRoleId(event.target.value)}>
              <option value="">{t('permissions.presets.pickRole')}</option>
              {choices.map((role) => (
                <option key={role.roleId} value={role.roleId}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="kc-btn kc-btn-primary"
          disabled={!ready || busy}
          onClick={() => onApply(preset, needsStaff ? staffRoleId : null)}
        >
          {busy ? t('common.applying') : t('permissions.presets.apply')}
        </button>
      </div>
      {message && (
        <p className="kc-muted" role="status">
          {message}
        </p>
      )}
    </section>
  )
}
