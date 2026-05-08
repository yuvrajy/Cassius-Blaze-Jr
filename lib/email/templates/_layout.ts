// Minimal HTML shell. We deliberately keep emails plain — editorial register,
// no images, no fancy CSS. This survives every email client, including
// plaintext-only ones.

export function htmlLayout(args: { title: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escape(args.title)}</title>
  </head>
  <body style="font-family: Georgia, 'Times New Roman', serif; color: #111; max-width: 560px; margin: 32px auto; padding: 0 16px; line-height: 1.55;">
${args.body}
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
    <p style="color: #888; font-size: 13px;">The Norm — getknown.com</p>
  </body>
</html>`
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function p(text: string): string {
  return `    <p>${escape(text)}</p>`
}

export function a(href: string, label: string): string {
  return `<a href="${escape(href)}" style="color: #111; text-decoration: underline;">${escape(label)}</a>`
}
