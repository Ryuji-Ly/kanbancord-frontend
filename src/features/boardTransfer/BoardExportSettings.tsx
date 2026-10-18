import { useState } from 'react'
import { readableError } from '../../api/http'
import { isActivity } from '../../activity/detect'
import { t } from '../../i18n'
import type { BoardSnapshot } from '../../services/boardsService'
import { downloadBoardFile, exportBoard, type BoardPart } from '../../services/boardTransferService'
import { PartsChecklist } from './PartsChecklist'

/**
 * Downloading the board as a file. Only the parts the board uses are offered, and its permission
 * rules only to those who may edit them. Inside the Discord Activity files cannot be downloaded, so
 * it says to export on the website.
 */
export function BoardExportSettings({ serverId, boardId, snapshot }: { serverId: string; boardId: string; snapshot: BoardSnapshot }) {
  const offered: BoardPart[] = [
    ...(snapshot.features.LABELS ? (['labels'] as const) : []),
    ...(snapshot.features.PRIORITIES ? (['priorities'] as const) : []),
    ...(snapshot.features.ASSIGNEES ? (['assignees'] as const) : []),
    ...(snapshot.features.COMMENTS ? (['comments'] as const) : []),
    ...(snapshot.features.PERMISSIONS && snapshot.permissions.EDIT_BOARD_PERMISSIONS?.allowed ? (['permissions'] as const) : []),
  ]
  const [chosen, setChosen] = useState<Set<BoardPart>>(() => new Set(offered))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function download() {
    setBusy(true)
    setError('')
    try {
      downloadBoardFile(await exportBoard(serverId, boardId, offered.filter((part) => chosen.has(part))))
    } catch (err) {
      setError(readableError(err, t('settings.transfer.exportFailed')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="kc-board-modal-section kc-board-modal-section--half">
      <div className="kc-board-modal-section-head">
        <h4>{t('settings.transfer.exportTitle')}</h4>
        <p className="kc-muted">{t('settings.transfer.exportIntro')}</p>
      </div>
      {isActivity() ? (
        <p className="kc-muted">{t('settings.transfer.exportInActivity')}</p>
      ) : (
        <>
          {offered.length > 0 && <PartsChecklist parts={offered} chosen={chosen} disabled={busy} onChange={setChosen} />}
          {error && <p className="kc-banner">{error}</p>}
          <button type="button" className="kc-btn kc-btn-ghost" onClick={() => void download()} disabled={busy}>
            {busy ? t('settings.transfer.preparing') : t('settings.transfer.download')}
          </button>
        </>
      )}
    </section>
  )
}
