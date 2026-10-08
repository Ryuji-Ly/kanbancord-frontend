import { t } from '../../i18n'
import { GuideLayout } from './GuideLayout'
import { GuideItems, GuideText } from './GuideText'

export function PostsFeedsGuide() {
  return (
    <GuideLayout slug="board-posts-and-feeds">
      <p>{t('guides.postsFeeds.intro')}</p>

      <h2>{t('guides.postsFeeds.postsTitle')}</h2>
      <p>
        <GuideText k="guides.postsFeeds.posts" />
      </p>
      <ul>
        <GuideItems k="guides.postsFeeds.postPoints" />
      </ul>

      <h2>{t('guides.postsFeeds.feedsTitle')}</h2>
      <p>
        <GuideText k="guides.postsFeeds.feeds" />
      </p>
      <p>
        <GuideText k="guides.postsFeeds.feedsMore" />
      </p>

      <h2>{t('guides.postsFeeds.whichTitle')}</h2>
      <p>
        <GuideText k="guides.postsFeeds.which" />
      </p>

      <h2>{t('guides.postsFeeds.auditTitle')}</h2>
      <p>
        <GuideText k="guides.postsFeeds.audit" />
      </p>

      <h2>{t('guides.postsFeeds.dmTitle')}</h2>
      <p>
        <GuideText k="guides.postsFeeds.dm" />
      </p>
    </GuideLayout>
  )
}
