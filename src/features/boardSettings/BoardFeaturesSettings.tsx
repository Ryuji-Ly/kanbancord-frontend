import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { readableError } from '../../api/http'
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
      setError(readableError(err, 'The change could not be saved'))
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
        <h4>Simple mode</h4>
        <p className="kc-muted">
          Switch off what this board does not need; other boards are not affected. Switching something off hides it
          and keeps its data. Changes here apply immediately.
        </p>
      </div>
      {error && <p className="kc-banner">{error}</p>}

      <div className="kc-features-presets">
        <button
          type="button"
          className="kc-btn kc-btn-ghost"
          disabled={allOff || update.isPending}
          onClick={() => setAll(false)}
        >
          Simple mode
        </button>
        <button
          type="button"
          className="kc-btn kc-btn-ghost"
          disabled={allOn || update.isPending}
          onClick={() => setAll(true)}
        >
          Everything the server allows
        </button>
      </div>

      <ul className="kc-features-list">
        {BOARD_FEATURES.map((feature) => {
          const serverOn = snapshot.serverFeatures[feature.key]
          return (
            <SwitchRow
              key={feature.key}
              label={feature.label}
              description={serverOn ? feature.description : 'Switched off for the whole server, in the server settings.'}
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
