import { Link } from 'react-router-dom'
import { GuideLayout } from './GuideLayout'

export function PostsFeedsGuide() {
  return (
    <GuideLayout slug="board-posts-and-feeds">
      <p>
        A task list only helps if people look at it. KanbanCord can show your boards in your channels in two ways. Most
        servers use one of them; they also work well together.
      </p>

      <h2>Board posts: where things stand</h2>
      <p>
        <code>/board post board:Sprint</code> posts the whole board in the channel or thread you run it in, as a single
        message: every column with its tasks. Whenever anything on the board changes, from Discord or the website, the
        message edits itself a moment later. It works like a live dashboard, or a to-do list pinned to the top of the
        channel that is always current.
      </p>
      <ul>
        <li>It pings nobody: it is there when people want to look.</li>
        <li>
          Anyone can open a column or a task from it, or press <strong>Add task</strong>. What opens is only visible to
          them and uses their own permissions, so one person&apos;s clicks never change the post for everyone.
        </li>
        <li>
          If some people in the channel could not normally see the board, you are asked before posting. In a private
          thread, only its members count.
        </li>
        <li>To stop a post, delete its message.</li>
      </ul>

      <h2>Update feeds: what just happened</h2>
      <p>
        <code>/kanbancord feed channel:#updates</code> (for server managers) posts a message for each change: a task
        created, moved, assigned, commented on, and so on. Quick changes to the same task are grouped into one post.
      </p>
      <ul>
        <li>
          Feeds mention the people a change concerns, such as someone who was just assigned, or the people on a task
          that moved. On the website you choose, per event, which changes are posted and which of them mention people.
          Nobody is pinged about their own changes.
        </li>
        <li>
          <strong>Interactive</strong> feeds (the default for new ones) show the whole task under each update, with
          buttons to move it, a picker to assign people, and Edit and Follow buttons. People can act on an update
          without typing a command.
        </li>
        <li>
          A feed can cover every board or one board. Running the command again for the same channel and board updates
          that feed instead of adding another.
        </li>
      </ul>

      <h2>Which one?</h2>
      <p>
        Use a <strong>board post</strong> when people mostly want to know where things stand: a small team, a shared
        to-do list, an event checklist. Use a <strong>feed</strong> when people need to know when something changes,
        especially when it concerns them. Busy servers often do both: a board post in #board and a feed in #updates.
      </p>

      <h2>The audit log channel</h2>
      <p>
        For a complete record, <code>/kanbancord audit-channel channel:#kanban-log</code> mirrors the audit log: every
        change, compactly, pinging nobody. The full audit log, with filters, is on the website.
      </p>

      <h2>Your own notifications</h2>
      <p>
        Besides channels, people get direct messages about tasks they are assigned to, created or follow. See{' '}
        <Link to="/guides/assign-tasks">assigning tasks</Link> and <code>/notifications</code>.
      </p>
    </GuideLayout>
  )
}
