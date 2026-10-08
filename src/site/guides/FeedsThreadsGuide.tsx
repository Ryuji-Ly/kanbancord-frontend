import { t } from '../../i18n'
import { GuideImage } from './GuideImage'
import { GuideLayout } from './GuideLayout'
import { GuideItems, GuideText } from './GuideText'

export function FeedsThreadsGuide() {
  return (
    <GuideLayout slug="feeds-and-threads">
      <p>{t('guides.feedsThreads.intro')}</p>

      <h2>{t('guides.feedsThreads.addTitle')}</h2>
      <p>
        <GuideText k="guides.feedsThreads.add" />
      </p>
      <ul>
        <GuideItems k="guides.feedsThreads.addPoints" />
      </ul>

      <h2>{t('guides.feedsThreads.chooseTitle')}</h2>
      <p>
        <GuideText k="guides.feedsThreads.choose" />
      </p>
      <ul>
        <GuideItems k="guides.feedsThreads.choosePoints" />
      </ul>
      <p>{t('guides.feedsThreads.grouped')}</p>
      <GuideImage
        src="/images/guides/feeds.webp"
        width={2880}
        height={1800}
        alt={t('guides.feedsThreads.feedsAlt')}
        caption={t('guides.feedsThreads.feedsCaption')}
      />

      <h2>{t('guides.feedsThreads.severalTitle')}</h2>
      <ul>
        <GuideItems k="guides.feedsThreads.several" />
      </ul>

      <h2>{t('guides.feedsThreads.boardTitle')}</h2>
      <p>
        <GuideText k="guides.feedsThreads.board" />
      </p>
      <ul>
        <GuideItems k="guides.feedsThreads.boardPoints" />
      </ul>

      <h2>{t('guides.feedsThreads.threadsTitle')}</h2>
      <p>{t('guides.feedsThreads.threads')}</p>
      <pre>
        <code>{t('guides.feedsThreads.threadsCommand')}</code>
      </pre>
      <ul>
        <GuideItems k="guides.feedsThreads.threadPoints" />
      </ul>
      <p>{t('guides.feedsThreads.behaveTitle')}</p>
      <ul>
        <GuideItems k="guides.feedsThreads.behave" />
      </ul>
      <p>
        <GuideText k="guides.feedsThreads.showSetting" />
      </p>

      <h2>{t('guides.feedsThreads.whereTitle')}</h2>
      <ul>
        <GuideItems k="guides.feedsThreads.where" />
      </ul>
      <p>{t('guides.feedsThreads.whoChanges')}</p>

      <h2>{t('guides.feedsThreads.setupsTitle')}</h2>
      <ul>
        <GuideItems k="guides.feedsThreads.setups" />
      </ul>

      <h2>{t('guides.feedsThreads.fixTitle')}</h2>
      <h3>{t('guides.feedsThreads.nothingTitle')}</h3>
      <ul>
        <GuideItems k="guides.feedsThreads.nothing" />
      </ul>
      <h3>{t('guides.feedsThreads.mentionTitle')}</h3>
      <ul>
        <GuideItems k="guides.feedsThreads.mention" />
      </ul>
      <h3>{t('guides.feedsThreads.noThreadTitle')}</h3>
      <ul>
        <GuideItems k="guides.feedsThreads.noThread" />
      </ul>

      <h2>{t('guides.feedsThreads.dmTitle')}</h2>
      <p>
        <GuideText k="guides.feedsThreads.dm" />
      </p>
    </GuideLayout>
  )
}
