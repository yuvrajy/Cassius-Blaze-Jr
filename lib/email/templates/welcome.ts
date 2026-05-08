import type { RenderedEmail } from '@/lib/email/client'
import { a, htmlLayout, p } from './_layout'

export function welcomeEmail(args: {
  display_name: string
  magic_link: string
}): RenderedEmail {
  const subject = 'Welcome to The Norm — your profile is in moderation'
  const intro = `Hi ${args.display_name},`
  const body =
    "Thanks for paying — we've received your details. A human moderator will review your bio and photos within 24 hours, after which your profile and news article go live."
  const sign = 'You can manage your profile at any time:'

  const html = htmlLayout({
    title: subject,
    body: [
      p(intro),
      p(body),
      p(sign),
      `    <p>${a(args.magic_link, 'Sign in to your dashboard')}</p>`,
    ].join('\n'),
  })

  const text = [
    intro,
    '',
    body,
    '',
    sign,
    args.magic_link,
    '',
    '— The Norm',
  ].join('\n')

  return { subject, html, text }
}
