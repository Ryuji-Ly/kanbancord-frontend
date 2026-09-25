import { FiBell, FiCommand, FiEye, FiLayout, FiShield, FiZap } from 'react-icons/fi'
import { buildBotInviteLink } from '../features/dashboard/dashboardModel'
import { usePageMeta } from './usePageMeta'

const FEATURES = [
  {
    icon: FiLayout,
    title: 'Boards for every project',
    text: 'Columns and tasks with labels, priorities, due dates, assignees, comments, checklists, images and videos.',
  },
  {
    icon: FiShield,
    title: 'Your Discord permissions',
    text: 'Access follows your server roles out of the box, and can be fine-tuned per board and per person.',
  },
  {
    icon: FiCommand,
    title: 'Work from Discord',
    text: 'Look up boards and tasks, create, move and assign them with slash commands, without leaving the chat.',
  },
  {
    icon: FiBell,
    title: 'Updates, not noise',
    text: 'Post changes to chosen channels and get direct messages about your tasks, never pinged twice for one thing.',
  },
  {
    icon: FiZap,
    title: 'Live for everyone',
    text: 'Changes appear for everyone at once, on the website and in Discord.',
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
    'Kanban boards for Discord servers: plan tasks on the website, follow your server roles and permissions, and keep up in Discord with slash commands and notifications.',
    '/',
  )

  return (
    <div className="kc-landing">
      <section className="kc-landing-hero">
        <img src="/images/kanbancord.png" alt="" width={88} height={88} />
        <h1>Kanban boards for your Discord server</h1>
        <p>
          Plan work on the website, and keep up with it where your community already talks: slash commands, channel
          updates and direct messages.
        </p>
        <div className="kc-landing-actions">
          <a className="kc-btn kc-btn-primary" href={buildBotInviteLink()} target="_blank" rel="noopener noreferrer">
            Add to Discord
          </a>
          <button type="button" className="kc-btn kc-btn-ghost" onClick={onLogin}>
            Sign in with Discord
          </button>
        </div>
        <p className="kc-muted kc-landing-free">Free. No ads. No tracking.</p>
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
            <strong>Sign in</strong> here with Discord and pick the server.
          </li>
          <li>
            <strong>Create a board</strong>, and invite your team to use it.
          </li>
        </ol>
      </section>
    </div>
  )
}
