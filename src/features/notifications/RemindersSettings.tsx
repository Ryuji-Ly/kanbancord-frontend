import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiX } from 'react-icons/fi'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { readableError } from '../../api/http'
import { t } from '../../i18n'
import {
  fetchBoardReminders,
  fetchMyBoardReminders,
  fetchMyReminders,
  fetchServerReminders,
  saveBoardReminders,
  saveMyBoardReminders,
  saveMyReminders,
  saveServerReminders,
  type MyReminderTimes,
  type ReminderTimes,
} from '../../services/remindersService'
import { formatReminderTimes } from './reminderFormat'
import { ReminderTimesEditor } from './ReminderTimesEditor'

/**
 * Reminder times before a due date, where each level sets them: the server (Server settings → Notifications), a
 * board (Board settings → Notifications), and each person, for every board (Settings → Notifications) or one
 * board (the board's ⋯ menu → Your reminders).
 */

const remindersKey = (...parts: string[]) => ['reminders', ...parts] as const

/** Saves through `save` and keeps the cached times in step; reports a refused change. */
function useSave<T>(key: readonly string[], save: (minutes: number[] | null) => Promise<T>) {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const mutation = useMutation({
    mutationFn: save,
    onMutate: () => setError(''),
    onSuccess: (data) => queryClient.setQueryData(key, data),
    onError: (err) => setError(readableError(err, t('common.changeNotSaved'))),
    // Every level's "effective" times can depend on the one changed.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['reminders'] }),
  })
  return { mutation, error }
}

function Current({ times }: { times: number[] }) {
  return <p className="kc-muted">{t('notifications.reminders.current', { times: formatReminderTimes(times) })}</p>
}

export function ServerRemindersSection({ serverId }: { serverId: string }) {
  const key = remindersKey('server', serverId)
  const query = useQuery({ queryKey: key, queryFn: () => fetchServerReminders(serverId) })
  const { mutation, error } = useSave<ReminderTimes>(key, (minutes) => saveServerReminders(serverId, minutes ?? [1440]))
  return (
    <section className="kc-appearance-section">
      <h4>{t('notifications.reminders.title')}</h4>
      <p className="kc-muted">{t('notifications.reminders.serverHint')}</p>
      {error && <p className="kc-banner">{error}</p>}
      {query.data && (
        <ReminderTimesEditor
          minutes={query.data.minutes}
          effective={query.data.effective}
          disabled={mutation.isPending}
          onSave={(minutes) => mutation.mutate(minutes)}
        />
      )}
    </section>
  )
}

export function BoardRemindersSection({ serverId, boardId }: { serverId: string; boardId: string }) {
  const key = remindersKey('board', serverId, boardId)
  const query = useQuery({ queryKey: key, queryFn: () => fetchBoardReminders(serverId, boardId) })
  const { mutation, error } = useSave<ReminderTimes>(key, (minutes) => saveBoardReminders(serverId, boardId, minutes))
  return (
    <section className="kc-board-modal-section">
      <div className="kc-board-modal-section-head">
        <h4>{t('notifications.reminders.title')}</h4>
        <p className="kc-muted">{t('notifications.reminders.boardHint')}</p>
      </div>
      {error && <p className="kc-banner">{error}</p>}
      {query.data && (
        <>
          <ReminderTimesEditor
            minutes={query.data.minutes}
            effective={query.data.effective}
            inherited={{ label: t('notifications.reminders.useServer'), description: t('notifications.reminders.useServerHint') }}
            disabled={mutation.isPending}
            onSave={(minutes) => mutation.mutate(minutes)}
          />
          {query.data.minutes === null && <Current times={query.data.effective} />}
        </>
      )}
    </section>
  )
}

export function MyRemindersSection() {
  const key = remindersKey('mine')
  const query = useQuery({ queryKey: key, queryFn: fetchMyReminders })
  const { mutation, error } = useSave<MyReminderTimes>(key, saveMyReminders)
  const queryClient = useQueryClient()
  const removeBoard = useMutation({
    mutationFn: ({ serverId, boardId }: { serverId: string; boardId: number }) =>
      saveMyBoardReminders(serverId, String(boardId), null),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['reminders'] }),
  })
  const mine = query.data
  return (
    <section className="kc-appearance-section">
      <h4>{t('notifications.reminders.mineTitle')}</h4>
      <p className="kc-muted">{t('notifications.reminders.mineHint')}</p>
      {error && <p className="kc-banner">{error}</p>}
      {mine && (
        <>
          <ReminderTimesEditor
            minutes={mine.everywhere}
            effective={mine.everywhere ?? [1440]}
            inherited={{ label: t('notifications.reminders.useBoards'), description: t('notifications.reminders.useBoardsHint') }}
            disabled={mutation.isPending}
            onSave={(minutes) => mutation.mutate(minutes)}
          />
          <h5 className="kc-reminder-subhead">{t('notifications.reminders.perBoard')}</h5>
          {mine.boards.length === 0 ? (
            <p className="kc-muted">{t('notifications.reminders.perBoardHint')}</p>
          ) : (
            <ul className="kc-server-modes">
              {mine.boards.map((board) => (
                <li key={board.boardId}>
                  <span>
                    <strong>{board.boardName}</strong> · {board.serverName}
                    <br />
                    <span className="kc-muted">{formatReminderTimes(board.minutes)}</span>
                  </span>
                  <button
                    type="button"
                    className="kc-btn kc-btn-small kc-btn-ghost"
                    disabled={removeBoard.isPending}
                    onClick={() => removeBoard.mutate({ serverId: board.serverId, boardId: board.boardId })}
                  >
                    {t('notifications.reminders.remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

/** The person's own times for one board, from the board's ⋯ menu. */
export function MyBoardRemindersDialog({
  serverId,
  boardId,
  boardName,
  onClose,
}: {
  serverId: string
  boardId: string
  boardName: string
  onClose: () => void
}) {
  const key = remindersKey('mine', serverId, boardId)
  const query = useQuery({ queryKey: key, queryFn: () => fetchMyBoardReminders(serverId, boardId) })
  const { mutation, error } = useSave<ReminderTimes>(key, (minutes) => saveMyBoardReminders(serverId, boardId, minutes))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const title = t('notifications.reminders.myBoardTitle', { board: boardName })
  return createPortal(
    <div className="kc-modal-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="kc-modal kc-reminders-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="kc-modal-header">
          <h3 className="kc-modal-title">{title}</h3>
          <button type="button" className="kc-modal-close" aria-label={t('common.close')} onClick={onClose}>
            <FiX aria-hidden="true" />
          </button>
        </div>
        <div className="kc-modal-body">
          <p className="kc-muted">{t('notifications.reminders.myBoardHint')}</p>
          {error && <p className="kc-banner">{error}</p>}
          {query.data && (
            <>
              <ReminderTimesEditor
                minutes={query.data.minutes}
                effective={query.data.effective}
                inherited={{ label: t('notifications.reminders.useBoard'), description: t('notifications.reminders.useBoardHint') }}
                disabled={mutation.isPending}
                onSave={(minutes) => mutation.mutate(minutes)}
              />
              {query.data.minutes === null && <Current times={query.data.effective} />}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
