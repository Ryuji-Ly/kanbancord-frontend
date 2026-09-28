import { Link } from 'react-router-dom'
import { GuideLayout } from './GuideLayout'

export function PermissionsGuide() {
  return (
    <GuideLayout slug="roles-and-permissions">
      <p>
        Your server already says who is who with Discord roles. KanbanCord uses them, so the right people see and
        change the right boards from the moment you add the bot, and you can fine-tune it when you need to.
      </p>

      <h2>Out of the box</h2>
      <p>
        What someone may do follows the Discord permissions their roles give them, each step adding to the one before:
      </p>
      <ul>
        <li>
          <strong>View Channels</strong>: see boards and their tasks.
        </li>
        <li>
          <strong>Send Messages</strong>: also create and move tasks, comment, put labels on tasks, and assign
          themselves.
        </li>
        <li>
          <strong>Manage Messages</strong> (moderators): also edit and delete tasks, and assign other people.
        </li>
        <li>
          <strong>Manage Channels</strong>: also manage a board&apos;s columns, labels, priority levels, details and
          permissions, post boards in channels, and read the audit log.
        </li>
        <li>
          <strong>Manage Server</strong> and administrators: everything, including creating and deleting boards and the
          server&apos;s features and permissions.
        </li>
      </ul>
      <p>
        Nothing needs setting up, and when someone gets or loses a role in Discord, KanbanCord follows straight away.
      </p>

      <h2>Fine-tuning</h2>
      <p>
        To change who may do what, a server manager switches on <strong>Custom permissions</strong> with{' '}
        <code>/kanbancord features</code>. Then, on the website:
      </p>
      <ul>
        <li>
          <strong>Server-wide rules</strong> say what each role may do on every board: create tasks, move them, assign
          others, delete, manage columns and more.
        </li>
        <li>
          <strong>Board rules</strong> change that for one board, for example to make a board only visible to a
          <em> Staff</em> role.
        </li>
        <li>
          <strong>Per-person rules</strong> make exceptions for one member, whatever their roles.
        </li>
      </ul>
      <p>
        Rules can allow or deny. A rule for a person beats one for their roles, and a board&apos;s rules beat the
        server&apos;s. People who may change a board&apos;s permissions cannot give out more than they have themselves.
      </p>

      <h2>In Discord</h2>
      <p>
        The bot uses the same rules as the website: everything a command does is checked as the person who ran it. Menus
        only offer what you may do, and autocomplete only suggests the boards you can see.
      </p>
      <p>
        One thing to keep in mind: a <Link to="/guides/board-posts-and-feeds">board post</Link> shows a board to
        everyone who can see its channel. Posting needs the right to edit the board, and you are asked first if some
        people there could not see it otherwise.
      </p>

      <h2>Keeping track</h2>
      <p>
        Every change, including changes to permissions, is recorded in the audit log on the website, with who made it
        and whether it came from Discord or the website.
      </p>
    </GuideLayout>
  )
}
