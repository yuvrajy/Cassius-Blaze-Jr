import 'server-only'
import {
  PorkbunApiError,
  checkPrice,
  createDnsRecord,
  createDomain,
  listDns,
} from './client'
import {
  addRedirectDomain,
  getDomain as getVercelDomain,
  removeDomain as removeVercelDomain,
  waitForVerification,
} from '@/lib/vercel/domains'

// Full register flow used by both the Inngest handler and the manual
// admin retry endpoint. The flow is split into individually idempotent
// helpers so each Inngest step can retry without duplicating work.

// Vercel's edge points apex A records here. CNAME `www` goes to
// cname.vercel-dns.com. (Both are documented in Vercel's domain setup
// docs and stable; if Vercel ever changes them, update here.)
export const VERCEL_APEX_A = '76.76.21.21'
export const VERCEL_CNAME_TARGET = 'cname.vercel-dns.com'

export interface RegisterArgs {
  /** Apex domain the customer chose (e.g. "sarahchen.xyz"). */
  domain: string
  /** Personal-site host the bespoke domain should redirect to
   *  (e.g. "sarahchen.iam.bio"). */
  redirectTo: string
}

export interface RegisterResult {
  domain: string
  redirectTo: string
  verified: boolean
}

// Ensure the domain is registered to us. If checkPrice reports the domain
// is not available, we still attempt /domain/create and rely on Porkbun's
// error if we don't already own it. Idempotent: an "already owned" failure
// from Porkbun is treated as success (we have no clean way to query
// ownership, so we register and tolerate the dup error).
export async function ensureDomainRegistered(domain: string): Promise<void> {
  // Best-effort availability probe — purely informational.
  try {
    await checkPrice(domain)
  } catch {
    /* no-op */
  }
  try {
    await createDomain({ domain, years: 1, autorenew: '1', whoisprivacy: '1' })
  } catch (e) {
    if (e instanceof PorkbunApiError) {
      const m = e.message.toLowerCase()
      if (
        m.includes('already') ||
        m.includes('not available') ||
        m.includes('owned')
      ) {
        return
      }
    }
    throw e
  }
}

// Add the apex A record + www CNAME pointing at Vercel. Idempotent: we
// list existing records first and skip any with matching (type, host,
// content) tuples.
export async function ensureVercelDns(domain: string): Promise<void> {
  const records = await listDns(domain)
  const has = (type: string, host: string, content: string) =>
    records.some(
      (r) =>
        r.type === type &&
        (r.name === `${host}.${domain}` || r.name === host || (host === '' && r.name === domain)) &&
        r.content === content,
    )
  if (!has('A', '', VERCEL_APEX_A)) {
    await createDnsRecord({ domain, name: '', type: 'A', content: VERCEL_APEX_A })
  }
  if (!has('CNAME', 'www', VERCEL_CNAME_TARGET)) {
    await createDnsRecord({
      domain,
      name: 'www',
      type: 'CNAME',
      content: VERCEL_CNAME_TARGET,
    })
  }
}

// Attach the domain to Vercel as a redirect-type domain pointing at the
// customer's iam.bio host. Idempotent: if the domain is already attached
// to the project (with matching redirect), we leave it alone; if attached
// with a stale redirect, we replace it.
export async function ensureVercelRedirectAttached(
  args: RegisterArgs,
): Promise<void> {
  const existing = await getVercelDomain(args.domain)
  if (
    existing &&
    existing.redirect === args.redirectTo &&
    existing.redirectStatusCode === 301
  ) {
    return
  }
  if (existing) {
    // Stale config — drop and re-add so we end up with the right redirect.
    await removeVercelDomain(args.domain)
  }
  await addRedirectDomain({
    domain: args.domain,
    redirectTo: args.redirectTo,
    statusCode: 301,
  })
}

export async function verifyOrTimeout(domain: string): Promise<boolean> {
  return waitForVerification(domain)
}

// One-shot helper for the manual admin retry endpoint. The Inngest handler
// runs the same logic but as separate `step.run` calls so each is retried
// independently — don't call this from there.
export async function registerBespokeDomain(
  args: RegisterArgs,
): Promise<RegisterResult> {
  await ensureDomainRegistered(args.domain)
  await ensureVercelDns(args.domain)
  await ensureVercelRedirectAttached(args)
  const verified = await verifyOrTimeout(args.domain)
  return { domain: args.domain, redirectTo: args.redirectTo, verified }
}
