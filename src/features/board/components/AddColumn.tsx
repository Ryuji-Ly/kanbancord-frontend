import { useState } from 'react'

/** The "+ Add new column" button, which turns into a name field; Enter or leaving the field creates the column. */
export function AddColumn({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState<string | null>(null)

  function finish() {
    const trimmed = name?.trim() ?? ''
    setName(null)
    if (trimmed) onAdd(trimmed)
  }

  if (name === null) {
    return (
      <button className="kc-board-add-column-btn" data-no-column-drag="true" onClick={() => setName('')}>
        + Add new column
      </button>
    )
  }

  return (
    <div className="kc-panel kc-board-column-card kc-board-column-card--add-draft" data-no-column-drag="true">
      <div className="kc-column-header">
        <input
          className="kc-column-name-input"
          placeholder="Column name..."
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onBlur={finish}
          onKeyDown={(event) => {
            if (event.key === 'Enter') finish()
            if (event.key === 'Escape') setName(null)
          }}
        />
      </div>
    </div>
  )
}
