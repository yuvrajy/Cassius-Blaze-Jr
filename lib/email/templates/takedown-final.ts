import type { RenderedEmail } from '@/lib/email/client'

export interface TakedownFinalArgs {
  display_name: string
}

export function renderTakedownFinal(args: TakedownFinalArgs): RenderedEmail {
  const subject = 'Your data has been removed'
  const text = [
    `Hi ${args.display_name},`,
    '',
    "We've removed your profile and the article that referenced it.",
    'Your photos and personal details have been deleted from our systems.',
    '',
    "If you didn't request this, reply to this email and we'll investigate.",
    '',
    '— The Norm',
  ].join('\n')
  const html = `
    <p>Hi ${escape(args.display_name)},</p>
    <p>We've removed your profile and the article that referenced it.
       Your photos and personal details have been deleted from our systems.</p>
    <p>If you didn't request this, reply to this email and we'll investigate.</p>
    <p>— The Norm</p>
  `.trim()
  return { subject, html, text }
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
