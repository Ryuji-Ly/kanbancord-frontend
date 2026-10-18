import { t } from '../../i18n'
import type { BoardPart } from '../../services/boardTransferService'

type PartsChecklistProps = {
  /** The parts to offer, in order. */
  parts: BoardPart[]
  chosen: Set<BoardPart>
  disabled?: boolean
  onChange: (chosen: Set<BoardPart>) => void
}

/** A tick box per optional part of a board file: labels, priorities, assignees, comments, rules. */
export function PartsChecklist({ parts, chosen, disabled, onChange }: PartsChecklistProps) {
  return (
    <div className="kc-transfer-parts">
      {parts.map((part) => (
        <label key={part} className="kc-transfer-part">
          <input
            type="checkbox"
            className="kc-check"
            checked={chosen.has(part)}
            disabled={disabled}
            onChange={(event) => {
              const next = new Set(chosen)
              if (event.target.checked) next.add(part)
              else next.delete(part)
              onChange(next)
            }}
          />
          {t(`settings.transfer.parts.${part}`)}
        </label>
      ))}
    </div>
  )
}
