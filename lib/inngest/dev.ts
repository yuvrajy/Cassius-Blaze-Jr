import 'server-only'

// Dev-mode flag: when set, every external API call (Stripe, Resend,
// Sightengine, TinEye, Anthropic, Supabase Auth admin email) logs the
// payload to stderr instead of hitting the network.
//
// Set DEV_MODE_LOG_ONLY=1 in .env.local to exercise the full pipeline
// against a Supabase dev instance without any third-party credentials.
//
// Individual modules can also opt in/out by setting DEV_<vendor>_LOG_ONLY
// — useful when you have e.g. real Stripe test keys but no Sightengine.

export function devLogOnly(vendor?:
  | 'stripe'
  | 'resend'
  | 'sightengine'
  | 'tineye'
  | 'anthropic'
  | 'inngest'
): boolean {
  if (process.env.DEV_MODE_LOG_ONLY === '1') return true
  if (!vendor) return false
  const key = `DEV_${vendor.toUpperCase()}_LOG_ONLY`
  return process.env[key] === '1'
}

export function devLog(vendor: string, msg: string, data?: unknown) {
  console.log(`[dev:${vendor}] ${msg}`, data ?? '')
}
