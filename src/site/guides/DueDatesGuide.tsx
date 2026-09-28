import { Link } from 'react-router-dom'
import { GuideImage } from './GuideImage'
import { GuideLayout } from './GuideLayout'

export function DueDatesGuide() {
  return (
    <GuideLayout slug="due-dates-and-reminders">
      <p>
        Deadlines slip when nobody sees them coming. KanbanCord gives tasks due dates and reminds the people on them by
        direct message before a task is due and when it is overdue, so your to-do list does not quietly fall behind.
      </p>

      <h2>Switch on due dates</h2>
      <p>
        A server manager runs <code>/kanbancord features</code> and picks <strong>Due dates</strong>. Boards can switch
        it off again for themselves on the website.
      </p>

      <h2>Set a due date</h2>
      <p>When you create a task, the form asks when it is due. For an existing task:</p>
      <pre>
        <code>/task due board:Sprint task:Fix login when:tomorrow</code>
      </pre>
      <p>
        <code>when</code> understands <code>today</code>, <code>tomorrow</code>, <code>in 3 days</code>,{' '}
        <code>in 2 weeks</code>, <code>in 5 hours</code>, or a date like <code>2026-10-01</code> or{' '}
        <code>2026-10-01 17:00</code>. A date alone is due at the end of that day. Use <code>none</code> to remove the
        due date. Times you type in Discord are in UTC; Discord then shows every due date in each reader&apos;s own time
        zone, and on the website you pick dates in your own.
      </p>

      <h2>Reminders</h2>
      <p>
        The people on a task get a direct message when it is due within a day, and again once it is overdue. Each
        reminder is sent once per due date: change the date, and the reminders start over. Tasks in a board&apos;s last
        column count as done and get no reminders.
      </p>
      <p>
        Who is reminded? Everyone who hears about the task: the people{' '}
        <Link to="/guides/assign-tasks">assigned to it</Link>, whoever created it, and anyone following it. Each person
        can turn reminders off with the rest of their direct messages in <code>/notifications</code>, or on the
        website.
      </p>
      <p>
        An <Link to="/guides/board-posts-and-feeds">update feed</Link> can post reminders in a channel too, mentioning
        the people on the task. They are off in new feeds; switch them on in the feed&apos;s settings on the website.
      </p>

      <h2>Seeing what is due</h2>
      <p>
        Task lists in Discord show each task&apos;s due date as &ldquo;in 2 days&rdquo; or &ldquo;3 hours ago&rdquo;.
        On the website, filter a board to <strong>overdue</strong> tasks or those due in the next seven days.
      </p>

      <GuideImage
        src="/images/guides/due-filter.webp"
        width={3440}
        height={1000}
        alt="A board filtered to tasks due in the next seven days: six of fourteen tasks are shown."
        caption="The board filtered to what is due this week."
      />
    </GuideLayout>
  )
}
