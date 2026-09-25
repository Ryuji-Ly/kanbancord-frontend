import { Link } from 'react-router-dom'
import { PublicLayout } from './PublicLayout'
import { SITE } from './siteInfo'

export function AboutPage() {
  return (
    <PublicLayout
      title="About"
      description="KanbanCord is a kanban board that lives in your Discord server: run it entirely with the bot, and use the website for the big picture and fine-tuning."
      path="/about"
    >
      <h1>About {SITE.name}</h1>
      <p>
        {SITE.name} is a kanban board that lives in your Discord server. The idea is simple: your community already talks
        in Discord, so planning should happen there too. Create boards and columns, add tasks, move them along, assign
        people, set labels, priorities and due dates, and discuss them in comments, all with the bot's slash commands,
        without leaving the chat. Updates arrive in the channels you choose and, for your own tasks, by direct message.
      </p>
      <p>
        Most people never need anything else. The website is there when you want the whole board at a glance, or to
        fine-tune things: detailed permissions per board and per person, the labels and priority levels a board offers,
        which features a server uses, exactly which updates you are told about, and the audit log of every change.
      </p>
      <p>
        It follows your server's Discord roles and permissions from the start, so the right people see and change the right
        boards without setting anything up twice.
      </p>

      <h2>Made by one person</h2>
      <p>
        {SITE.name} is built and run by {SITE.operator}. It is free, has no ads, and does not sell or track your data (see
        the <Link to="/privacy">Privacy Policy</Link>). Found a problem or have an idea? Use <code>/report</code> in Discord.
        If you would like to help with its costs, see <Link to="/support">Support</Link>.
      </p>

      <h2>Get started</h2>
      <ol>
        <li>Add the bot to your server.</li>
        <li>
          Create a board with <code>/board create</code>, then add tasks with <code>/task create</code>.
        </li>
        <li>
          Run <code>/help</code> to see everything the bot can do.
        </li>
      </ol>
      <p>
        Questions? See the <Link to="/faq">FAQ</Link>.
      </p>
    </PublicLayout>
  )
}
