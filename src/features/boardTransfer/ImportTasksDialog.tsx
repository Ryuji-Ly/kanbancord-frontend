import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiX } from 'react-icons/fi'
import { useQueryClient } from '@tanstack/react-query'
import { readableError } from '../../api/http'
import { t, tOr } from '../../i18n'
import {
  formatOfFile,
  IMPORT_FIELDS,
  IMPORT_FORMATS,
  importTasks,
  previewTaskImport,
  type ImportField,
  type ImportFormat,
  type TaskImportInput,
  type TaskImportPlan,
} from '../../services/taskImportService'
import { sortColumns } from '../board/boardModel'
import { boardKeys, useBoardSnapshot } from '../board/boardQueries'

type ImportTasksDialogProps = {
  serverId: string
  boardId: string
  boardName: string
  onClose: () => void
  showToast: (text: string, type?: 'success' | 'error') => void
}

/** How long typing pauses before the preview is made again. */
const PREVIEW_DELAY_MS = 400
/** Tasks shown under each column in the preview; the rest are counted. */
const SHOWN_PER_COLUMN = 5

/**
 * Adding tasks to a board from a pasted list or table, or a file. The API reads it and says what
 * would happen; the preview updates as the text and options change, and importing does exactly that.
 */
export function ImportTasksDialog({ serverId, boardId, boardName, onClose, showToast }: ImportTasksDialogProps) {
  const queryClient = useQueryClient()
  const snapshot = useBoardSnapshot(serverId, boardId).data
  const columns = useMemo(() => sortColumns(snapshot?.columns ?? []), [snapshot])
  const canCreateColumns = Boolean(snapshot?.permissions.CREATE_COLUMN?.allowed)

  const [source, setSource] = useState<'paste' | 'file'>('paste')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [format, setFormat] = useState<ImportFormat>('AUTO')
  const [defaultColumnId, setDefaultColumnId] = useState<number | null>(null)
  const [createColumns, setCreateColumns] = useState(true)
  const [fields, setFields] = useState<ImportField[]>([])
  const [plan, setPlan] = useState<TaskImportPlan | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const input: TaskImportInput = useMemo(
    () => ({ text, format, defaultColumnId, createColumns: canCreateColumns && createColumns, fields }),
    [text, format, defaultColumnId, createColumns, canCreateColumns, fields],
  )

  // The preview follows the text and options, a moment after the last change.
  useEffect(() => {
    if (!text.trim()) return
    let current = true
    const timer = window.setTimeout(() => {
      previewTaskImport(serverId, boardId, input)
        .then((next) => {
          if (!current) return
          setPlan(next)
          setPreviewError('')
        })
        .catch((err: unknown) => {
          if (!current) return
          setPlan(null)
          setPreviewError(readableError(err, t('board.import.previewFailed')))
        })
    }, PREVIEW_DELAY_MS)
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [serverId, boardId, input, text])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !busy && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  function changeText(next: string) {
    setText(next)
    // A different text may be a different table: its columns are read from its own headers again.
    setFields([])
    if (!next.trim()) {
      setPlan(null)
      setPreviewError('')
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    setFormat(formatOfFile(file.name))
    changeText(await file.text())
  }

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const done = await importTasks(serverId, boardId, input)
      void queryClient.invalidateQueries({ queryKey: boardKeys.all(serverId, boardId) })
      showToast(t('board.import.imported', { count: done.tasks.length }), 'success')
      onClose()
    } catch (err) {
      setError(readableError(err, t('board.import.failed')))
    } finally {
      setBusy(false)
    }
  }

  const shown = text.trim() ? plan : null
  const fallback = defaultColumnId ?? columns[0]?.columnId ?? null

  return createPortal(
    <div
      className="kc-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('board.import.title')}
      onClick={(event) => {
        event.stopPropagation()
        if (!busy) onClose()
      }}
    >
      <div className="kc-modal kc-import-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="kc-modal-header">
          <h3 className="kc-modal-title">{t('board.import.titleFor', { name: boardName })}</h3>
          <button type="button" className="kc-modal-close" aria-label={t('common.close')} onClick={onClose} disabled={busy}>
            <FiX aria-hidden="true" />
          </button>
        </div>
        <div className="kc-modal-body kc-import-body">
          <p className="kc-muted">{t('board.import.intro')}</p>

          <div className="kc-import-source" role="tablist" aria-label={t('board.import.source')}>
            {(['paste', 'file'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={source === kind}
                className={`kc-btn kc-btn-small ${source === kind ? 'kc-btn-primary' : 'kc-btn-ghost'}`}
                onClick={() => setSource(kind)}
              >
                {kind === 'paste' ? t('board.import.paste') : t('board.import.file')}
              </button>
            ))}
          </div>

          {source === 'paste' ? (
            <textarea
              className="kc-input kc-import-text"
              rows={8}
              value={text}
              placeholder={t('board.import.placeholder')}
              aria-label={t('board.import.paste')}
              disabled={busy}
              onChange={(event) => changeText(event.target.value)}
            />
          ) : (
            <label className="kc-field">
              <span className="kc-field-label">{fileName || t('board.import.chooseFile')}</span>
              <input
                type="file"
                className="kc-input"
                accept=".txt,.md,.markdown,.csv,.tsv,.json,text/plain,text/csv,text/markdown,application/json"
                disabled={busy}
                onChange={(event) => void pick(event.target.files?.[0])}
              />
            </label>
          )}

          <div className="kc-import-options">
            <label className="kc-field">
              <span className="kc-field-label">{t('board.import.format')}</span>
              <select
                className="kc-input"
                value={format}
                disabled={busy}
                onChange={(event) => {
                  setFormat(event.target.value as ImportFormat)
                  setFields([])
                }}
              >
                {IMPORT_FORMATS.map((option) => (
                  <option key={option} value={option}>
                    {t(`board.import.formats.${option}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="kc-field">
              <span className="kc-field-label">{t('board.import.defaultColumn')}</span>
              <select
                className="kc-input"
                value={fallback ?? ''}
                disabled={busy || columns.length === 0}
                onChange={(event) => setDefaultColumnId(Number(event.target.value))}
              >
                {columns.map((column) => (
                  <option key={column.columnId} value={column.columnId}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {canCreateColumns && (
            <label className="kc-import-check">
              <input type="checkbox" checked={createColumns} disabled={busy} onChange={(event) => setCreateColumns(event.target.checked)} />
              {t('board.import.createColumns')}
            </label>
          )}

          {shown && shown.headers.length > 0 && (
            <fieldset className="kc-import-fields">
              <legend className="kc-field-label">{t('board.import.fields')}</legend>
              {shown.headers.map((header, index) => (
                <label key={`${index}:${header}`} className="kc-import-field">
                  <span>{header}</span>
                  <select
                    className="kc-input"
                    value={shown.fields[index] ?? 'IGNORE'}
                    disabled={busy}
                    onChange={(event) => {
                      const next = [...shown.fields]
                      next[index] = event.target.value as ImportField
                      setFields(next)
                    }}
                  >
                    {IMPORT_FIELDS.map((field) => (
                      <option key={field} value={field}>
                        {t(`board.import.fieldNames.${field}`)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </fieldset>
          )}

          <section className="kc-import-preview" aria-live="polite" aria-label={t('board.import.preview')}>
            <h4>{t('board.import.preview')}</h4>
            {!text.trim() ? (
              <p className="kc-muted">{t('board.import.empty')}</p>
            ) : previewError ? (
              <p className="kc-banner">{previewError}</p>
            ) : !shown ? (
              <span className="kc-spinner" aria-hidden="true" />
            ) : (
              <>
                <p className="kc-muted">
                  {t('board.import.summary', { tasks: shown.tasks.length, columns: shown.columns.length })} ·{' '}
                  {t(`board.import.formats.${shown.format}`)}
                </p>
                <div className="kc-import-columns">
                  {shown.columns.map((column) => {
                    const tasks = shown.tasks.filter((task) => task.column === column.name)
                    return (
                      <div key={column.name} className="kc-import-column">
                        <p className="kc-import-column-name">
                          {column.name} <span className="kc-muted">({column.tasks})</span>
                          {column.created && <span className="kc-import-new">{t('board.import.newColumn')}</span>}
                        </p>
                        <ul>
                          {tasks.slice(0, SHOWN_PER_COLUMN).map((task, index) => (
                            <li key={index}>{task.title}</li>
                          ))}
                          {tasks.length > SHOWN_PER_COLUMN && (
                            <li className="kc-muted">{t('board.import.more', { count: tasks.length - SHOWN_PER_COLUMN })}</li>
                          )}
                        </ul>
                      </div>
                    )
                  })}
                </div>
                {shown.notes.length > 0 && (
                  <ul className="kc-import-notes">
                    {shown.notes.map((note) => (
                      <li key={note.code}>
                        {tOr(`board.import.notes.${note.code}`, note.code, { count: note.count })}
                        {note.examples && note.examples.length > 0 && <span className="kc-muted"> ({note.examples.join(', ')})</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
          {error && <p className="kc-banner">{error}</p>}
        </div>
        <div className="kc-modal-footer">
          <button type="button" className="kc-btn kc-btn-ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="kc-btn kc-btn-primary"
            onClick={() => void submit()}
            disabled={busy || !shown || shown.tasks.length === 0}
          >
            {busy ? t('board.import.importing') : t('board.import.import', { count: shown?.tasks.length ?? 0 })}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
