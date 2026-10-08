import { Fragment, cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { t, tList, type ListKey, type MessageKey, type MessageValues } from '.'

/** Tags a message may use without being given them. */
const PLAIN_TAGS = new Set(['strong', 'em', 'code', 'kbd'])

/** The element for each `<tag>…</tag>` in a message; the tagged text becomes its children. */
export type Tags = Record<string, ReactElement | ((children: ReactNode) => ReactNode)>

/**
 * A message with markup: `Run <code>/help</code>, or <link>read the guide</link>` with
 * `tags={{ link: <Link to="/guides" /> }}`. Translators move the tags with the words. Tags do not
 * nest; `strong`, `em`, `code` and `kbd` need not be given.
 */
export function Trans({ k, values, tags = {} }: { k: MessageKey; values?: MessageValues; tags?: Tags }) {
  return <>{markup(t(k, values), tags)}</>
}

/** A list message as list items, each with markup as in Trans. */
export function TransList({ k, values, tags = {} }: { k: ListKey; values?: MessageValues; tags?: Tags }) {
  return (
    <>
      {tList(k, values).map((item, index) => (
        <li key={index}>{markup(item, tags)}</li>
      ))}
    </>
  )
}

function markup(message: string, tags: Tags): ReactNode[] {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of message.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) {
    const [whole, tag, inner] = match
    if (match.index > last) parts.push(message.slice(last, match.index))
    parts.push(element(tag, inner, tags[tag], parts.length))
    last = match.index + whole.length
  }
  if (last < message.length) parts.push(message.slice(last))
  return parts
}

function element(tag: string, inner: string, given: Tags[string] | undefined, key: number): ReactNode {
  if (typeof given === 'function') return <Fragment key={key}>{given(inner)}</Fragment>
  if (isValidElement(given)) return cloneElement(given, { key }, inner)
  if (PLAIN_TAGS.has(tag)) return createElement(tag, { key }, inner)
  return inner
}
