import { Fragment } from 'react'
import { t, type MessageKey } from '../../i18n'
import { GuideImage } from './GuideImage'
import { GuideLayout } from './GuideLayout'
import { GuideItems, GuideText } from './GuideText'

/** The worked examples, in order: each a heading and a paragraph. */
const EXAMPLES = [
  'defaultsOnly',
  'twoRoles',
  'roleVsPermission',
  'denyPermission',
  'person',
  'private',
  'oneBoard',
  'admins',
  'open',
  'customOff',
  'left',
] as const

export function PermissionsGuide() {
  return (
    <GuideLayout slug="roles-and-permissions">
      <p>{t('guides.permissions.intro')}</p>

      <h2>{t('guides.permissions.defaultsTitle')}</h2>
      <p>{t('guides.permissions.defaults')}</p>
      <ul>
        <GuideItems k="guides.permissions.defaultPoints" />
      </ul>
      <p>{t('guides.permissions.followsRoles')}</p>

      <h2>{t('guides.permissions.fineTuneTitle')}</h2>
      <p>
        <GuideText k="guides.permissions.fineTune" />
      </p>
      <ul>
        <GuideItems k="guides.permissions.fineTunePoints" />
      </ul>
      <GuideImage
        src="/images/guides/permissions.webp"
        width={2880}
        height={1800}
        alt={t('guides.permissions.rulesAlt')}
        caption={t('guides.permissions.rulesCaption')}
      />
      <p>{t('guides.permissions.allowDeny')}</p>
      <p>{t('guides.permissions.switchOff')}</p>

      <h2>{t('guides.permissions.decideTitle')}</h2>
      <p>{t('guides.permissions.decide')}</p>
      <ol>
        <li>
          <GuideText k="guides.permissions.decideAdmins" />
        </li>
        <li>
          <GuideText k="guides.permissions.decideOpen" />
        </li>
        <li>
          <GuideText k="guides.permissions.decideSteps" />
          <ol>
            <GuideItems k="guides.permissions.steps" />
          </ol>
        </li>
        <li>
          <GuideText k="guides.permissions.decideDeny" />
        </li>
        <li>
          <GuideText k="guides.permissions.decideNone" />
        </li>
      </ol>
      <p>
        <GuideText k="guides.permissions.order" />
      </p>

      <h2>{t('guides.permissions.examplesTitle')}</h2>
      <p>
        <GuideText k="guides.permissions.examples" />
      </p>
      {EXAMPLES.map((example) => (
        <Fragment key={example}>
          <h3>{t(`guides.permissions.${example}Title` as MessageKey)}</h3>
          <p>
            <GuideText k={`guides.permissions.${example}`} />
          </p>
        </Fragment>
      ))}

      <h2>{t('guides.permissions.checkTitle')}</h2>
      <p>
        <GuideText k="guides.permissions.check" />
      </p>

      <h2>{t('guides.permissions.discordTitle')}</h2>
      <p>{t('guides.permissions.discord')}</p>
      <p>
        <GuideText k="guides.permissions.boardPost" />
      </p>

      <h2>{t('guides.permissions.trackTitle')}</h2>
      <p>{t('guides.permissions.track')}</p>
    </GuideLayout>
  )
}
