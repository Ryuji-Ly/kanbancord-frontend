import { t } from '../../i18n'
import { GuideLayout } from './GuideLayout'
import { GuideItems, GuideText } from './GuideText'

export function FeaturesGuide() {
  return (
    <GuideLayout slug="features-and-simple-mode">
      <p>{t('guides.features.intro')}</p>

      <h2>{t('guides.features.whatTitle')}</h2>
      <ul>
        <GuideItems k="guides.features.what" />
      </ul>

      <h2>{t('guides.features.discordTitle')}</h2>
      <p>
        <GuideText k="guides.features.discord" />
      </p>

      <h2>{t('guides.features.websiteTitle')}</h2>
      <p>
        <GuideText k="guides.features.website" />
      </p>

      <h2>{t('guides.features.whoTitle')}</h2>
      <p>
        <GuideText k="guides.features.who" />
      </p>

      <h2>{t('guides.features.boardTitle')}</h2>
      <p>
        <GuideText k="guides.features.board" />
      </p>

      <h2>{t('guides.features.suggestionsTitle')}</h2>
      <p>
        <GuideText k="guides.features.suggestions" />
      </p>
    </GuideLayout>
  )
}
