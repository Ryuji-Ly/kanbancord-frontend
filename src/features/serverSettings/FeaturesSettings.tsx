import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { readableError } from '../../api/http'
import { t } from '../../i18n'
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
      setError(readableError(err, t('common.changeNotSaved')))
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
    onError: (err) => setOpenError(readableError(err, t('common.changeNotSaved'))),
    onSettled: () => queryClient.invalidateQueries({ queryKey: serverKeys.all(serverId) }),
  })

  // Custom permissions and open permissions exclude each other, so "everything" leaves custom
  // permissions out while open permissions are on.
  const everything = open ? FEATURES.filter((feature) => feature.key !== 'PERMISSIONS') : FEATURES
  const allOn = everything.every((feature) => features[feature.key])
  const allOff = FEATURES.every((feature) => !features[feature.key])

  return (
    <div className="kc-features">
      <p className="kc-muted">{t('settings.features.intro')}</p>
      {error && <p className="kc-banner">{error}</p>}

      <div className="kc-features-presets">
        <button
          type="button"
          className="kc-btn kc-btn-ghost"
          disabled={allOff || update.isPending}
          onClick={() => update.mutate(NO_FEATURES)}
        >
          {t('settings.boardFeatures.title')}
        </button>
        <button
          type="button"
          className="kc-btn kc-btn-primary"
          disabled={allOn || update.isPending}
          onClick={() =>
            update.mutate(Object.fromEntries(everything.map((feature) => [feature.key, true])) as Partial<ServerFeatures>)
          }
        >
          {t('settings.features.enableEverything')}
        </button>
      </div>

      <ul className="kc-features-list">
        {FEATURES.map((feature) => (
          <SwitchRow
            key={feature.key}
            label={feature.label}
            description={
              feature.key === 'PERMISSIONS' && open
                ? t('settings.features.openFirst', { description: feature.description })
                : feature.description
            }
            on={features[feature.key]}
            disabled={feature.key === 'PERMISSIONS' && open && !features.PERMISSIONS}
            onToggle={(on) => update.mutate({ [feature.key]: on })}
          />
        ))}
      </ul>

      <section className="kc-appearance-section">
        <h4>{t('settings.features.open')}</h4>
        {openError && <p className="kc-banner">{openError}</p>}
        <ul className="kc-features-list">
          <SwitchRow
            label={t('settings.features.openLabel')}
            description={features.PERMISSIONS && !open ? t('settings.features.customFirst') : t('settings.features.openHint')}
            on={open}
            disabled={openQuery.isPending || switchOpen.isPending || (features.PERMISSIONS && !open)}
            onToggle={(on) => (on ? setConfirmOpen(true) : switchOpen.mutate(false))}
          />
        </ul>
      </section>

      {confirmOpen && (
        <ConfirmDialog
          title={t('settings.features.confirmTitle')}
          busy={switchOpen.isPending}
          error={openError}
          confirmLabel={t('settings.features.turnOn')}
          busyLabel={t('settings.features.turningOn')}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => switchOpen.mutate(true)}
        >
          {t('settings.features.confirm')}
        </ConfirmDialog>
      )}
    </div>
  )
}
