import { t } from '../../i18n'
import { GuideImage } from './GuideImage'
import { GuideLayout } from './GuideLayout'
import { GuideItems } from './GuideText'

export function ActivityGuide() {
  return (
    <GuideLayout slug="discord-activity">
      <p>{t('guides.activity.intro')}</p>

      <h2>{t('guides.activity.startTitle')}</h2>
      <ul>
        <GuideItems k="guides.activity.start" />
      </ul>

      <GuideImage
        src="/images/activity.webp"
        width={1621}
        height={963}
        alt={t('guides.activity.screenAlt')}
        caption={t('guides.activity.screenCaption')}
      />
      <h2>{t('guides.activity.whatTitle')}</h2>
      <ul>
        <GuideItems k="guides.activity.what" />
      </ul>

      <h2>{t('guides.activity.goodTitle')}</h2>
      <ul>
        <GuideItems k="guides.activity.good" />
      </ul>
    </GuideLayout>
  )
}
