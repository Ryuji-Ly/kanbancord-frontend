import { Link } from 'react-router-dom'
import { PublicLayout } from './PublicLayout'
import { SITE } from './siteInfo'

export function AboutPage() {
  return (
    <PublicLayout
      title="About"
      description="KanbanCord brings kanban boards to Discord servers: plan work on the website, and keep up with it in Discord."
      path="/about"
    >
      <h1>About {SITE.name}</h1>
      <p>
        {SITE.name} gives Discord servers kanban boards. Plan work on the website: boards, columns and tasks, with
        labels, priorities, due dates, assignees, comments, images and videos. Keep up with it in Discord: look things up
        and make changes with slash commands, and get updates in your channels or by direct message.
      </p>
      <p>
        It follows your server's Discord roles and permissions, so the right people see and change the right boards
        without setting up anything twice. Communities, study groups, game projects and small teams all use it the same
        way: where they already talk.
      </p>

      <h2>Made by one person</h2>
      <p>
        {SITE.name} is built and run by {SITE.operator}. It is free, has no ads, and does not sell or track your data (see
        the <Link to="/privacy">Privacy Policy</Link>). Found a problem or have an idea? Use <code>/report</code> in Discord.
      </p>

      <h2>Get started</h2>
      <ol>
        <li>Add the bot to your server.</li>
        <li>Sign in on the website with Discord and pick the server.</li>
        <li>Create a board. Everything else follows from there.</li>
      </ol>
      <p>
        Questions? See the <Link to="/faq">FAQ</Link>.
      </p>
    </PublicLayout>
  )
}
