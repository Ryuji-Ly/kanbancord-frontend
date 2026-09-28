import { Link } from 'react-router-dom'
import { GuideLayout } from './GuideLayout'

export function WebsiteGuide() {
  return (
    <GuideLayout slug="website-board">
      <p>
        You can run KanbanCord entirely from Discord. The website is there for when you want the whole picture: every
        column and task of a board on one screen, and the settings that are easier with a bit of room. Sign in with
        Discord and pick your server.
      </p>

      <h2>The board</h2>
      <ul>
        <li>
          <strong>Drag and drop</strong> tasks between columns and within them, and reorder the columns themselves.
        </li>
        <li>
          <strong>Live</strong>: changes made by anyone, on the website or in Discord, appear straight away for everyone
          with the board open.
        </li>
        <li>
          <strong>Search and filters</strong>: press <kbd>/</kbd> to search titles and descriptions, and filter by who
          is assigned, label, priority or due date. Filters are in the page&apos;s address, so you can share a filtered
          view.
        </li>
      </ul>

      <h2>Tasks in full</h2>
      <p>Open a task to see and edit everything about it:</p>
      <ul>
        <li>A description with formatting, and checklists you can tick off right in the task.</li>
        <li>Images and videos, uploaded, dropped or pasted straight into the description.</li>
        <li>People and roles, labels, priority and due date, as your server has them switched on.</li>
        <li>Comments, and a Follow button to hear about the task by direct message.</li>
      </ul>

      <h2>Settings</h2>
      <ul>
        <li>
          <strong>Features</strong>: which ones the server uses, and which each board switches off for itself.
        </li>
        <li>
          <strong>Permissions</strong>: who may do what, per role, per board and per person. See{' '}
          <Link to="/guides/roles-and-permissions">roles and permissions</Link>.
        </li>
        <li>
          <strong>Notifications</strong>: update feeds, with each event and its mentions, and your own direct messages.
        </li>
        <li>
          <strong>Labels and priority levels</strong> for each board.
        </li>
        <li>
          <strong>Appearance</strong>: themes, including light and dark, and accessibility options.
        </li>
      </ul>

      <h2>The audit log</h2>
      <p>
        Every change is recorded, newest first: who did what, when, and whether it came from Discord or the website.
        Filter it by board, person or kind of change.
      </p>
    </GuideLayout>
  )
}
