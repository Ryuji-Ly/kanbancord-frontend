import { useState } from 'react'
import { createPortal } from 'react-dom'
import { readableError } from '../../api/http'
import { t } from '../../i18n'
import {
  importBoard,
  partsInFile,
  readBoardFile,
  type BoardFile,
  type BoardImportResult,
  type BoardPart,
} from '../../services/boardTransferService'
import { PartsChecklist } from './PartsChecklist'

type ImportBoardDialogProps = {
  serverId: string
  onClose: () => void
  /** A board was created; the caller refreshes its list. */
  onImported: (result: BoardImportResult) => void
  onOpenBoard: (boardId: number) => void
}

/** What an import left out, by kind, in the order they are explained. */
const SKIPPED = ['assignees', 'roles', 'permissions', 'commentAuthors'] as const

/**
 * A new board from a board file: pick the file, check its name and which parts to bring in, import.
 * Afterwards it says what was left out (people and roles not in this server, rules that could not be
 * set) and offers to open the new board.
 */
export function ImportBoardDialog({ serverId, onClose, onImported, onOpenBoard }: ImportBoardDialogProps) {
  const [file, setFile] = useState<BoardFile | null>(null)
  const [name, setName] = useState('')
  const [chosen, setChosen] = useState<Set<BoardPart>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BoardImportResult | null>(null)

  async function pick(selected: File | undefined) {
    setError('')
    if (!selected) return
    const read = readBoardFile(await selected.text())
    if (!read) {
      setFile(null)
      setError(t('settings.transfer.notAFile'))
      return
    }
    setFile(read)
    setName(read.board.name)
    setChosen(new Set(partsInFile(read)))
  }

  async function submit() {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const imported = await importBoard(serverId, { document: file, parts: [...chosen], name: name.trim() })
      setResult(imported)
      onImported(imported)
    } catch (err) {
      setError(readableError(err, t('settings.transfer.importFailed')))
    } finally {
      setBusy(false)
    }
  }

  const skipped = result ? SKIPPED.filter((kind) => (result.skipped[kind] ?? 0) > 0) : []

  return createPortal(
    <div
      className="kc-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('settings.transfer.importTitle')}
      onClick={(event) => {
        event.stopPropagation()
        if (!busy) onClose()
      }}
    >
      <div className="kc-modal kc-modal--confirm" onClick={(event) => event.stopPropagation()}>
        <div className="kc-modal-header">
          <h3 className="kc-modal-title">{t('settings.transfer.importTitle')}</h3>
        </div>
        <div className="kc-modal-body">
          {result ? (
            <>
              <p>{t('settings.transfer.imported', { name: result.board.name })}</p>
              {skipped.length > 0 && (
                <ul className="kc-transfer-skipped">
                  {skipped.map((kind) => (
                    <li key={kind}>{t(`settings.transfer.skipped.${kind}`, { count: result.skipped[kind] })}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <p className="kc-muted">{t('settings.transfer.importIntro')}</p>
              <input
                type="file"
                accept=".json,application/json"
                className="kc-input"
                aria-label={t('settings.transfer.chooseFile')}
                disabled={busy}
                onChange={(event) => void pick(event.target.files?.[0])}
              />
              {file && (
                <>
                  <p className="kc-muted">
                    {t('settings.transfer.fileSummary', { columns: file.columns.length, tasks: file.tasks.length })}
                  </p>
                  <label className="kc-field">
                    <span className="kc-field-label">{t('settings.transfer.name')}</span>
                    <input
                      type="text"
                      className="kc-input"
                      value={name}
                      maxLength={100}
                      disabled={busy}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  {partsInFile(file).length > 0 && (
                    <>
                      <p>{t('settings.transfer.alsoBring')}</p>
                      <PartsChecklist parts={partsInFile(file)} chosen={chosen} disabled={busy} onChange={setChosen} />
                    </>
                  )}
                </>
              )}
            </>
          )}
          {error && <p className="kc-banner">{error}</p>}
        </div>
        <div className="kc-modal-footer">
          {result ? (
            <>
              <button type="button" className="kc-btn kc-btn-ghost" onClick={onClose}>
                {t('common.close')}
              </button>
              <button type="button" className="kc-btn kc-btn-primary" onClick={() => onOpenBoard(result.board.boardId)}>
                {t('settings.transfer.openBoard')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="kc-btn kc-btn-ghost" onClick={onClose} disabled={busy}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="kc-btn kc-btn-primary"
                onClick={() => void submit()}
                disabled={busy || !file || !name.trim()}
              >
                {busy ? t('settings.transfer.importing') : t('settings.transfer.import')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
