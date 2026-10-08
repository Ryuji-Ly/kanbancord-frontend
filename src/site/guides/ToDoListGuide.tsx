import { t } from '../../i18n'
import { GuideImage } from './GuideImage'
import { GuideLayout } from './GuideLayout'
import { GuideItems, GuideText } from './GuideText'

export function ToDoListGuide() {
  return (
    <GuideLayout slug="discord-to-do-list">
      <p>{t('guides.toDoList.intro')}</p>

      <h2>{t('guides.toDoList.stagesTitle')}</h2>
      <p>
        <GuideText k="guides.toDoList.stages" />
      </p>
      <p>
        <GuideText k="guides.toDoList.checklist" />
      </p>

      <GuideImage
        src="/images/guides/task.webp"
        width={2880}
        height={1800}
        alt={t('guides.toDoList.taskAlt')}
        caption={t('guides.toDoList.taskCaption')}
      />
      <h2>{t('guides.toDoList.setupTitle')}</h2>
      <ol>
        <GuideItems k="guides.toDoList.setup" />
      </ol>
      <p>{t('guides.toDoList.post')}</p>

      <h2>{t('guides.toDoList.tickTitle')}</h2>
      <p>
        <GuideText k="guides.toDoList.tick" />
      </p>

      <h2>{t('guides.toDoList.sharedTitle')}</h2>
      <p>{t('guides.toDoList.shared')}</p>

      <h2>{t('guides.toDoList.moreTitle')}</h2>
      <p>
        <GuideText k="guides.toDoList.more" />
      </p>
    </GuideLayout>
  )
}
