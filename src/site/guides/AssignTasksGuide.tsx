import { Link } from 'react-router-dom'
import { GuideLayout } from './GuideLayout'

export function AssignTasksGuide() {
  return (
    <GuideLayout slug="assign-tasks">
      <p>
        A shared task list works best when everyone knows who is doing what. KanbanCord lets you assign tasks to people
        and to whole Discord roles, shows who is on each task, and tells people about the tasks they are assigned to.
      </p>

      <h2>Switch on assignees</h2>
      <p>
        Assigning is one of the features servers switch on when they need it. A server manager runs{' '}
        <code>/kanbancord features</code> and picks <strong>Assignees</strong>.
      </p>

      <h2>Assign people and roles</h2>
      <ul>
        <li>
          <code>/task assign board:Sprint task:Fix login</code> assigns you.
        </li>
        <li>
          <code>/task assign task:Fix login user:@Mia</code> assigns someone else.
        </li>
        <li>
          <code>/task assign task:Fix login role:@Design</code> assigns a whole role, so the task is for the team rather
          than one person. Assigning a role only says who the task is for; it gives the role no extra rights.
        </li>
        <li>
          <code>/task unassign</code> takes someone off, with the same options.
        </li>
      </ul>
      <p>
        You can also pick people when you create a task, since the form asks for them once assignees are on, and from
        the task&apos;s menu in <code>/task view</code>. On an{' '}
        <Link to="/guides/board-posts-and-feeds">update feed</Link> with buttons, every post has a picker showing who is
        assigned: add or remove people right there.
      </p>

      <h2>Keeping people in the loop</h2>
      <p>
        People hear about the tasks they are assigned to by direct message: when they are assigned, when the task
        moves, when its due date changes, when someone comments, and more. Everyone chooses what they get with{' '}
        <code>/notifications</code>, and nobody is ever told about their own changes. If an update feed already
        mentioned someone in a channel they can see, they can skip the direct message about the same thing.
      </p>
      <p>
        Not assigned, but want to keep an eye on a task? <strong>Follow</strong> it from its menu, from the website, or
        with the Follow button on a feed post, and you will hear about it like its assignees do.
      </p>

      <h2>Who may assign whom</h2>
      <p>
        By default, everyone who can send messages may assign themselves, and moderators (Manage Messages) may assign
        others. Servers can change that, per board and per role; see{' '}
        <Link to="/guides/roles-and-permissions">roles and permissions</Link>.
      </p>
    </GuideLayout>
  )
}
