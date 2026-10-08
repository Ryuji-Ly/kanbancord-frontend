import { t } from '../../i18n'
import { GuideImage } from './GuideImage'
import { GuideLayout } from './GuideLayout'
import { GuideItems } from './GuideText'

export function WebsiteGuide() {
  return (
    <GuideLayout slug="website-board">
      <p>{t('guides.website.intro')}</p>

      <GuideImage
        src="/images/guides/dashboard.webp"
        width={2880}
        height={1160}
        alt={t('guides.website.dashboardAlt')}
        caption={t('guides.website.dashboardCaption')}
      />
      <h2>{t('guides.website.boardTitle')}</h2>
      <ul>
        <GuideItems k="guides.website.board" />
      </ul>

      <GuideImage
        src="/images/guides/filters.webp"
        width={3440}
        height={1000}
        alt={t('guides.website.filtersAlt')}
        caption={t('guides.website.filtersCaption')}
      />
      <h2>{t('guides.website.tasksTitle')}</h2>
      <p>{t('guides.website.tasks')}</p>
      <ul>
        <GuideItems k="guides.website.taskPoints" />
      </ul>

      <GuideImage
        src="/images/guides/task.webp"
        width={2880}
        height={1800}
        alt={t('guides.website.taskAlt')}
        caption={t('guides.website.taskCaption')}
      />
      <h2>{t('guides.website.settingsTitle')}</h2>
      <ul>
        <GuideItems k="guides.website.settings" />
      </ul>

      <h2>{t('guides.website.auditTitle')}</h2>
      <p>{t('guides.website.audit')}</p>
    </GuideLayout>
  )
}
