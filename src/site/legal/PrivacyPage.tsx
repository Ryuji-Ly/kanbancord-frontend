import { Link } from 'react-router-dom'
import { PublicLayout } from '../PublicLayout'
import { SITE } from '../siteInfo'

/** What KanbanCord collects, why, who else handles it, how long it is kept, and your rights. */
export function PrivacyPage() {
  const mail = <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
  return (
    <PublicLayout
      title="Privacy Policy"
      description="What personal data KanbanCord and its Discord bot collect, why, who else handles it, how long it is kept, and your rights."
      path="/privacy"
    >
      <h1>Privacy Policy</h1>
      <p className="kc-muted">Last updated {SITE.legalUpdated}</p>

      <p>
        This policy explains what personal data {SITE.name} (the website at {SITE.url} and the {SITE.name} Discord bot)
        collects, why, and what you can do about it. {SITE.name} is a personal, non-commercial project run by{' '}
        {SITE.operator}, based in {SITE.country}, who is responsible for your data (the "controller"). Questions or requests: {mail}.
      </p>

      <h2>What we collect</h2>
      <h3>When you sign in with Discord</h3>
      <ul>
        <li>
          Your Discord account's id, username, display name and avatar (Discord's <code>identify</code> permission).
        </li>
        <li>
          The list of Discord servers you are in, to show which of them you can manage (Discord's <code>guilds</code>
          permission). We keep the Discord access token needed for this, encrypted, and delete it and revoke it at
          Discord when you sign out of your last session.
        </li>
        <li>
          Your sign-in sessions: when they started and were last used, and a short description of the browser and device
          (for example "Chrome on Windows"), so you can see and end them under Settings.
        </li>
      </ul>

      <h3>When a server adds the bot</h3>
      <p>
        To know who may do what on a server's boards, the bot copies the server's name and icon, its roles and their
        Discord permissions, its text channels, and for every member: their Discord id, username, display name, avatar,
        server nickname, roles and when they joined. <strong>This includes members who never use {SITE.name}.</strong> It
        is kept up to date as the server changes, and a member's entry is removed when they leave the server.
      </p>

      <h3>What you create</h3>
      <ul>
        <li>Boards, columns, tasks, comments, labels, priorities, assignments, due dates and permission settings.</li>
        <li>
          An audit log of changes: who changed what and when, with the values before and after. Server administrators can
          read it, and can have the bot post it in a Discord channel.
        </li>
        <li>Your preferences (theme, accessibility, simple view) and notification settings.</li>
        <li>
          Images and videos you upload to a task. These are stored on Imgur, not by us, and are viewable by anyone who
          has the link. We keep a record of each upload so it can be removed.
        </li>
        <li>
          Reports and suggestions sent with <code>/report</code>: they reach the operator by Discord direct message, with
          your Discord username and id and the server you sent it from.
        </li>
      </ul>

      <h3>Technical data</h3>
      <p>
        Like any website, requests carry your IP address. We use it briefly, in memory, to limit how many requests one
        connection can make, and our network provider and web server may record it in short-lived logs to keep the
        service secure. We do not use analytics or advertising, and we do not track you across sites.
      </p>

      <h2>Why we use it</h2>
      <ul>
        <li>
          <strong>To provide {SITE.name}</strong> to you and your servers: showing boards, checking permissions, syncing
          members and roles, and sending the notifications you and your server chose. This is necessary to provide the
          service you asked for (GDPR Article 6(1)(b)).
        </li>
        <li>
          <strong>To keep it secure and working</strong>: sessions, rate limits, logs and the audit log. This is our
          legitimate interest in running a safe, reliable service (Article 6(1)(f)).
        </li>
        <li>
          <strong>Server member data</strong>, for members who have not used {SITE.name}: so a server's permissions and
          assignments work for everyone in it. This is the legitimate interest of the server that added the bot, and ours
          in providing it (Article 6(1)(f)). You can object: see "Your rights" below.
        </li>
      </ul>
      <p>We never sell your data, use it for advertising, or share it beyond what is described here.</p>

      <h2>Who else handles it</h2>
      <ul>
        <li>
          <strong>Discord</strong>, which you sign in with and where the bot runs. Their{' '}
          <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a> applies to
          your use of Discord.
        </li>
        <li>
          <strong>Imgur</strong>, which stores uploaded images and videos (
          <a href="https://imgur.com/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a>).
        </li>
        <li>
          <strong>Cloudflare</strong>, which carries traffic to the website and forwards email to us (
          <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">privacy policy</a>
          ).
        </li>
        <li>
          <strong>Ko-fi and PayPal</strong>, only if you choose to donate. They handle the payment and share your name,
          any message you leave, and the amount with us; we never see your payment details, and we do not link donations
          to your Discord account (
          <a href="https://more.ko-fi.com/privacy" target="_blank" rel="noopener noreferrer">Ko-fi</a>,{' '}
          <a href="https://www.paypal.com/myaccount/privacy/privacyhub" target="_blank" rel="noopener noreferrer">
            PayPal
          </a>
          ). We keep donation records as long as tax rules require.
        </li>
        <li>
          <strong>Oracle Cloud</strong>, where {SITE.name}'s servers and database run (
          <a href="https://www.oracle.com/legal/privacy/" target="_blank" rel="noopener noreferrer">privacy policy</a>).
        </li>
      </ul>
      <p>
        Some of these companies are based in, or process data in, the United States. Where data leaves the European
        Economic Area, they rely on the EU–US Data Privacy Framework or the European Commission's standard contractual
        clauses.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Sessions end 30 days after they were last used, or when you sign out, and are deleted 30 days after that.</li>
        <li>Your stored Discord access token is deleted when your last session ends.</li>
        <li>A server member's entry is removed when they leave the server.</li>
        <li>
          Boards, tasks, comments and the audit log are kept while the server uses {SITE.name}, since they are the
          server's work. A server's administrators decide what is deleted.
        </li>
        <li>Notifications waiting to be sent are deleted within a week.</li>
        <li>Everything else is kept for as long as you use {SITE.name}, or until you ask us to delete it.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can ask for a copy of the personal data we hold about you, have it corrected or deleted, restrict or object to
        how we use it, and receive it in a portable format. Email {mail} from, or mentioning, your Discord account, and we
        will answer within a month. Deleting your data removes your account information and settings; content you created
        on a server's boards is part of that server's work, so we remove your name from it instead where deleting it would
        harm others.
      </p>
      <p>
        You can also complain to the data protection authority in the country where you live or work, or to the Belgian
        Data Protection Authority (
        <a href="https://www.dataprotectionauthority.be" target="_blank" rel="noopener noreferrer">
          dataprotectionauthority.be
        </a>
        ).
      </p>

      <h2>Cookies and browser storage</h2>
      <p>
        We use one cookie, which keeps you signed in; it is strictly necessary and only sent to {SITE.name}. The website
        also keeps your theme and the server you last opened in your browser's storage, so they are there next time. There
        are no tracking cookies, so there is nothing to consent to.
      </p>

      <h2>Children</h2>
      <p>
        {SITE.name} is for people old enough to use Discord in their country, and at least 13. See the{' '}
        <Link to="/terms">Terms of Service</Link>.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes, the new version appears here with a new date. For significant changes we will also say so
        on the website.
      </p>
    </PublicLayout>
  )
}
