import type { ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type MarkdownProps = {
  children: string
  /** Whether checklist boxes can be ticked. */
  editable?: boolean
  /** Called with the index of the ticked checklist item among all checklist items. */
  onToggle?: (itemIndex: number, checked: boolean) => void
}

/** GitHub-flavoured markdown without raw HTML, with optionally clickable checklists. */
export function Markdown({ children, editable = false, onToggle }: MarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        input: (props: ComponentPropsWithoutRef<'input'>) => {
          if (props.type !== 'checkbox') {
            return <input {...props} />
          }

          return (
            <input
              {...props}
              type="checkbox"
              disabled={!editable}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => {
                event.stopPropagation()
                const target = event.currentTarget
                const markdownRoot = target.closest('.kc-markdown')
                const checkboxes = markdownRoot
                  ? Array.from(markdownRoot.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
                  : []
                const itemIndex = checkboxes.indexOf(target)
                if (itemIndex >= 0) onToggle?.(itemIndex, target.checked)
              }}
            />
          )
        },
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
