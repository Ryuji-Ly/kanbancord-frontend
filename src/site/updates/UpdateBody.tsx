import type { ReactNode } from 'react'

/**
 * An update's text, from the little Markdown updates use: paragraphs, lists of `- ` items, **bold**,
 * *italic*, `code` and [links](https://…). A full Markdown library is far bigger than updates need,
 * and the page is part of the public site everyone loads. Anything else stays plain text.
 */
export function UpdateBody({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean)
  return (
    <>
      {blocks.map((block, index) => {
        const lines = block.split('\n')
        if (lines.every((line) => line.startsWith('- '))) {
          return (
            <ul key={index}>
              {lines.map((line, item) => (
                <li key={item}>{inline(line.slice(2))}</li>
              ))}
            </ul>
          )
        }
        return <p key={index}>{inline(lines.join(' '))}</p>
      })}
    </>
  )
}

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\))/

function inline(text: string): ReactNode[] {
  return text.split(TOKEN).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{inline(part.slice(2, -2))}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      const external = /^https?:\/\//.test(link[2])
      return (
        <a key={index} href={link[2]} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {link[1]}
        </a>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={index}>{inline(part.slice(1, -1))}</em>
    return part
  })
}
