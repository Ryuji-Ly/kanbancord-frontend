import { Link } from 'react-router-dom'
import type { ListKey, MessageKey } from '../../i18n'
import { Trans, TransList, type Tags } from '../../i18n/Trans'
import { GUIDE_META } from './guideMeta'

/** A link to another guide, tagged with its key: `see <permissions>roles and permissions</permissions>`. */
const GUIDE_LINKS: Tags = Object.fromEntries(
  GUIDE_META.map((guide) => [guide.key, <Link to={`/guides/${guide.slug}`} />]),
)

/** A guide's text, which may link to other guides. */
export function GuideText({ k }: { k: MessageKey }) {
  return <Trans k={k} tags={GUIDE_LINKS} />
}

/** A guide's list, as list items. */
export function GuideItems({ k }: { k: ListKey }) {
  return <TransList k={k} tags={GUIDE_LINKS} />
}
