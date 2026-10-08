import { t } from '../../i18n'
import { GuideImage } from './GuideImage'
import { GuideLayout } from './GuideLayout'
import { GuideText } from './GuideText'

export function DueDatesGuide() {
  return (
    <GuideLayout slug="due-dates-and-reminders">
      <p>{t('guides.dueDates.intro')}</p>

      <h2>{t('guides.dueDates.switchTitle')}</h2>
      <p>
        <GuideText k="guides.dueDates.switch" />
      </p>

      <h2>{t('guides.dueDates.setTitle')}</h2>
      <p>{t('guides.dueDates.set')}</p>
      <pre>
        <code>{t('guides.dueDates.setCommand')}</code>
      </pre>
      <p>
        <GuideText k="guides.dueDates.when" />
      </p>

      <h2>{t('guides.dueDates.remindersTitle')}</h2>
      <p>{t('guides.dueDates.reminders')}</p>
      <p>
        <GuideText k="guides.dueDates.who" />
      </p>
      <p>
        <GuideText k="guides.dueDates.feed" />
      </p>

      <h2>{t('guides.dueDates.seeingTitle')}</h2>
      <p>
        <GuideText k="guides.dueDates.seeing" />
      </p>

      <GuideImage
        src="/images/guides/due-filter.webp"
        width={3440}
        height={1000}
        alt={t('guides.dueDates.filterAlt')}
        caption={t('guides.dueDates.filterCaption')}
      />
    </GuideLayout>
  )
}
