import 'server-only'
import { timingSafeEqual } from 'node:crypto'

// Constant-time bearer-token comparison for cron routes. Returns true only
// when the request has `Authorization: Bearer <CRON_SECRET>` and CRON_SECRET
// is non-empty. Vercel Cron also adds this header automatically when the
// project has CRON_SECRET set, but we accept any caller that knows the
// secret so the same routes are usable from external schedulers.
//
// Importantly: returns false (caller emits 401) when CRON_SECRET is unset,
// instead of throwing — a misconfigured cron should fail loudly but cleanly.

export function verifyCronAuth(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const header = request.headers.get('authorization') ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (!m) return false
  const provided = m[1]
  // Equal-length guard before timingSafeEqual to keep it from throwing.
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
