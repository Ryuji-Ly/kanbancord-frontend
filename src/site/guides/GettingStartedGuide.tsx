import { Link } from 'react-router-dom'
import { GuideLayout } from './GuideLayout'

export function GettingStartedGuide() {
  return (
    <GuideLayout slug="getting-started">
      <p>
        KanbanCord gives your Discord server kanban boards: a simple, visual way to track tasks as they move from
        &ldquo;to do&rdquo; to &ldquo;done&rdquo;. Think of a board as your team&apos;s to-do list, split into stages,
        that everyone in the server can see and update. You set it up and use it with slash commands, right where your
        community already talks.
      </p>

      <h2>1. Add the bot to your server</h2>
      <p>
        Use <strong>Add to Discord</strong> on this page or at the bottom of any page, and choose your server. You need
        the Manage Server permission there. The bot follows your server&apos;s roles from the start, so there is nothing
        else to set up.
      </p>

      <h2>2. Create a board</h2>
      <p>Run:</p>
      <pre>
        <code>/board create name:Sprint</code>
      </pre>
      <p>
        Creating boards needs the Manage Server permission by default; everyone who can send messages can then add and
        move tasks. See <Link to="/guides/roles-and-permissions">roles and permissions</Link> for the details.
      </p>
      <p>
        The new board has three columns: <strong>To Do</strong>, <strong>In Progress</strong> and <strong>Done</strong>.
        Change them whenever you like with <code>/column add</code>, <code>/column rename</code>,{' '}
        <code>/column move</code> and <code>/column delete</code>. Many teams add a <em>Review</em> or{' '}
        <em>Blocked</em> column.
      </p>

      <h2>3. Add tasks</h2>
      <p>
        <code>/task create board:Sprint</code> opens a short form for the task&apos;s title and description. If your
        server uses assignees, due dates or priorities, the form asks for those too. Typing a board or task name in any
        command suggests matches as you type.
      </p>

      <h2>4. Move tasks along</h2>
      <p>
        As work progresses, move tasks across the board with <code>/task move</code>, for example to{' '}
        <strong>Done</strong> to tick them off your to-do list. <code>/task view</code> shows a task in full, with a menu
        for everything you may do to it: edit, move, assign, set a due date, comment, follow or delete.
      </p>
      <p>
        <code>/board view</code> shows the whole board, and <code>/board list</code> every board in the server.
      </p>

      <h2>5. Choose what your tasks can have</h2>
      <p>
        New servers start in <strong>simple mode</strong>: boards, columns, and tasks with a title and a description.
        That is often all a small to-do list needs. When you want more, a server manager can switch on assignees, due
        dates with reminders, priorities, labels, comments and custom permissions with{' '}
        <code>/kanbancord features</code>. Switching one off again hides it without deleting anything.
      </p>

      <h2>6. Show the board to everyone</h2>
      <p>
        Run <code>/board post</code> in a channel to post the whole board as one message that updates itself whenever
        anything changes. See <Link to="/guides/board-posts-and-feeds">board posts and update feeds</Link> for the other
        ways to keep your team up to date.
      </p>

      <h2>Where to next</h2>
      <p>
        Run <code>/guide</code> in Discord for these steps with your progress ticked off, and <code>/help</code> for
        every command with examples. The <Link to="/guides/website-board">website</Link> shows every board at a glance,
        with drag and drop, whenever you want the big picture.
      </p>
    </GuideLayout>
  )
}
