import type { RenderedEmail } from '@/lib/email/client'
import { a, htmlLayout, p } from './_layout'

export function approvedEmail(args: {
  display_name: string
  article_url: string
  personal_url: string
}): RenderedEmail {
  const subject = "You're live on The Norm"
  const html = htmlLayout({
    title: subject,
    body: [
      p(`Hi ${args.display_name},`),
      p('Your profile passed moderation and is now live across both surfaces:'),
      `    <ul>
        <li>${a(args.article_url, 'Your article on The Norm')}</li>
        <li>${a(args.personal_url, 'Your personal site')}</li>
      </ul>`,
      p('Search engines typically index new pages within a few days. You can speed this along by linking to either URL from your existing social profiles.'),
    ].join('\n'),
  })
  const text = [
    `Hi ${args.display_name},`,
    '',
    'Your profile passed moderation and is now live:',
    `- ${args.article_url}`,
    `- ${args.personal_url}`,
    '',
    'Search engines typically index new pages within a few days.',
    '',
    '— The Norm',
  ].join('\n')
  return { subject, html, text }
}
