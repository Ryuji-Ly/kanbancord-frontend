import { Link } from 'react-router-dom'
import { GuideImage } from './GuideImage'
import { GuideLayout } from './GuideLayout'

export function LabelsPrioritiesGuide() {
  return (
    <GuideLayout slug="labels-and-priorities">
      <p>
        As a task list grows, you want to see at a glance what kind of work each task is and what matters most. Labels
        and priorities do that, and both are managed with slash commands.
      </p>

      <h2>Switch them on</h2>
      <p>
        A server manager runs <code>/kanbancord features</code> and picks <strong>Labels</strong>,{' '}
        <strong>Priorities</strong> or both. Each board has its own labels and priority levels.
      </p>

      <h2>Priorities</h2>
      <p>
        Boards start with five levels, from most to least urgent: <strong>Critical</strong>, <strong>High</strong>,{' '}
        <strong>Medium</strong>, <strong>Low</strong> and <strong>Ignorable</strong>. Set a task&apos;s level with{' '}
        <code>/task priority</code>, or pick it in the form when you create the task.
      </p>
      <ul>
        <li>
          <code>/priority list board:Sprint</code> shows the levels and how many tasks have each.
        </li>
        <li>
          <code>/priority create name:Urgent color:Red position:1</code> adds a level; position 1 is the most urgent.
        </li>
        <li>
          <code>/priority move</code> reorders them, <code>/priority edit</code> renames or recolours one, and{' '}
          <code>/priority delete</code> removes one (tasks that had it are left without a priority).
        </li>
      </ul>

      <h2>Labels</h2>
      <p>
        Labels say what a task is about: <em>Bug</em>, <em>Design</em>, <em>Event</em>, <em>Docs</em>. A task can have
        several.
      </p>
      <ul>
        <li>
          <code>/label create board:Sprint name:Bug color:Red</code> makes one. Pick a colour from the list or type any
          hex colour; leave it out and the board&apos;s least used colour is chosen.
        </li>
        <li>
          <code>/task label task:Fix login label:Bug</code> puts it on a task, and the same command takes it off again.
        </li>
        <li>
          <code>/label list</code>, <code>/label edit</code> and <code>/label delete</code> manage them.
        </li>
      </ul>

      <h2>Filter by them</h2>
      <p>
        On the <Link to="/guides/website-board">website</Link>, a board&apos;s search bar filters tasks by label, by
        priority, by who is assigned and by due date, so &ldquo;every high-priority bug&rdquo; is two clicks away.
      </p>

      <GuideImage
        src="/images/guides/filters.webp"
        width={3440}
        height={1000}
        alt="A board filtered to tasks with the Code label, showing each task with its coloured labels and priority badge."
        caption="Every task labelled Code, with its priority on the right."
      />
    </GuideLayout>
  )
}
