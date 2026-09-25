import { useMemo, useState } from 'react'
import type { LabelEntry } from '../../../services/boardsService'
import { readableTextColor } from '../boardModel'

/** How many label patterns there are; a label's pattern follows from its id, the same everywhere. */
export const LABEL_PATTERNS = 6

/** A label in its own colour, with its pattern when patterns are switched on. */
export function LabelChip({
  label,
  onRemove,
}: {
  label: Pick<LabelEntry, 'name' | 'color'> & { labelId?: number }
  onRemove?: () => void
}) {
  return (
    <span
      className="kc-label-chip"
      data-pattern={label.labelId === undefined ? undefined : label.labelId % LABEL_PATTERNS}
      style={{ backgroundColor: label.color, color: readableTextColor(label.color) }}
    >
      <span className="kc-label-chip-name">{label.name}</span>
      {onRemove && (
        <button type="button" className="kc-label-chip-remove" aria-label={`Remove label ${label.name}`} onClick={onRemove}>
          ×
        </button>
      )}
    </span>
  )
}

type LabelPickerProps = {
  /** Every label of the board. */
  labels: LabelEntry[]
  selectedIds: number[]
  canApply: boolean
  canRemove: boolean
  /** Offers to create a label that does not exist yet, named as typed. */
  canCreate: boolean
  onAdd: (labelId: number) => void
  onRemove: (labelId: number) => void
  onCreate: (name: string) => Promise<LabelEntry>
}

/** The labels on a task, and a search that adds one of the board's labels or creates a new one. */
export function LabelPicker({ labels, selectedIds, canApply, canRemove, canCreate, onAdd, onRemove, onCreate }: LabelPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const byId = useMemo(() => new Map(labels.map((label) => [label.labelId, label])), [labels])
  const selected = selectedIds.map((id) => byId.get(id)).filter((label): label is LabelEntry => Boolean(label))
  const needle = query.trim().toLowerCase()
  const options = labels.filter((label) => !selectedIds.includes(label.labelId) && label.name.toLowerCase().includes(needle))
  const exists = labels.some((label) => label.name.toLowerCase() === needle)
  const offerCreate = canCreate && needle.length > 0 && !exists

  function pick(labelId: number) {
    onAdd(labelId)
    setQuery('')
  }

  async function create() {
    const name = query.trim()
    if (!name || creating) return
    setCreating(true)
    setError('')
    try {
      const created = await onCreate(name)
      onAdd(created.labelId)
      setQuery('')
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="kc-picker">
      <div className="kc-task-assignee-chip-list">
        {selected.map((label) => (
          <LabelChip key={label.labelId} label={label} onRemove={canRemove ? () => onRemove(label.labelId) : undefined} />
        ))}
        {canApply && (
          <input
            className="kc-task-assignee-input"
            value={query}
            placeholder={canCreate ? 'Add or create a label' : 'Add a label'}
            aria-label="Search labels"
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              event.stopPropagation()
              const exact = options.find((label) => label.name.toLowerCase() === needle)
              if (exact) pick(exact.labelId)
              else if (offerCreate) void create()
              else if (options.length === 1) pick(options[0].labelId)
            }}
          />
        )}
        {!canApply && selected.length === 0 && <span className="kc-muted">No labels.</span>}
      </div>

      {canApply && open && (options.length > 0 || offerCreate) && (
        <ul className="kc-task-assignee-results" role="listbox" aria-label="Labels">
          {options.map((label) => (
            <li key={label.labelId}>
              <button type="button" className="kc-task-assignee-result" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(label.labelId)}>
                <LabelChip label={label} />
              </button>
            </li>
          ))}
          {offerCreate && (
            <li>
              <button type="button" className="kc-task-assignee-result" disabled={creating} onMouseDown={(e) => e.preventDefault()} onClick={() => void create()}>
                {creating ? 'Creating…' : `Create label "${query.trim()}"`}
              </button>
            </li>
          )}
        </ul>
      )}
      {error && <p className="kc-field-error">{error}</p>}
    </div>
  )
}
