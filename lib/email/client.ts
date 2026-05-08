import 'server-only'
import { Resend } from 'resend'
import { devLog, devLogOnly } from '@/lib/inngest/dev'

// Resend wrapper. Templates live in lib/email/templates/ and return
// `{ subject, html, text }`; this module sends them.
//
// Sender address comes from EMAIL_FROM (e.g. "The Norm <hello@thenorm.info>")
// so it can be rotated without code changes.

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

let _resend: Resend | null = null

function getResend(): Resend {
  if (_resend) return _resend
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY not set')
  _resend = new Resend(key)
  return _resend
}

export interface SendEmailArgs {
  to: string
  email: RenderedEmail
  // Idempotency key — Resend dedupes within a 24h window. Use the workflow
  // step id (e.g. `welcome:{profile_id}`) so retries don't re-send.
  idempotencyKey?: string
}

export async function sendEmail({ to, email, idempotencyKey }: SendEmailArgs) {
  const from = process.env.EMAIL_FROM ?? 'The Norm <hello@thenorm.info>'
  if (devLogOnly('resend')) {
    devLog('resend', 'sendEmail', { to, from, subject: email.subject, idempotencyKey })
    return { id: `dev_${idempotencyKey ?? Date.now()}` }
  }
  const result = await getResend().emails.send(
    {
      from,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  )
  if (result.error) throw new Error(`Resend send failed: ${result.error.message}`)
  return { id: result.data?.id ?? '' }
}
