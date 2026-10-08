import { t } from '../../i18n'
import { GuideImage } from './GuideImage'
import { GuideLayout } from './GuideLayout'
import { GuideItems, GuideText } from './GuideText'

export function LabelsPrioritiesGuide() {
  return (
    <GuideLayout slug="labels-and-priorities">
      <p>{t('guides.labelsPriorities.intro')}</p>

      <h2>{t('guides.labelsPriorities.switchTitle')}</h2>
      <p>
        <GuideText k="guides.labelsPriorities.switch" />
      </p>

      <h2>{t('guides.labelsPriorities.prioritiesTitle')}</h2>
      <p>
        <GuideText k="guides.labelsPriorities.priorities" />
      </p>
      <ul>
        <GuideItems k="guides.labelsPriorities.priorityCommands" />
      </ul>

      <h2>{t('guides.labelsPriorities.labelsTitle')}</h2>
      <p>
        <GuideText k="guides.labelsPriorities.labels" />
      </p>
      <ul>
        <GuideItems k="guides.labelsPriorities.labelCommands" />
      </ul>

      <h2>{t('guides.labelsPriorities.filterTitle')}</h2>
      <p>
        <GuideText k="guides.labelsPriorities.filter" />
      </p>

      <GuideImage
        src="/images/guides/filters.webp"
        width={3440}
        height={1000}
        alt={t('guides.labelsPriorities.filterAlt')}
        caption={t('guides.labelsPriorities.filterCaption')}
      />
    </GuideLayout>
  )
}
