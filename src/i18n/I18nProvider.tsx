import { Fragment, useSyncExternalStore, type ReactNode } from 'react'
import { language, subscribeLanguage } from '.'

/** Renders the app afresh in the new language whenever the language changes. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const shown = useSyncExternalStore(subscribeLanguage, language, language)
  return <Fragment key={shown}>{children}</Fragment>
}
