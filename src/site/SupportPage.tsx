import { PublicLayout } from './PublicLayout'
import { SITE } from './siteInfo'

/** Voluntary donations: what they are for, and that they unlock nothing. */
export function SupportPage() {
  return (
    <PublicLayout
      title="Support"
      description="KanbanCord is free for everyone. If you would like to help with its costs, you can leave a voluntary donation on Ko-fi."
      path="/support"
    >
      <h1>Support {SITE.name}</h1>
      <p>
        {SITE.name} is free, has no ads and no paid plans, and it will stay that way. It is a personal project, built and
        run by {SITE.operator}.
      </p>
      <p>
        If it is useful to your server and you would like to help with its costs, such as the domain, and the servers it
        will need if it grows, you can leave a donation on Ko-fi.
      </p>
      <p>
        <a className="kc-btn kc-btn-primary" href={SITE.donationUrl} target="_blank" rel="noopener noreferrer">
          Support on Ko-fi
        </a>
      </p>

      <h2>Good to know</h2>
      <ul>
        <li>Donations are entirely voluntary. Everyone gets the same {SITE.name}, whether they donate or not.</li>
        <li>A donation does not buy features, limits, roles, priority support or anything else.</li>
        <li>
          Payments are handled by Ko-fi and PayPal, never by {SITE.name}. We do not link donations to your Discord account.
        </li>
        <li>
          Donations are not refundable as a rule. If you donated by mistake, email{' '}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a> and we will do what we can.
        </li>
      </ul>
      <p>Not donating is completely fine. Telling others about {SITE.name}, or reporting a bug with <code>/report</code>, helps too.</p>
    </PublicLayout>
  )
}
