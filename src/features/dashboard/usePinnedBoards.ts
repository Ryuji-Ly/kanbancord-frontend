import { useCallback, useMemo } from 'react'
import type { PinnedBoard } from '../preferences/preferencesModel'
import { usePreferences, useSavePreferences } from '../preferences/usePreferences'

/** Enough for every board someone works on; the row at the top stays a shortcut, not a second list. */
export const MAX_PINNED_BOARDS = 24

const same = (pin: PinnedBoard, serverId: string, boardId: string) => pin.serverId === serverId && pin.boardId === boardId

/**
 * The boards the user pinned to the dashboard, saved with their account so the pins follow them to
 * every device. Pinning a board again unpins it.
 */
export function usePinnedBoards() {
  const preferences = usePreferences()
  const { mutate: save } = useSavePreferences()
  const pins = useMemo(() => preferences?.pinnedBoards ?? [], [preferences?.pinnedBoards])

  const isPinned = useCallback(
    (serverId: string, boardId: number | string) => pins.some((pin) => same(pin, serverId, String(boardId))),
    [pins],
  )

  const togglePin = useCallback(
    (serverId: string, boardId: number | string) => {
      const id = String(boardId)
      const next = pins.some((pin) => same(pin, serverId, id))
        ? pins.filter((pin) => !same(pin, serverId, id))
        : [...pins, { serverId, boardId: id }].slice(-MAX_PINNED_BOARDS)
      save({ pinnedBoards: next })
    },
    [pins, save],
  )

  return { pins, isPinned, togglePin, ready: preferences !== undefined }
}
