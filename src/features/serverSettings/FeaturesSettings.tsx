import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { readableError } from '../../api/http'
import {
  FEATURES,
  NO_FEATURES,
  fetchOpenPermissions,
  setOpenPermissions,
  updateServerFeatures,
  type ServerFeatures,
} from '../../services/featuresService'
import { SwitchRow } from '../../components/SwitchRow'
import { ConfirmDialog } from '../board/components/ConfirmDialog'
import { serverKeys } from '../server/serverQueries'

type FeaturesSettingsProps = {
  serverId: string
  features: ServerFeatures
}

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

  const openQuery = useQuery({
    queryKey: serverKeys.openPermissions(serverId),
    queryFn: () => fetchOpenPermissions(serverId),
  })
  const open = openQuery.data ?? false
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [openError, setOpenError] = useState('')
  const switchOpen = useMutation({
    mutationFn: (enabled: boolean) => setOpenPermissions(serverId, enabled),
    onMutate: () => setOpenError(''),
    onSuccess: (enabled) => {
      queryClient.setQueryData(serverKeys.openPermissions(serverId), enabled)
      setConfirmOpen(false)
    },
    onError: (err) => setOpenError(readableError(err, 'The change could not be saved')),
    onSettled: () => queryClient.invalidateQueries({ queryKey: serverKeys.all(serverId) }),
  })

  // Custom permissions and open permissions exclude each other, so "everything" leaves custom
  // permissions out while open permissions are on.
  const everything = open ? FEATURES.filter((feature) => feature.key !== 'PERMISSIONS') : FEATURES
  const allOn = everything.every((feature) => features[feature.key])
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
          onClick={() =>
            update.mutate(Object.fromEntries(everything.map((feature) => [feature.key, true])) as Partial<ServerFeatures>)
          }
        >
          Enable everything
        </button>
      </div>

      <ul className="kc-features-list">
        {FEATURES.map((feature) => (
          <SwitchRow
            key={feature.key}
            label={feature.label}
            description={
              feature.key === 'PERMISSIONS' && open
                ? `${feature.description} Turn open permissions off first.`
                : feature.description
            }
            on={features[feature.key]}
            disabled={feature.key === 'PERMISSIONS' && open && !features.PERMISSIONS}
            onToggle={(on) => update.mutate({ [feature.key]: on })}
          />
        ))}
      </ul>

      <section className="kc-appearance-section">
        <h4>Open permissions</h4>
        {openError && <p className="kc-banner">{openError}</p>}
        <ul className="kc-features-list">
          <SwitchRow
            label="Everyone may do everything"
            description={
              features.PERMISSIONS && !open
                ? 'Turn custom permissions off first: their rules are kept for when you switch back.'
                : 'Everyone who can talk in this server may create, change, move and delete columns, tasks, labels and priority levels, whatever their roles. Managing the server, board permissions, deleting or archiving boards and the audit log stay with its managers.'
            }
            on={open}
            disabled={openQuery.isPending || switchOpen.isPending || (features.PERMISSIONS && !open)}
            onToggle={(on) => (on ? setConfirmOpen(true) : switchOpen.mutate(false))}
          />
        </ul>
      </section>

      {confirmOpen && (
        <ConfirmDialog
          title="Turn on open permissions?"
          busy={switchOpen.isPending}
          error={openError}
          confirmLabel="Turn on"
          busyLabel="Turning on..."
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => switchOpen.mutate(true)}
        >
          Everyone who can talk in this server will be able to create, change, move and delete columns, tasks, labels
          and priority levels, whatever their roles. Best for a small group that trusts each other.
        </ConfirmDialog>
      )}
    </div>
  )
}
