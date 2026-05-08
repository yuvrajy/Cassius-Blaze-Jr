import type { RenderedEmail } from '@/lib/email/client'
import { htmlLayout, p } from './_layout'

export function reModerationEmail(args: {
  display_name: string
}): RenderedEmail {
  const subject = 'Your Norm profile is back in moderation'
  const html = htmlLayout({
    title: subject,
    body: [
      p(`Hi ${args.display_name},`),
      p('We received your edit. Because the bio changed, your profile and article are temporarily back in moderation while we re-review and regenerate the article.'),
      p('Typical turnaround is under 24 hours. We will email you again once you are live.'),
    ].join('\n'),
  })
  const text = [
    `Hi ${args.display_name},`,
    '',
    'We received your edit. Your profile is temporarily back in moderation while we re-review and regenerate the article. Turnaround is typically under 24 hours.',
    '',
    '— The Norm',
  ].join('\n')
  return { subject, html, text }
}
