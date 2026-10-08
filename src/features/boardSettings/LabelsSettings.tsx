import { useState } from 'react'
import { readableError } from '../../api/http'
import { t } from '../../i18n'
import { Trans } from '../../i18n/Trans'
import type { LabelEntry, TaskLabelEntry } from '../../services/boardsService'
import { nextLabelColor } from '../board/boardModel'
import { ColorField } from './ColorField'
import { ConfirmDialog } from '../board/components/ConfirmDialog'
import { LabelChip } from '../board/components/LabelPicker'
import type { useBoardCatalogMutations } from '../board/boardQueries'

type LabelsSettingsProps = {
  labels: LabelEntry[]
  taskLabels: TaskLabelEntry[]
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  mutations: ReturnType<typeof useBoardCatalogMutations>
}

/** The board's labels: add, rename and recolour, and delete (which takes them off every task). */
export function LabelsSettings({ labels, taskLabels, canCreate, canEdit, canDelete, mutations }: LabelsSettingsProps) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<LabelEntry | null>(null)

  const color = newColor ?? nextLabelColor(labels)
  const usage = (labelId: number) => taskLabels.filter((taskLabel) => taskLabel.labelId === labelId).length

  function run(action: Promise<unknown>) {
    setError('')
    action.catch((err: unknown) => setError(readableError(err, t('common.changeNotSaved'))))
  }

  function add() {
    const name = newName.trim()
    if (!name) return
    run(
      mutations.addLabel.mutateAsync({ name, color }).then(() => {
        setNewName('')
        setNewColor(null)
      }),
    )
  }

  function save(label: LabelEntry, changes: Partial<Pick<LabelEntry, 'name' | 'color'>>) {
    const name = (changes.name ?? label.name).trim()
    const nextColor = changes.color ?? label.color
    if (!name || (name === label.name && nextColor === label.color)) return
    run(mutations.editLabel.mutateAsync({ labelId: label.labelId, name, color: nextColor }))
  }

  return (
    <section className="kc-board-modal-section kc-board-modal-section--half">
      <div className="kc-board-modal-section-head">
        <h4>{t('board.fields.labels')}</h4>
        <p className="kc-muted">{t('settings.labels.intro')}</p>
      </div>
      {error && <p className="kc-banner">{error}</p>}

      {labels.length === 0 ? (
        <p className="kc-muted">{t('settings.labels.none')}</p>
      ) : (
        <ul className="kc-settings-list">
          {labels.map((label) => (
            <li key={label.labelId} className="kc-settings-row">
              {canEdit ? (
                <>
                  <ColorField
                    key={label.color}
                    value={label.color}
                    label={t('settings.colourOf', { name: label.name })}
                    onCommit={(color) => save(label, { color })}
                  />
                  <input
                    key={label.name}
                    className="kc-input kc-settings-name"
                    aria-label={t('settings.labels.name')}
                    maxLength={50}
                    defaultValue={label.name}
                    onBlur={(event) => save(label, { name: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
                    }}
                  />
                </>
              ) : (
                <LabelChip label={label} />
              )}
              <span className="kc-muted kc-settings-usage">
                {t('settings.usage', { count: usage(label.labelId) })}
              </span>
              {canDelete && (
                <button type="button" className="kc-btn kc-btn-ghost kc-btn-small" onClick={() => setDeleting(label)}>
                  {t('common.delete')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canCreate && (
        <div className="kc-settings-row kc-settings-add">
          <input
            type="color"
            className="kc-color-input"
            aria-label={t('settings.labels.newColour')}
            value={color}
            onChange={(event) => setNewColor(event.target.value)}
          />
          <input
            className="kc-input kc-settings-name"
            placeholder={t('settings.labels.newPlaceholder')}
            maxLength={50}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') add()
            }}
          />
          <button
            type="button"
            className="kc-btn kc-btn-primary kc-btn-small"
            disabled={!newName.trim() || mutations.addLabel.isPending}
            onClick={add}
          >
            {t('settings.labels.add')}
          </button>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title={t('settings.labels.deleteTitle')}
          busy={mutations.removeLabel.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            run(mutations.removeLabel.mutateAsync(deleting.labelId))
            setDeleting(null)
          }}
        >
          <p>
            <Trans k="settings.labels.deleteConfirm" values={{ name: deleting.name }} />
            {usage(deleting.labelId) > 0 && t('settings.labels.deleteUsage', { count: usage(deleting.labelId) })}
          </p>
        </ConfirmDialog>
      )}
    </section>
  )
}
