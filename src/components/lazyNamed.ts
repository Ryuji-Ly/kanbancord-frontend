import { lazy, type ComponentType } from 'react'

/**
 * A component loaded only when it is first shown, for parts of the page that open on a click, such
 * as dialogs and settings. Takes a module's named export, since the app does not use default
 * exports. Render it inside a <Suspense>.
 */
export function lazyNamed<M, K extends keyof M>(load: () => Promise<M>, name: K): M[K] {
  // Typed as the export itself, so its props are checked where it is used.
  return lazy(() => load().then((module) => ({ default: module[name] as unknown as ComponentType }))) as unknown as M[K]
}
