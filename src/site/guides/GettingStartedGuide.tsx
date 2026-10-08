import { t } from '../../i18n'
import { GuideImage } from './GuideImage'
import { GuideLayout } from './GuideLayout'
import { GuideText } from './GuideText'

export function GettingStartedGuide() {
  return (
    <GuideLayout slug="getting-started">
      <p>{t('guides.gettingStarted.intro')}</p>

      <h2>{t('guides.gettingStarted.addTitle')}</h2>
      <p>
        <GuideText k="guides.gettingStarted.add" />
      </p>

      <h2>{t('guides.gettingStarted.boardTitle')}</h2>
      <p>{t('guides.gettingStarted.run')}</p>
      <pre>
        <code>{t('guides.gettingStarted.boardCommand')}</code>
      </pre>
      <p>
        <GuideText k="guides.gettingStarted.boardPermission" />
      </p>
      <p>
        <GuideText k="guides.gettingStarted.columns" />
      </p>

      <GuideImage
        src="/images/guides/board.webp"
        width={3440}
        height={1520}
        alt={t('guides.gettingStarted.boardAlt')}
        caption={t('guides.gettingStarted.boardCaption')}
      />
      <h2>{t('guides.gettingStarted.tasksTitle')}</h2>
      <p>
        <GuideText k="guides.gettingStarted.tasks" />
      </p>
      <p>
        <GuideText k="guides.gettingStarted.fromMessage" />
      </p>

      <h2>{t('guides.gettingStarted.moveTitle')}</h2>
      <p>
        <GuideText k="guides.gettingStarted.move" />
      </p>
      <p>
        <GuideText k="guides.gettingStarted.view" />
      </p>

      <h2>{t('guides.gettingStarted.featuresTitle')}</h2>
      <p>
        <GuideText k="guides.gettingStarted.features" />
      </p>

      <h2>{t('guides.gettingStarted.postTitle')}</h2>
      <p>
        <GuideText k="guides.gettingStarted.post" />
      </p>

      <h2>{t('guides.gettingStarted.nextTitle')}</h2>
      <p>
        <GuideText k="guides.gettingStarted.next" />
      </p>
    </GuideLayout>
  )
}
