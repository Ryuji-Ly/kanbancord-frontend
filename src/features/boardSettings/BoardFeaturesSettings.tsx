import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { readableError } from '../../api/http'
import { t } from '../../i18n'
import { SwitchRow } from '../../components/SwitchRow'
import type { BoardSnapshot } from '../../services/boardsService'
import { FEATURES, updateBoardFeatures, type BoardFeatureKey } from '../../services/featuresService'
import { boardKeys } from '../board/boardQueries'

type BoardFeaturesSettingsProps = {
  serverId: string
  boardId: string
  snapshot: BoardSnapshot
}

const BOARD_FEATURES = FEATURES.filter(
  (feature): feature is (typeof FEATURES)[number] & { key: BoardFeatureKey } => feature.key !== 'PERMISSIONS',
)

/**
 * The board's own simple mode: switch off, for this board only, features the server has on.
 * Features the server has off are shown switched off and cannot be switched on here.
 */
export function BoardFeaturesSettings({ serverId, boardId, snapshot }: BoardFeaturesSettingsProps) {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const snapshotKey = boardKeys.snapshot(serverId, boardId)

  const update = useMutation({
    mutationFn: (changes: Partial<Record<BoardFeatureKey, boolean>>) => updateBoardFeatures(serverId, boardId, changes),
    onMutate: async (changes) => {
      setError('')
      await queryClient.cancelQueries({ queryKey: snapshotKey })
      const previous = queryClient.getQueryData<BoardSnapshot>(snapshotKey)
      if (previous) {
        const features = { ...previous.features }
        for (const [key, on] of Object.entries(changes) as [BoardFeatureKey, boolean][]) {
          features[key] = on && previous.serverFeatures[key]
        }
        queryClient.setQueryData<BoardSnapshot>(snapshotKey, { ...previous, features })
      }
      return { previous }
    },
    onError: (err, _changes, context) => {
      if (context?.previous) queryClient.setQueryData(snapshotKey, context.previous)
      setError(readableError(err, t('common.changeNotSaved')))
    },
    // Switching a feature on brings its lists back, which only a refetch provides.
    onSettled: () => queryClient.invalidateQueries({ queryKey: boardKeys.all(serverId, boardId) }),
  })

  const available = BOARD_FEATURES.filter((feature) => snapshot.serverFeatures[feature.key])
  const allOn = available.every((feature) => snapshot.features[feature.key])
  const allOff = available.every((feature) => !snapshot.features[feature.key])
  const setAll = (on: boolean) => update.mutate(Object.fromEntries(available.map((feature) => [feature.key, on])))

  return (
    <section className="kc-board-modal-section">
      <div className="kc-board-modal-section-head">
        <h4>{t('settings.boardFeatures.title')}</h4>
        <p className="kc-muted">{t('settings.boardFeatures.intro')}</p>
      </div>
      {error && <p className="kc-banner">{error}</p>}

      <div className="kc-features-presets">
        <button
          type="button"
          className="kc-btn kc-btn-ghost"
          disabled={allOff || update.isPending}
          onClick={() => setAll(false)}
        >
          {t('settings.boardFeatures.title')}
        </button>
        <button
          type="button"
          className="kc-btn kc-btn-ghost"
          disabled={allOn || update.isPending}
          onClick={() => setAll(true)}
        >
          {t('settings.boardFeatures.everything')}
        </button>
      </div>

      <ul className="kc-features-list">
        {BOARD_FEATURES.map((feature) => {
          const serverOn = snapshot.serverFeatures[feature.key]
          return (
            <SwitchRow
              key={feature.key}
              label={feature.label}
              description={serverOn ? feature.description : t('settings.boardFeatures.offForServer')}
              on={snapshot.features[feature.key]}
              disabled={!serverOn}
              onToggle={(on) => update.mutate({ [feature.key]: on })}
            />
          )
        })}
      </ul>
    </section>
  )
}
