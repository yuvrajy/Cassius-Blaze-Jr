import type { RenderedEmail } from '@/lib/email/client'

export interface ExpiryWarningArgs {
  display_name: string
  /** ISO timestamp of profile.expires_at. */
  expires_at: string
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export function renderExpiryWarning(args: ExpiryWarningArgs): RenderedEmail {
  const date = formatDate(args.expires_at)
  const subject = `Your profile expires on ${date}`
  const text = [
    `Hi ${args.display_name},`,
    '',
    `Your profile on The Norm expires on ${date}.`,
    '',
    'If you renew before then, nothing changes — your article and personal site stay live.',
    "If you don't, we'll take everything down on the expiry date and remove it for good 30 days after that.",
    '',
    'Renew from your dashboard.',
    '',
    '— The Norm',
  ].join('\n')
  const html = `
    <p>Hi ${escape(args.display_name)},</p>
    <p>Your profile on The Norm expires on <strong>${escape(date)}</strong>.</p>
    <p>If you renew before then, nothing changes — your article and personal site stay live.
       If you don't, we'll take everything down on the expiry date and remove it for good 30 days after that.</p>
    <p>Renew from your dashboard.</p>
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
