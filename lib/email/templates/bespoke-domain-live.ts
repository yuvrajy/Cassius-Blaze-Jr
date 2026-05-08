import type { RenderedEmail } from '@/lib/email/client'

export interface BespokeDomainLiveArgs {
  display_name: string
  domain: string
  redirect_to: string
}

export function renderBespokeDomainLive(
  args: BespokeDomainLiveArgs,
): RenderedEmail {
  const subject = `${args.domain} is live`
  const text = [
    `Hi ${args.display_name},`,
    '',
    `Your custom domain is live: https://${args.domain}`,
    `It points to your personal site at https://${args.redirect_to}.`,
    '',
    'It can take up to 24 hours for the redirect to propagate to all networks.',
    'If something looks off after that, let us know.',
    '',
    '— The Norm',
  ].join('\n')
  const html = `
    <p>Hi ${escape(args.display_name)},</p>
    <p>Your custom domain is live: <a href="https://${escape(args.domain)}">${escape(args.domain)}</a></p>
    <p>It points to your personal site at <a href="https://${escape(args.redirect_to)}">${escape(args.redirect_to)}</a>.</p>
    <p>It can take up to 24 hours for the redirect to propagate to all networks.
       If something looks off after that, let us know.</p>
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
