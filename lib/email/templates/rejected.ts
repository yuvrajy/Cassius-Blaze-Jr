import type { RenderedEmail } from '@/lib/email/client'
import { htmlLayout, p } from './_layout'

export function rejectedEmail(args: {
  display_name: string
  reason: string
}): RenderedEmail {
  const subject = 'Your Norm profile was not approved'
  const html = htmlLayout({
    title: subject,
    body: [
      p(`Hi ${args.display_name},`),
      p('Our moderation team reviewed your submission and was unable to approve it. The flagged issue was:'),
      `    <blockquote style="border-left: 3px solid #c00; padding-left: 12px; color: #555;">${args.reason}</blockquote>`,
      p('You can edit your bio and photos and resubmit from your dashboard. If you believe this was decided in error, reply to this email and we will look again.'),
    ].join('\n'),
  })
  const text = [
    `Hi ${args.display_name},`,
    '',
    'Our moderation team reviewed your submission and was unable to approve it.',
    '',
    `Reason: ${args.reason}`,
    '',
    'You can edit and resubmit from your dashboard. Reply to this email if you would like a second look.',
    '',
    '— The Norm',
  ].join('\n')
  return { subject, html, text }
}
