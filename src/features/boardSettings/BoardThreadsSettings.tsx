import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { readableError } from '../../api/http'
import { t, type MessageKey } from '../../i18n'
import { Trans } from '../../i18n/Trans'
import { SwitchRow } from '../../components/SwitchRow'
import {
  disableBoardThreads,
  fetchBoardThreads,
  saveBoardThreads,
  type BoardThreads,
  type ThreadUpdates,
} from '../../services/notificationsService'
import { boardKeys } from '../board/boardQueries'

type BoardThreadsSettingsProps = {
  serverId: string
  boardId: string
}

const UPDATES: { value: ThreadUpdates; label: MessageKey }[] = [
  { value: 'BOTH', label: 'settings.threads.updatesBoth' },
  { value: 'THREAD', label: 'settings.threads.updatesThread' },
  { value: 'CHANNEL', label: 'settings.threads.updatesChannel' },
]

/**
 * A thread per task: each task on the board gets its own thread for discussion, in one of the board's
 * feed channels. The same settings as /board threads in Discord. Changes save straight away.
 */
export function BoardThreadsSettings({ serverId, boardId }: BoardThreadsSettingsProps) {
  const queryClient = useQueryClient()
  const queryKey = [...boardKeys.all(serverId, boardId), 'threads']
  const [error, setError] = useState('')
  const query = useQuery({ queryKey, queryFn: () => fetchBoardThreads(serverId, boardId) })

  const settle = {
    onMutate: () => setError(''),
    onSuccess: (data: BoardThreads) => queryClient.setQueryData(queryKey, data),
    onError: (err: unknown) => setError(readableError(err, t('common.changeNotSaved'))),
  }
  const save = useMutation({
    mutationFn: (settings: { channelId: string; privateThreads: boolean; updates: ThreadUpdates }) =>
      saveBoardThreads(serverId, boardId, settings),
    ...settle,
  })
  const disable = useMutation({ mutationFn: () => disableBoardThreads(serverId, boardId), ...settle })

  const data = query.data
  const busy = save.isPending || disable.isPending
  const current = data && {
    channelId: data.channelId ?? data.channels[0]?.channelId ?? '',
    privateThreads: data.privateThreads,
    updates: data.updates,
  }
  const chosen = data?.channels.find((channel) => channel.channelId === current?.channelId)

  function change(changes: Partial<{ channelId: string; privateThreads: boolean; updates: ThreadUpdates }>) {
    if (current) save.mutate({ ...current, ...changes })
  }

  return (
    <section className="kc-board-modal-section">
      <div className="kc-board-modal-section-head">
        <h4>{t('settings.threads.title')}</h4>
        <p className="kc-muted">{t('settings.threads.intro')}</p>
      </div>
      {error && <p className="kc-banner">{error}</p>}
      {query.isPending && <p className="kc-muted">{t('common.loadingEllipsis')}</p>}
      {data && data.channels.length === 0 && !data.enabled && (
        <p className="kc-muted">
          <Trans k="settings.threads.noFeed" />
        </p>
      )}
      {data && current && (data.channels.length > 0 || data.enabled) && (
        <>
          <ul className="kc-features-list">
            <SwitchRow
              label={t('settings.threads.perTask')}
              description={
                data.enabled && !data.active ? t('settings.threads.notWorking') : t('settings.threads.perTaskHint')
              }
              on={data.enabled}
              disabled={busy || (!data.enabled && !current.channelId)}
              onToggle={(on) => (on ? change({}) : disable.mutate())}
            />
          </ul>
          {data.enabled && (
            <div className="kc-board-threads-fields">
              <label className="kc-field">
                <span className="kc-field-label">{t('settings.threads.channel')}</span>
                <select
                  className="kc-input"
                  value={current.channelId}
                  disabled={busy}
                  onChange={(event) => change({ channelId: event.target.value })}
                >
                  {!chosen && <option value={current.channelId}>{t('settings.threads.channelWithoutFeed')}</option>}
                  {data.channels.map((channel) => (
                    <option key={channel.channelId} value={channel.channelId} disabled={!channel.botCanThread}>
                      #{channel.name}
                      {channel.botCanThread ? '' : t('settings.threads.botCannot')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="kc-field">
                <span className="kc-field-label">{t('settings.threads.updatesGoTo')}</span>
                <select
                  className="kc-input"
                  value={current.updates}
                  disabled={busy}
                  onChange={(event) => change({ updates: event.target.value as ThreadUpdates })}
                >
                  {UPDATES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.label)}
                    </option>
                  ))}
                </select>
              </label>
              <ul className="kc-features-list">
                <SwitchRow
                  label={t('settings.threads.private')}
                  description={
                    chosen && !chosen.botCanPrivateThread && !current.privateThreads
                      ? t('settings.threads.privateNotPossible')
                      : t('settings.threads.privateHint')
                  }
                  on={current.privateThreads}
                  disabled={busy || (!current.privateThreads && !chosen?.botCanPrivateThread)}
                  onToggle={(on) => change({ privateThreads: on })}
                />
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
