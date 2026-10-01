import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { readableError } from '../../api/http'
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

const UPDATES: { value: ThreadUpdates; label: string }[] = [
  { value: 'BOTH', label: 'The thread and the channel' },
  { value: 'THREAD', label: 'Only the thread' },
  { value: 'CHANNEL', label: 'Only the channel' },
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
    onError: (err: unknown) => setError(readableError(err, 'The change could not be saved')),
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
        <h4>Task threads</h4>
        <p className="kc-muted">
          Give each task its own thread for discussion, in one of this board&apos;s update feed channels. A thread
          follows its task&apos;s title and is archived when the task is deleted or archived. Comments made in
          KanbanCord are posted in it; messages in the thread stay in Discord. Changes save straight away.
        </p>
      </div>
      {error && <p className="kc-banner">{error}</p>}
      {query.isPending && <p className="kc-muted">Loading…</p>}
      {data && data.channels.length === 0 && !data.enabled && (
        <p className="kc-muted">
          This board has no update feed yet. Add one in the server&apos;s notification settings, or with{' '}
          <code>/kanbancord feed</code> in Discord, then switch threads on here.
        </p>
      )}
      {data && current && (data.channels.length > 0 || data.enabled) && (
        <>
          <ul className="kc-features-list">
            <SwitchRow
              label="A thread per task"
              description={
                data.enabled && !data.active
                  ? 'On, but not working: the chosen channel no longer has a feed for this board. Choose another feed channel.'
                  : 'Each task gets its thread when something next happens to it.'
              }
              on={data.enabled}
              disabled={busy || (!data.enabled && !current.channelId)}
              onToggle={(on) => (on ? change({}) : disable.mutate())}
            />
          </ul>
          {data.enabled && (
            <div className="kc-board-threads-fields">
              <label className="kc-field">
                <span className="kc-field-label">Channel</span>
                <select
                  className="kc-input"
                  value={current.channelId}
                  disabled={busy}
                  onChange={(event) => change({ channelId: event.target.value })}
                >
                  {!chosen && <option value={current.channelId}>A channel without a feed for this board</option>}
                  {data.channels.map((channel) => (
                    <option key={channel.channelId} value={channel.channelId} disabled={!channel.botCanThread}>
                      #{channel.name}
                      {channel.botCanThread ? '' : ' (the bot cannot make threads here)'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="kc-field">
                <span className="kc-field-label">A task&apos;s updates go to</span>
                <select
                  className="kc-input"
                  value={current.updates}
                  disabled={busy}
                  onChange={(event) => change({ updates: event.target.value as ThreadUpdates })}
                >
                  {UPDATES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <ul className="kc-features-list">
                <SwitchRow
                  label="Private threads"
                  description={
                    chosen && !chosen.botCanPrivateThread && !current.privateThreads
                      ? 'Not possible in this channel: private threads need a text channel where the bot may create private threads.'
                      : "Only the task's creator and assignees are in the thread, plus server moderators. New assignees are added."
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
