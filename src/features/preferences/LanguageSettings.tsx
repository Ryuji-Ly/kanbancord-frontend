import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { readableError } from '../../api/http'
import { chooseLanguage, chosenLanguage, language, LANGUAGES, languageName, t } from '../../i18n'
import { requestLanguage } from '../../services/meService'
import { clearPendingAccountDialog, reopenAccountDialog } from '../account/accountDialog'

/** The value of the "Request a language…" entry in the list. */
const REQUEST = '__request'
const NOTE_MAX = 300

/** Languages people can ask for: widely spoken ones, named in the language the website is shown in. */
const REQUESTABLE = [
  'ar', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'es', 'es-419', 'et', 'fa', 'fi', 'fil', 'fr', 'he', 'hi', 'hr',
  'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv', 'ms', 'nb', 'nl', 'pl', 'pt', 'pt-BR', 'ro', 'ru', 'sk', 'sl', 'sr',
  'sv', 'sw', 'ta', 'th', 'tr', 'uk', 'ur', 'vi', 'zh-Hans', 'zh-Hant',
]

/**
 * The website's language: the browser's, or one picked here (remembered on this browser). Someone
 * missing theirs can ask for it; the request goes to the developer.
 */
export function LanguageSettings() {
  const [chosen, setChosen] = useState(chosenLanguage)
  const [requesting, setRequesting] = useState(false)

  return (
    <section className="kc-appearance-section">
      <h4>{t('account.appearance.language')}</h4>
      <select
        className="kc-input"
        aria-label={t('account.appearance.language')}
        value={requesting ? REQUEST : (chosen ?? '')}
        onChange={(event) => {
          if (event.target.value === REQUEST) {
            setRequesting(true)
            return
          }
          setRequesting(false)
          const code = event.target.value || null
          setChosen(code)
          // The app is drawn afresh in the new language; this dialog opens again where it was.
          const before = language()
          reopenAccountDialog('appearance')
          void chooseLanguage(code).then(() => {
            if (language() === before) clearPendingAccountDialog()
          })
        }}
      >
        <option value="">{t('account.appearance.browserLanguage')}</option>
        {LANGUAGES.map((code) => (
          <option key={code} value={code} lang={code}>
            {languageName(code)}
          </option>
        ))}
        <option value={REQUEST}>{t('account.language.request')}</option>
      </select>
      {requesting && <LanguageRequestForm onDone={() => setRequesting(false)} />}
    </section>
  )
}

function LanguageRequestForm({ onDone }: { onDone: () => void }) {
  const options = useMemo(() => {
    const names = new Intl.DisplayNames([language()], { type: 'language' })
    return REQUESTABLE.filter((code) => !LANGUAGES.includes(code))
      .map((code) => ({ code, name: names.of(code) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name, language()))
  }, [])
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const send = useMutation({ mutationFn: () => requestLanguage(code, note.trim() || null) })

  if (send.isSuccess) {
    return (
      <div className="kc-language-request">
        <p className="kc-banner kc-banner--success" role="status">
          {t('account.language.sent')}
        </p>
        <button type="button" className="kc-btn kc-btn-ghost kc-btn-small" onClick={onDone}>
          {t('common.close')}
        </button>
      </div>
    )
  }

  return (
    <form
      className="kc-language-request"
      onSubmit={(event) => {
        event.preventDefault()
        if (code) send.mutate()
      }}
    >
      <p className="kc-muted">{t('account.language.intro')}</p>
      {send.isError && <p className="kc-banner">{readableError(send.error, t('account.language.failed'))}</p>}
      <label className="kc-field">
        <span className="kc-field-label">{t('account.language.which')}</span>
        <select className="kc-input" value={code} required onChange={(event) => setCode(event.target.value)}>
          <option value="" disabled>
            {t('account.language.pick')}
          </option>
          {options.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <label className="kc-field">
        <span className="kc-field-label">{t('account.language.note')}</span>
        <textarea
          className="kc-textarea"
          rows={3}
          maxLength={NOTE_MAX}
          value={note}
          placeholder={t('account.language.notePlaceholder')}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <div className="kc-language-request-actions">
        <button type="button" className="kc-btn kc-btn-ghost" onClick={onDone} disabled={send.isPending}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="kc-btn kc-btn-primary" disabled={!code || send.isPending}>
          {send.isPending ? t('account.language.sending') : t('account.language.send')}
        </button>
      </div>
    </form>
  )
}
