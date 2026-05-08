import type { RenderedEmail } from '@/lib/email/client'
import { htmlLayout, p } from './_layout'

export function takedownConfirmEmail(args: {
  display_name: string
  reason?: string
}): RenderedEmail {
  const subject = 'Your Norm profile has been taken down'
  const html = htmlLayout({
    title: subject,
    body: [
      p(`Hi ${args.display_name},`),
      p('Your profile and the linked article are no longer publicly visible. We have started the deindexing process with search engines — depending on crawl frequency, the URLs typically drop from search results within 1–2 weeks.'),
      args.reason ? p(`Reason on file: ${args.reason}`) : '',
      p('Per our retention policy, your underlying account data is held for 30 days before permanent deletion. If you change your mind in that window, reply to this email and we can restore the listing.'),
    ]
      .filter(Boolean)
      .join('\n'),
  })
  const text = [
    `Hi ${args.display_name},`,
    '',
    'Your profile and the linked article are no longer publicly visible. Deindexing typically completes within 1–2 weeks.',
    args.reason ? `Reason on file: ${args.reason}` : '',
    '',
    'Account data is retained for 30 days before permanent deletion. Reply within that window to restore the listing.',
    '',
    '— The Norm',
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, html, text }
}
