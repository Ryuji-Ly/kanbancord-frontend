import { Link } from 'react-router-dom'
import { PublicLayout } from '../PublicLayout'
import { SITE } from '../siteInfo'

/** The rules for using KanbanCord: the website and the Discord bot alike. */
export function TermsPage() {
  const mail = <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
  return (
    <PublicLayout
      title="Terms of Service"
      description="The terms for using KanbanCord, the website and its Discord bot: who can use it, what is allowed, and what we promise."
      path="/terms"
    >
      <h1>Terms of Service</h1>
      <p className="kc-muted">Last updated {SITE.legalUpdated}</p>

      <p>
        These terms apply to {SITE.name}: the website at {SITE.url} and the {SITE.name} Discord bot (together, "the
        service"), run by {SITE.operator} ("we"). By using the service, or adding the bot to a server, you agree to them.
        How we handle personal data is described in the <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Who can use it</h2>
      <p>
        You sign in with your Discord account, so you must be allowed to use Discord where you live, and be at least 13.
        Discord's own{' '}
        <a href="https://discord.com/terms" target="_blank" rel="noopener noreferrer">
          Terms of Service
        </a>{' '}
        also apply whenever you use the service through Discord.
      </p>

      <h2>The service</h2>
      <p>
        {SITE.name} is free. It gives Discord servers kanban boards, managed on the website and with the bot. We may
        change, add or remove features, and may stop the service; if we stop it, we will say so in advance where we
        reasonably can, so you can take your data.
      </p>

      <h2>Servers and their administrators</h2>
      <p>
        Whoever adds the bot to a server, and that server's administrators, decide how {SITE.name} is used there: who may
        see and change which boards, which features are on, and where the bot posts. By adding the bot, you confirm you may
        do so for that server, and that its members may be told the bot keeps their basic Discord profile and roles to make
        permissions work (see the Privacy Policy).
      </p>

      <h2>Acceptable use</h2>
      <p>Do not use the service to:</p>
      <ul>
        <li>break the law, or infringe other people's rights, including their privacy and intellectual property;</li>
        <li>post or upload content that is illegal, harassing, hateful, sexually exploitative, or harmful to minors;</li>
        <li>
          get around permissions, see or change what you are not allowed to, or access other people's accounts or
          sessions;
        </li>
        <li>
          overload, attack, probe or disrupt the service, or use it in automated ways beyond normal use of the website and
          bot;
        </li>
        <li>spam people, including through notifications.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        What you create (tasks, comments, uploads and the rest) stays yours, or your server's. You let us store, copy and
        show it only as needed to run the service for you and the people you share it with. You are responsible for what
        you post, and for having the right to post it. Uploaded images and videos are stored by Imgur, whose{' '}
        <a href="https://imgur.com/tos" target="_blank" rel="noopener noreferrer">
          terms
        </a>{' '}
        also apply to them.
      </p>

      <h2>Suspension</h2>
      <p>
        We may remove content, or suspend or stop someone's or a server's use of the service, if they break these terms or
        put the service or others at risk. Where it is reasonable, we will say why. You can stop using the service at any
        time: sign out, and remove the bot from your server.
      </p>

      <h2>No guarantees</h2>
      <p>
        The service is provided "as is", free of charge, without guarantees that it will always be available, error free,
        or suited to a particular purpose. Keep your own copies of anything you cannot afford to lose.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential loss, or for loss of data, profit or
        business, arising from the service. Nothing in these terms limits liability that cannot be limited by law, such as
        for intent or gross negligence, or your rights as a consumer under the law of the country where you live.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. The new version appears here with a new date; for significant changes we will also say
        so on the website. Using the service after a change means you accept it.
      </p>

      <h2>Law</h2>
      <p>
        These terms are governed by the law of {SITE.country}. If you are a consumer in the European Union, you keep the
        protection of the mandatory law of the country where you live, and may bring a claim there.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms: {mail}.</p>
    </PublicLayout>
  )
}
