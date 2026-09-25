import { useId } from 'react'

type SwitchRowProps = {
  label: string
  description?: string
  on: boolean
  disabled?: boolean
  onToggle: (on: boolean) => void
}

/** A setting with an on/off switch, in a `.kc-features-list`. */
export function SwitchRow({ label, description, on, disabled, onToggle }: SwitchRowProps) {
  const id = useId()
  return (
    <li className="kc-feature-row">
      <div className="kc-feature-text">
        <label htmlFor={id} className="kc-feature-label">
          {label}
        </label>
        {description && <p className="kc-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        className={`kc-switch${on ? ' kc-switch--on' : ''}`}
        onClick={() => onToggle(!on)}
      >
        <span className="kc-switch-knob" aria-hidden="true" />
      </button>
    </li>
  )
}
