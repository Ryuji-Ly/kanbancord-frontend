import { Link } from 'react-router-dom'
import { GuideImage } from './GuideImage'
import { GuideLayout } from './GuideLayout'

export function FeedsThreadsGuide() {
  return (
    <GuideLayout slug="feeds-and-threads">
      <p>
        An update feed posts in a channel every time something happens on your boards, and mentions the people it
        concerns. A board can also give each task its own thread for discussion. This guide sets both up step by step,
        explains every setting, and lists what to check when something does not show up. Everything here can be done in
        Discord; the website has the same settings if you prefer it.
      </p>

      <h2>1. Add a feed</h2>
      <p>
        A server manager runs <code>/kanbancord feed channel:#updates</code>. Add <code>board:Sprint</code> to cover one
        board; leave it out to cover every board, including boards made later.
      </p>
      <ul>
        <li>
          The bot needs <strong>View Channel</strong> and <strong>Send Messages</strong> in that channel. If it is
          missing either, the command says so and saves nothing.
        </li>
        <li>
          A new feed posts most events: tasks created, changed, moved and deleted, people and roles assigned, new
          comments, labels, and changes to columns and boards. It mentions people when they are assigned or unassigned.
          Due date reminders, edited and deleted comments and board settings are off until you switch them on. Press{' '}
          <strong>Choose events and mentions</strong> on the reply to change any of it straight away.
        </li>
        <li>
          Running the command again for the same channel and board updates that feed instead of adding a second one.
        </li>
        <li>
          Posts are <strong>interactive</strong> by default: under each update, the whole task, with buttons to move it,
          assign people, edit or follow it. Add <code>interactive:False</code> for short posts without buttons.
        </li>
      </ul>

      <h2>2. Choose what it posts and who it mentions</h2>
      <p>
        <code>/kanbancord settings</code> lists the server&apos;s feeds. Pick one from the menu to open its editor, where
        each menu saves as you change it:
      </p>
      <ul>
        <li>
          <strong>What it posts</strong>: every event, from tasks created, moved and renamed to comments, labels, due
          date reminders and changes to the board itself.
        </li>
        <li>
          <strong>Which posts mention the people involved</strong>. Who that is depends on the event: someone being
          assigned or unassigned mentions that person; anything else about a task mentions the people assigned to it.
          Nobody is ever mentioned about a change they made themselves.
        </li>
        <li>
          <strong>Which boards it covers</strong>: every board, or the ones you pick.
        </li>
        <li>
          <strong>Posts with or without buttons</strong>, and whether <strong>roles</strong> assigned to a task are
          mentioned too, besides people.
        </li>
        <li>
          <strong>Delete feed</strong>, which asks first. Posts already in the channel stay.
        </li>
      </ul>
      <p>
        Quick changes to the same task are grouped into one post, so moving a task and assigning someone a moment later
        is one message, not two.
      </p>
      <GuideImage
        src="/images/guides/feeds.webp"
        width={2880}
        height={1800}
        alt="An update feed's settings on the website: the channel, its board, and for each kind of change whether it is posted and whether it mentions people."
        caption="The same settings on the website, in Server settings → Notifications."
      />

      <h2>3. Several feeds</h2>
      <ul>
        <li>
          A server can have as many feeds as it likes: one for every board in #updates, plus one for the Design board in
          #design, say. A change is posted by every feed that covers its board.
        </li>
        <li>
          Feeds in the <strong>same channel</strong> are posted there once, with everything either of them wants, so a
          channel never gets the same update twice.
        </li>
      </ul>

      <h2>4. Different settings for one board</h2>
      <p>
        A feed covering many boards can treat one of them differently: post fewer events about a busy board, or mention
        nobody about a quiet one. Whoever may edit the board runs <code>/board notifications board:Sprint</code>, picks
        the feed, and changes its menus. Only that board is affected.
      </p>
      <ul>
        <li>The board follows the feed&apos;s own settings until something is changed here.</li>
        <li>
          <strong>Use the feed&apos;s settings</strong> undoes the board&apos;s changes. Choosing the same as the feed
          does that too, for that event.
        </li>
        <li>
          The feed&apos;s editor in <code>/kanbancord settings</code> does not show a board&apos;s changes; on the
          website, the feed lists the boards that changed it.
        </li>
      </ul>

      <h2>5. A thread per task</h2>
      <p>
        A board with a feed can give each task its own thread in that feed&apos;s channel, so the discussion about a task
        stays with the task instead of scrolling past in chat. Whoever may edit the board switches it on:
      </p>
      <pre>
        <code>/board threads board:Sprint enabled:True</code>
      </pre>
      <ul>
        <li>
          <strong>Which channel</strong>: threads go in one of the board&apos;s feed channels. With only one, it is
          chosen for you; with several, add <code>channel:#updates</code>. No feed for the board yet? Add one first (step
          1).
        </li>
        <li>
          <strong>Public or private</strong>: public by default, started from the task&apos;s post in the channel, so
          anyone in the channel can join. With <code>private:True</code>, only the task&apos;s creator and assignees are
          in it (and Discord&apos;s server moderators, who can see every thread). New assignees are added as they are
          assigned. Private threads need a text channel; announcement channels only have public threads.
        </li>
        <li>
          <strong>Where updates go</strong> once a task has its thread: by default to <strong>both</strong> the thread
          and the channel, and only the channel post mentions people, so nobody is pinged twice.{' '}
          <code>updates:Only the thread</code> keeps the channel to new tasks only, with everything after that in each
          task&apos;s thread. <code>updates:Only the channel</code> posts nothing in threads, leaving them for
          discussion.
        </li>
        <li>
          <strong>Permissions</strong>: the bot needs <strong>Create Public Threads</strong> (or{' '}
          <strong>Create Private Threads</strong>) and <strong>Send Messages in Threads</strong> in the channel. The
          command tells you which is missing.
        </li>
      </ul>
      <p>How threads behave:</p>
      <ul>
        <li>
          A task gets its thread the first time something happens to it after threads are switched on, so existing tasks
          get one too, as they are worked on. To start one straight away, press <strong>Discuss in thread</strong> on the
          task, in <code>/task view</code> or under a feed post; once the thread exists, the button opens it.
        </li>
        <li>
          On a board with a feed but threads switched off, <strong>Discuss in thread</strong> tells people threads are
          off. Whoever may edit the board is offered to switch them on instead, in the board&apos;s feed channel (or
          one they pick, if there are several).
        </li>
        <li>The thread is renamed when the task is, and archived when the task is deleted or archived.</li>
        <li>
          Updates posted in the thread include new comments made in KanbanCord, if the feed posts comments. Messages
          written in the thread stay in Discord: they are not copied into the task.
        </li>
        <li>
          If someone deletes a task&apos;s thread, the task gets a new one the next time something happens to it.
        </li>
        <li>
          Switching threads off stops new threads; existing ones stay as they are, and still close when their task is
          deleted.
        </li>
      </ul>
      <p>
        <code>/board threads board:Sprint</code> on its own shows the board&apos;s setting. Options you leave out keep
        their current value, so <code>/board threads board:Sprint updates:Only the thread</code> changes just that.
      </p>

      <h2>Where to change what</h2>
      <ul>
        <li>
          <strong>Add a feed</strong>: <code>/kanbancord feed</code>, or Server settings → Notifications on the
          website.
        </li>
        <li>
          <strong>A feed&apos;s events, mentions, boards, buttons, or deleting it</strong>:{' '}
          <code>/kanbancord settings</code> → pick the feed, or Server settings → Notifications.
        </li>
        <li>
          <strong>A feed&apos;s events and mentions for one board</strong>: <code>/board notifications</code>, or the
          board&apos;s settings → Notifications.
        </li>
        <li>
          <strong>Task threads</strong>: <code>/board threads</code>, or the board&apos;s settings → Task threads.
        </li>
        <li>
          <strong>What you are told by direct message</strong>: <code>/notifications</code>, or Settings →
          Notifications. Every direct message also has a button to stop messages from its server.
        </li>
        <li>
          <strong>The audit log channel</strong>, every change pinging nobody:{' '}
          <code>/kanbancord audit-channel</code>.
        </li>
      </ul>
      <p>
        Adding feeds, changing them and the audit log channel are for server managers. A board&apos;s own feed settings
        and its threads are for whoever may edit that board.
      </p>

      <h2>Common setups</h2>
      <ul>
        <li>
          <strong>One channel for everything</strong>: a feed for every board in #updates. Simple, and fine for small
          servers.
        </li>
        <li>
          <strong>A channel per team</strong>: a feed per board in each team&apos;s own channel, so each team only sees
          its own work.
        </li>
        <li>
          <strong>A quiet channel, discussion in threads</strong>: a feed with threads on and updates going{' '}
          <em>only to the thread</em>. The channel shows each new task once; everything after happens in its thread.
        </li>
        <li>
          <strong>Sensitive tasks</strong>: a separate board with private threads, in a channel only its team can see.
        </li>
        <li>
          <strong>Feed and board post together</strong>: a <Link to="/guides/board-posts-and-feeds">board post</Link>{' '}
          in #board for where things stand, and a feed in #updates for what just happened.
        </li>
      </ul>

      <h2>When something does not show up</h2>
      <h3>Nothing is posted in the channel</h3>
      <ul>
        <li>
          Does the feed post that event? Check it in <code>/kanbancord settings</code>, and the board&apos;s own
          settings in <code>/board notifications</code>.
        </li>
        <li>Does the feed cover that board?</li>
        <li>
          Can the bot still post there? Someone may have changed the channel&apos;s permissions since the feed was
          added. The website marks channels the bot cannot post in.
        </li>
        <li>
          With threads on and updates going only to the thread, later updates are in the task&apos;s thread, not the
          channel.
        </li>
      </ul>
      <h3>Someone was not mentioned</h3>
      <ul>
        <li>Does the feed mention people for that event? The second menu in the feed&apos;s editor.</li>
        <li>Was it their own change? Nobody is mentioned about their own changes.</li>
        <li>
          Are they assigned to the task? Apart from someone being assigned or unassigned, posts mention the task&apos;s
          assignees.
        </li>
      </ul>
      <h3>No thread appeared</h3>
      <ul>
        <li>
          Has something happened to the task since threads were switched on? Threads are made then, not all at once.
          Press <strong>Discuss in thread</strong> on the task to make it now.
        </li>
        <li>
          Does <code>/board threads</code> say <em>On, but not working</em>? The channel no longer has a feed for this
          board: add one, or choose another feed channel.
        </li>
        <li>Can the bot make threads there? The command names the missing permission.</li>
        <li>
          Private threads only show up for their members: the task&apos;s creator, its assignees, and moderators.
        </li>
      </ul>

      <h2>Direct messages</h2>
      <p>
        Feeds are for channels. People also get direct messages about tasks they are assigned to, created or follow,
        unless a post already mentioned them where they could see it. See <code>/notifications</code> and{' '}
        <Link to="/guides/assign-tasks">assigning tasks</Link>.
      </p>
    </GuideLayout>
  )
}
