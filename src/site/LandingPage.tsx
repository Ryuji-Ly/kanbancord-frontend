import { FiBell, FiCommand, FiEye, FiLayout, FiShield, FiZap } from 'react-icons/fi'
import { buildBotInviteLink } from '../features/dashboard/dashboardModel'
import { usePageMeta } from './usePageMeta'
import { SITE } from './siteInfo'

const FEATURES = [
  {
    icon: FiCommand,
    title: 'Everything from Discord',
    text: 'Create boards and tasks, move and assign them, set due dates and comment with slash commands. No need to leave the chat.',
  },
  {
    icon: FiLayout,
    title: 'Real kanban boards',
    text: 'Columns and tasks with labels, priorities, due dates, assignees, comments, checklists, images and videos.',
  },
  {
    icon: FiShield,
    title: 'Your Discord permissions',
    text: 'Access follows your server roles out of the box, and can be fine-tuned per board and per person on the website.',
  },
  {
    icon: FiBell,
    title: 'Updates, not noise',
    text: 'Post changes to chosen channels and get direct messages about your tasks, never pinged twice for one thing.',
  },
  {
    icon: FiZap,
    title: 'The big picture, when you want it',
    text: 'The website shows whole boards at a glance and holds the fine-tuning, with every change live for everyone.',
  },
  {
    icon: FiEye,
    title: 'Made to be comfortable',
    text: 'Themes including high contrast and colour-blind friendly ones, text size, and a simple mode for small teams.',
  },
]

/** What a signed-out visitor sees at the site's front door. */
export function LandingPage({ onLogin }: { onLogin: () => void }) {
  usePageMeta(
    'Kanban boards for Discord',
    'A kanban board that lives in your Discord server: create, move and assign tasks with slash commands, get updates in your channels, and use the website for the big picture.',
    '/',
  )

  return (
    <div className="kc-landing">
      <section className="kc-landing-hero">
        <img src="/images/kanbancord.png" alt="" width={88} height={88} />
        <h1>A kanban board that lives in your Discord server</h1>
        <p>
          Plan and track work where your community already talks. Create, move and assign tasks with slash commands, and
          get updates in your channels. The website is there when you want the whole picture.
        </p>
        <div className="kc-landing-actions">
          <a className="kc-btn kc-btn-primary" href={buildBotInviteLink()} target="_blank" rel="noopener noreferrer">
            Add to Discord
          </a>
          <button type="button" className="kc-btn kc-btn-ghost" onClick={onLogin}>
            Sign in with Discord
          </button>
        </div>
        <p className="kc-muted kc-landing-free">
          Free. No ads. No tracking. Also on{' '}
          <a href={SITE.appDirectoryUrl} target="_blank" rel="noopener noreferrer">
            Discord&apos;s App Directory
          </a>
          .
        </p>
      </section>

      <section className="kc-landing-features" aria-label="Features">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="kc-landing-feature">
            <Icon aria-hidden="true" />
            <h2>{title}</h2>
            <p>{text}</p>
          </div>
        ))}
      </section>

      <section className="kc-landing-steps">
        <h2>Start in a minute</h2>
        <ol>
          <li>
            <strong>Add the bot</strong> to your server.
          </li>
          <li>
            <strong>Create a board</strong> with <code>/board create</code>.
          </li>
          <li>
            <strong>Add tasks</strong> with <code>/task create</code>, and run <code>/help</code> to see the rest.
          </li>
        </ol>
      </section>
    </div>
  )
}
