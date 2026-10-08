import type { ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { t } from '../../../i18n'
import { isUploadMarker, mediaKindOf } from '../../../services/mediaService'

type MarkdownProps = {
  children: string
  /** Whether checklist boxes can be ticked. */
  editable?: boolean
  /** Called with the index of the ticked checklist item among all checklist items. */
  onToggle?: (itemIndex: number, checked: boolean) => void
}

/**
 * GitHub-flavoured markdown without raw HTML, with optionally clickable checklists. Images and videos
 * are shown only from Imgur, where uploads go; an image from anywhere else stays a link, so opening a
 * task never loads files from servers someone else chose.
 */
export function Markdown({ children, editable = false, onToggle }: MarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        img: ({ src, alt }: ComponentPropsWithoutRef<'img'>) => {
          const source = typeof src === 'string' ? src : undefined
          if (isUploadMarker(source)) return <span className="kc-markdown-uploading">{alt}</span>
          const kind = mediaKindOf(source)
          if (kind === 'video') {
            return (
              <video
                className="kc-markdown-media"
                src={source}
                controls
                playsInline
                preload="metadata"
                aria-label={alt || t('board.media.video')}
                onClick={(event) => event.stopPropagation()}
              />
            )
          }
          if (kind === 'image') {
            return (
              <a href={source} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
                <img className="kc-markdown-media" src={source} alt={alt ?? ''} loading="lazy" referrerPolicy="no-referrer" />
              </a>
            )
          }
          return source ? (
            <a href={source} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
              {alt || source}
            </a>
          ) : (
            <span>{alt}</span>
          )
        },
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
