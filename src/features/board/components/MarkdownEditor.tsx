import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react'
import { FiImage } from 'react-icons/fi'
import { readableError } from '../../../api/http'
import {
  MEDIA_ACCEPT,
  UPLOAD_MARKER_PREFIX,
  mediaMarkdown,
  mediaSizeError,
  uploadMedia,
} from '../../../services/mediaService'

type MarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
  /** The board files are uploaded for; without it (or without permission) uploading is not offered. */
  upload?: { serverId: string; boardId: string }
  autoFocus?: boolean
  placeholder?: string
  /** Called when focus leaves the editor, not when it moves to its own buttons or the file picker. */
  onBlur?: () => void
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
}

let uploadCount = 0

/**
 * A markdown textarea that takes images and videos: from the button, pasted, or dropped. Each file
 * is marked in the text while it uploads, and the mark becomes the file's link once it is on Imgur.
 */
export function MarkdownEditor({ value, onChange, upload, autoFocus, placeholder, onBlur, onKeyDown }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  // The text as last rendered, so an upload that finishes later edits the current text.
  const latest = useRef(value)
  const picking = useRef(false)
  const [pending, setPending] = useState(0)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    latest.current = value
  }, [value])

  // Closing the file picker without choosing hands focus back to the text.
  useEffect(() => {
    const input = fileRef.current
    if (!input) return
    const onCancel = () => {
      picking.current = false
      textareaRef.current?.focus()
    }
    input.addEventListener('cancel', onCancel)
    return () => input.removeEventListener('cancel', onCancel)
  }, [upload])

  function change(next: string) {
    latest.current = next
    onChange(next)
  }

  function insertAtCursor(text: string) {
    const textarea = textareaRef.current
    const current = latest.current
    const start = textarea?.selectionStart ?? current.length
    const end = textarea?.selectionEnd ?? current.length
    const before = current.slice(0, start)
    const after = current.slice(end)
    // Files go on their own line.
    const lead = before && !before.endsWith('\n') ? '\n' : ''
    const trail = after.startsWith('\n') ? '' : '\n'
    change(before + lead + text + trail + after)
    const caret = before.length + lead.length + text.length + trail.length
    requestAnimationFrame(() => textarea?.setSelectionRange(caret, caret))
  }

  function uploadFiles(files: File[]) {
    if (!upload || files.length === 0) return
    setError('')
    for (const file of files) {
      const tooLarge = mediaSizeError(file)
      if (tooLarge) {
        setError(tooLarge)
        continue
      }
      const marker = `![Uploading ${file.name.replace(/[[\]()]/g, '')}…](${UPLOAD_MARKER_PREFIX}${++uploadCount})`
      insertAtCursor(marker)
      setPending((count) => count + 1)
      uploadMedia(upload.serverId, upload.boardId, file)
        .then((media) => change(latest.current.replace(marker, mediaMarkdown(file, media))))
        .catch((err: unknown) => {
          change(latest.current.replace(`${marker}\n`, '').replace(marker, ''))
          setError(readableError(err, 'The file could not be uploaded'))
        })
        .finally(() => setPending((count) => count - 1))
    }
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files)
    if (!upload || files.length === 0) return
    event.preventDefault()
    uploadFiles(files)
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    setDragging(false)
    const files = Array.from(event.dataTransfer.files)
    if (!upload || files.length === 0) return
    event.preventDefault()
    textareaRef.current?.focus()
    uploadFiles(files)
  }

  return (
    <div
      ref={wrapperRef}
      className={`kc-markdown-editor${dragging ? ' kc-markdown-editor--dragging' : ''}`}
      onBlur={(event) => {
        if (picking.current || wrapperRef.current?.contains(event.relatedTarget as Node | null)) return
        onBlur?.()
      }}
      onDragOver={(event) => {
        if (!upload || !event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <textarea
        ref={textareaRef}
        className="kc-textarea"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(event) => change(event.target.value)}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
      />
      {upload && (
        <div className="kc-markdown-editor-bar">
          <button
            type="button"
            className="kc-btn kc-btn-ghost kc-markdown-editor-add"
            onClick={() => {
              picking.current = true
              fileRef.current?.click()
            }}
          >
            <FiImage aria-hidden="true" /> Add image or video
          </button>
          <span className="kc-muted kc-markdown-editor-hint">
            {pending > 0 ? `Uploading ${pending} file${pending === 1 ? '' : 's'}…` : 'or paste or drop one here'}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept={MEDIA_ACCEPT}
            multiple
            hidden
            onChange={(event) => {
              picking.current = false
              uploadFiles(Array.from(event.target.files ?? []))
              event.target.value = ''
              textareaRef.current?.focus()
            }}
          />
        </div>
      )}
      {error && (
        <p className="kc-markdown-editor-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
