import { Link } from 'react-router-dom'
import { GuideLayout } from './GuideLayout'

export function ToDoListGuide() {
  return (
    <GuideLayout slug="discord-to-do-list">
      <p>
        Most Discord servers keep their to-do list somewhere: a pinned message someone has to edit, a spreadsheet, or
        just scattered in chat. KanbanCord keeps it in your server as a shared todo list that everyone can see and
        update, stays current by itself, and never needs a single person to maintain it.
      </p>

      <h2>A to-do list with stages</h2>
      <p>
        A KanbanCord board is a to-do list split into columns. New boards start with <strong>To Do</strong>,{' '}
        <strong>In Progress</strong> and <strong>Done</strong>: add tasks to To Do, move them along as someone works on
        them, and ticking one off means moving it to Done. You can see at a glance what is left, what is being worked
        on and what is finished. This way of working is called kanban, but you do not need to know the word to use it.
      </p>
      <p>
        Want a plain checklist instead? Keep just two columns, To Do and Done, with <code>/column delete</code>. Or keep
        a checklist inside a single task: on the website, a task&apos;s description can hold tick boxes.
      </p>

      <h2>Set it up in a minute</h2>
      <ol>
        <li>
          <code>/board create name:To-do</code> creates the list.
        </li>
        <li>
          <code>/board post board:To-do</code> in the channel where it should live posts the whole list as one message.
        </li>
        <li>
          Anyone can press <strong>Add task</strong> on that message to add something, or use{' '}
          <code>/task create</code>.
        </li>
      </ol>
      <p>
        The post edits itself whenever the list changes, from Discord or the website, so the channel always shows the
        current state. Pin it, and it works like a to-do list pinned at the top of the channel that nobody has to keep
        up to date. It pings nobody, and several lists can share a channel.
      </p>

      <h2>Tick tasks off</h2>
      <p>
        Pick a task from the post&apos;s menu to open it privately, then move it to Done. Or run{' '}
        <code>/task move task:... column:Done</code>. If your server has an{' '}
        <Link to="/guides/board-posts-and-feeds">update feed</Link> with buttons, each update shows a button per column,
        so ticking a task off is one click.
      </p>

      <h2>Shared, not personal</h2>
      <p>
        A board belongs to the server, not to one person, and it follows your Discord roles: everyone who should see it
        can, and you decide who may change it. That makes it a good fit for a team&apos;s tasks, a community&apos;s
        event planning, a game server&apos;s build list, or a study group&apos;s assignments.
      </p>

      <h2>When a to-do list is not enough</h2>
      <p>
        Switch on more with <code>/kanbancord features</code> as your needs grow: assign tasks to people, give them due
        dates with <Link to="/guides/due-dates-and-reminders">reminders</Link>, sort them with{' '}
        <Link to="/guides/labels-and-priorities">labels and priorities</Link>, and discuss them in comments. Until then,
        simple mode keeps your list simple.
      </p>
    </GuideLayout>
  )
}
