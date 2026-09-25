import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { readableError } from '../../api/http'
import {
  FEATURES,
  NO_FEATURES,
  updateServerFeatures,
  type FeatureKey,
  type ServerFeatures,
} from '../../services/featuresService'
import { serverKeys } from '../server/serverQueries'

type FeaturesSettingsProps = {
  serverId: string
  features: ServerFeatures
}

const ALL_FEATURES = Object.fromEntries(FEATURES.map((feature) => [feature.key, true])) as ServerFeatures

/**
 * Switches the server's optional features on and off. With all of them off the server is in simple
 * mode: boards, columns, and tasks with a title and description. Switching a feature off hides it
 * and keeps its data, so switching it back on brings everything back.
 */
export function FeaturesSettings({ serverId, features }: FeaturesSettingsProps) {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')

  const update = useMutation({
    mutationFn: (changes: Partial<ServerFeatures>) => updateServerFeatures(serverId, changes),
    onMutate: async (changes) => {
      setError('')
      await queryClient.cancelQueries({ queryKey: serverKeys.features(serverId) })
      const previous = queryClient.getQueryData<ServerFeatures>(serverKeys.features(serverId))
      queryClient.setQueryData<ServerFeatures>(serverKeys.features(serverId), { ...features, ...changes })
      return { previous }
    },
    onError: (err, _changes, context) => {
      if (context?.previous) queryClient.setQueryData(serverKeys.features(serverId), context.previous)
      setError(readableError(err, 'The change could not be saved'))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: serverKeys.all(serverId) }),
  })

  const allOn = FEATURES.every((feature) => features[feature.key])
  const allOff = FEATURES.every((feature) => !features[feature.key])

  return (
    <div className="kc-features">
      <p className="kc-muted">
        Simple mode keeps boards to the essentials: columns, and tasks with a title and description. Switch on only
        what this server needs. Switching something off hides it and keeps its data.
      </p>
      {error && <p className="kc-banner">{error}</p>}

      <div className="kc-features-presets">
        <button
          type="button"
          className="kc-btn kc-btn-ghost"
          disabled={allOff || update.isPending}
          onClick={() => update.mutate(NO_FEATURES)}
        >
          Simple mode
        </button>
        <button
          type="button"
          className="kc-btn kc-btn-primary"
          disabled={allOn || update.isPending}
          onClick={() => update.mutate(ALL_FEATURES)}
        >
          Enable everything
        </button>
      </div>

      <ul className="kc-features-list">
        {FEATURES.map((feature) => (
          <FeatureRow
            key={feature.key}
            featureKey={feature.key}
            label={feature.label}
            description={feature.description}
            on={features[feature.key]}
            onToggle={(on) => update.mutate({ [feature.key]: on })}
          />
        ))}
      </ul>
    </div>
  )
}

function FeatureRow({
  featureKey,
  label,
  description,
  on,
  onToggle,
}: {
  featureKey: FeatureKey
  label: string
  description: string
  on: boolean
  onToggle: (on: boolean) => void
}) {
  const id = `feature-${featureKey}`
  return (
    <li className="kc-feature-row">
      <div className="kc-feature-text">
        <label htmlFor={id} className="kc-feature-label">
          {label}
        </label>
        <p className="kc-muted">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        className={`kc-switch${on ? ' kc-switch--on' : ''}`}
        onClick={() => onToggle(!on)}
      >
        <span className="kc-switch-knob" aria-hidden="true" />
      </button>
    </li>
  )
}
