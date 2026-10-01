import { Link } from 'react-router-dom'
import { GuideImage } from './GuideImage'
import { GuideLayout } from './GuideLayout'

export function PermissionsGuide() {
  return (
    <GuideLayout slug="roles-and-permissions">
      <p>
        Your server already says who is who with Discord roles. KanbanCord uses them, so the right people see and
        change the right boards from the moment you add the bot, and you can fine-tune it when you need to. This guide
        covers the defaults, how rules are added, and exactly how KanbanCord decides, with examples for each case.
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
          <strong>View Audit Log</strong>: see boards and read the audit log.
        </li>
        <li>
          <strong>Manage Server</strong>: everything above, plus creating and deleting boards and the server&apos;s
          features and permissions.
        </li>
        <li>
          <strong>Administrator</strong> and the server owner: everything, always.
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
          others, delete, manage columns and more. The defaults above are rules too, one per Discord permission, and
          can be changed like any other.
        </li>
        <li>
          <strong>Board rules</strong> change that for one board, for example to make a board only visible to a
          <em> Staff</em> role.
        </li>
        <li>
          <strong>Per-person rules</strong> make exceptions for one member, whatever their roles.
        </li>
      </ul>
      <GuideImage
        src="/images/guides/permissions.webp"
        width={2880}
        height={1800}
        alt="The server's permission rules on the website: what each Discord permission allows, from View Channel to Manage Server, plus a rule for the Organisers role."
        caption="The defaults, grouped by Discord permission, and a rule added for one role."
      />
      <p>
        Each rule either allows or denies one thing. People who may change permissions cannot give out more than they
        have themselves, and nobody can take away their own right to manage the server&apos;s permissions.
      </p>
      <p>
        Switching custom permissions off again puts the defaults back in charge straight away. Your rules are kept,
        unused, and apply again when you switch it back on.
      </p>

      <h2>How KanbanCord decides</h2>
      <p>Every time someone does something, KanbanCord answers one question: may this person do this, here?</p>
      <ol>
        <li>
          <strong>Administrators and the server owner</strong> may do everything. Nothing else is checked.
        </li>
        <li>
          <strong>Open permissions</strong>, if the server has them on: everyone who can view channels and send
          messages may work with boards, columns, labels and tasks, whatever the rules say. Managing the server, board
          permissions, deleting or archiving boards and the audit log still go by the rules.
        </li>
        <li>
          Otherwise, the rules are read in six steps. Each step that has a rule for this person and this action replaces
          the answer so far, so <strong>the last step with a matching rule decides</strong>:
          <ol>
            <li>Server-wide rules for Discord permissions (the defaults)</li>
            <li>Server-wide rules for roles</li>
            <li>Server-wide rules for the person</li>
            <li>The board&apos;s rules for Discord permissions</li>
            <li>The board&apos;s rules for roles</li>
            <li>The board&apos;s rules for the person</li>
          </ol>
        </li>
        <li>
          <strong>Within one step, a Deny beats any Allow.</strong> Someone with two roles, one allowed and one denied,
          is denied.
        </li>
        <li>
          <strong>If no rule matches at all, the answer is no.</strong>
        </li>
      </ol>
      <p>
        So a person beats their roles, roles beat Discord permissions, and a board beats the server. Note what that
        means for the board: <em>any</em> board rule outweighs <em>every</em> server-wide rule, even a server-wide rule
        for one person.
      </p>

      <h2>Examples</h2>
      <p>
        The examples use a server with these roles: <em>@everyone</em> (View Channels), <em>Members</em> (Send
        Messages), <em>Mods</em> (Manage Messages) and a few roles with no Discord permissions of their own. Sam has
        Members.
      </p>

      <h3>Just the defaults</h3>
      <p>
        Sam may create a task: Send Messages allows it. Sam may not edit someone else&apos;s task: nothing Sam has
        allows it, so the answer is no.
      </p>

      <h3>Two roles disagree</h3>
      <p>
        Server-wide, <em>Helpers</em> are allowed to delete tasks and <em>On break</em> is denied it. Sam has both.
        Both are role rules, in the same step, so the Deny wins: Sam may not delete tasks. The same goes for
        @everyone: a Deny for @everyone outweighs an Allow for any other role in that step.
      </p>

      <h3>A role rule against a Discord permission</h3>
      <p>
        Mods may delete tasks through Manage Messages. A server-wide rule denies deleting tasks to <em>Trial mods</em>.
        A mod who also has Trial mods may not delete tasks: role rules come after Discord permissions. It works the
        other way too: allow editing tasks for <em>Artists</em>, and every artist may edit tasks, without Manage
        Messages.
      </p>

      <h3>A Deny for a Discord permission</h3>
      <p>
        Deny creating tasks for everyone with View Channels, and you deny it to nearly everyone, mods included: in that
        step a Deny beats the Allow from Send Messages or Manage Messages. To stop one group, deny it to their role
        instead.
      </p>

      <h3>One person against their roles</h3>
      <p>
        <em>On break</em> is denied creating tasks, and Sam has On break. A rule allowing Sam personally to create tasks
        wins: rules for a person come after rules for roles.
      </p>

      <h3>A private board</h3>
      <p>
        On the board <em>Staff room</em>: deny seeing the board to everyone with View Channels, and allow it for{' '}
        <em>Staff</em>. Everyone without Staff no longer sees it, and Staff do. Even Sam, who has a server-wide rule
        allowing them to see boards, cannot see it: the board&apos;s rule for View Channels comes after every
        server-wide rule. To let Sam in, add a rule for Sam on that board.
      </p>

      <h3>Denied server-wide, allowed on one board</h3>
      <p>
        Members are denied creating tasks server-wide, and the board <em>Suggestions</em> allows it for Members. Sam may
        create tasks on Suggestions and nowhere else.
      </p>

      <h3>Administrators</h3>
      <p>
        Anyone with Administrator, and the server owner, may do everything on every board. No rule can change that, so
        the server can never lock out the people who run it.
      </p>

      <h3>Open permissions</h3>
      <p>
        With open permissions on, Sam may create columns and edit anyone&apos;s task even though no rule allows it, but
        still may not delete boards or read the audit log. Someone who cannot send messages is not included. Open
        permissions and custom permissions cannot be on together.
      </p>

      <h3>Custom permissions off</h3>
      <p>
        The server&apos;s own rules and every board&apos;s rules are set aside, and only the defaults apply. A board
        that was private is visible again to everyone with View Channels, so make sure that is what you want before
        switching it off.
      </p>

      <h3>Someone who left the server</h3>
      <p>
        They no longer have roles or Discord permissions here, so only rules for them personally count. With none, they
        may do nothing.
      </p>

      <h2>Check it yourself</h2>
      <p>
        Not sure what someone may do? <strong>Check access</strong>, in the server&apos;s settings on the website, shows
        it for any member: every action, allowed or denied, and the rule that decided it. Start from a member and add
        or remove roles to see what would change, or check a set of roles on its own. In a board&apos;s settings, the
        same check shows what applies on that board. Server managers can check anyone, and people who may edit a
        board&apos;s permissions can check anyone on that board.
      </p>

      <h2>In Discord</h2>
      <p>
        The bot uses the same rules as the website: everything a command does is checked as the person who ran it.
        Buttons are shown to everyone, and if you are not allowed to use one, the bot tells you when you try.
        Autocomplete only suggests the boards you can see.
      </p>
      <p>
        One thing to keep in mind: a <Link to="/guides/board-posts-and-feeds">board post</Link> shows a board to
        everyone who can see its channel. Posting needs the right to edit the board, and you are asked first if some
        people there could not see it otherwise.
      </p>

      <h2>Keeping track</h2>
      <p>
        Every change, including changes to permissions and switching features on or off, is recorded in the audit log
        on the website, with who made it and whether it came from Discord or the website.
      </p>
    </GuideLayout>
  )
}
