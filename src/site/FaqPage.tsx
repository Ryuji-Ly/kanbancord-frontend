import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PublicLayout } from './PublicLayout'
import { SITE } from './siteInfo'

const QUESTIONS: { question: string; answer: ReactNode }[] = [
  {
    question: `Is ${SITE.name} free?`,
    answer: 'Yes. There are no paid plans, no ads, and your data is not sold.',
  },
  {
    question: 'Do I need the website?',
    answer: (
      <>
        No. {SITE.name} is built to be used entirely from Discord: create boards, columns and tasks, move and assign them,
        set labels, priorities and due dates, comment, and choose your notifications, all with slash commands. The website
        is for when you want the whole board at a glance, or to fine-tune settings.
      </>
    ),
  },
  {
    question: 'How do I add it to my server?',
    answer: (
      <>
        Use "Add to Discord" at the bottom of any page, and pick the server. You need the Manage Server permission there.
        Then create a first board with <code>/board create</code> and add tasks with <code>/task create</code>.
      </>
    ),
  },
  {
    question: 'Who can see and change my boards?',
    answer: (
      <>
        It follows your server's Discord roles and permissions by default: administrators and moderators can manage
        boards, members can work with tasks. Server administrators can change this for the whole server or per board, in
        the server and board settings.
      </>
    ),
  },
  {
    question: 'Why does signing in ask for my list of servers?',
    answer: `So ${SITE.name} can show which of your servers you can manage and add the bot to. It does not read your messages.`,
  },
  {
    question: 'What can I do from Discord?',
    answer: (
      <>
        Everything you need day to day: create, view, rename and archive boards; add, rename, reorder and delete columns;
        create, edit, move and delete tasks; assign people and roles; set labels, priorities and due dates; read and write
        comments; choose your own notifications with <code>/notifications</code>; and, for server managers, set up update
        channels with <code>/kanbancord</code>. Run <code>/help</code> in Discord for every command.
      </>
    ),
  },
  {
    question: 'What needs the website?',
    answer: (
      <>
        Fine-tuning and the big picture: seeing a whole board at once, permission rules per board and per person, the
        labels and priority levels a board offers, which features a server uses, exactly which updates you are told about,
        themes and accessibility options, uploading images and videos, and browsing the audit log.
      </>
    ),
  },
  {
    question: 'How do notifications work?',
    answer: (
      <>
        A server can have the bot post updates in chosen channels, and mirror its audit log in one. You can also get
        direct messages about tasks you are assigned to or created, including reminders when they are due. If a channel
        already mentioned you about something, you do not get a direct message about it too. Choose what you get with{' '}
        <code>/notifications</code>, or in more detail under Settings → Notifications on the website. Server managers set
        up channels with <code>/kanbancord</code>.
      </>
    ),
  },
  {
    question: 'Where are uploaded images and videos stored?',
    answer: 'On Imgur. Anyone with the link can see them, so do not upload anything private.',
  },
  {
    question: 'How do I remove my data?',
    answer: (
      <>
        Sign out everywhere under Settings → Sessions, and ask us to delete the rest at{' '}
        <a href={`mailto:${SITE.email}`}>{SITE.email}</a>. Server administrators can delete boards, and removing the bot
        from a server stops it syncing that server. Details are in the <Link to="/privacy">Privacy Policy</Link>.
      </>
    ),
  },
  {
    question: 'I found a bug, or have an idea.',
    answer: (
      <>
        Use <code>/report</code> in Discord; it goes straight to the developer.
      </>
    ),
  },
]

export function FaqPage() {
  return (
    <PublicLayout
      title="FAQ"
      description="Answers about KanbanCord: pricing, adding the bot, permissions, Discord commands, notifications, uploads and your data."
      path="/faq"
    >
      <h1>Frequently asked questions</h1>
      <div className="kc-faq">
        {QUESTIONS.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </PublicLayout>
  )
}
