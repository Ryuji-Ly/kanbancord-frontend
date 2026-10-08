import { t } from '../../i18n'
import { GuideImage } from './GuideImage'
import { GuideLayout } from './GuideLayout'
import { GuideItems, GuideText } from './GuideText'

export function AssignTasksGuide() {
  return (
    <GuideLayout slug="assign-tasks">
      <p>{t('guides.assignTasks.intro')}</p>

      <h2>{t('guides.assignTasks.switchTitle')}</h2>
      <p>
        <GuideText k="guides.assignTasks.switch" />
      </p>

      <h2>{t('guides.assignTasks.assignTitle')}</h2>
      <ul>
        <GuideItems k="guides.assignTasks.assign" />
      </ul>
      <p>
        <GuideText k="guides.assignTasks.elsewhere" />
      </p>

      <GuideImage
        src="/images/guides/task-panel.webp"
        width={1040}
        height={1800}
        alt={t('guides.assignTasks.panelAlt')}
        caption={t('guides.assignTasks.panelCaption')}
        narrow
      />
      <h2>{t('guides.assignTasks.loopTitle')}</h2>
      <p>
        <GuideText k="guides.assignTasks.loop" />
      </p>
      <p>
        <GuideText k="guides.assignTasks.follow" />
      </p>

      <h2>{t('guides.assignTasks.whoTitle')}</h2>
      <p>
        <GuideText k="guides.assignTasks.who" />
      </p>
    </GuideLayout>
  )
}
