import 'server-only'
import { devLog, devLogOnly } from '@/lib/inngest/dev'

// Thin Vercel REST API wrapper, scoped to project-domain operations.
// Bespoke domains (sarahchen.xyz) are attached to the same Vercel project
// as the rest of the app and configured as REDIRECT-type domains pointing
// to the customer's subdomain on iam.bio. This keeps middleware clean
// (bespoke hosts never reach our Next.js code at all — Vercel handles the
// 301 at the edge).
//
// API reference:
//   POST   /v10/projects/{idOrName}/domains
//   GET    /v9/projects/{idOrName}/domains?domain={name}
//   GET    /v9/projects/{idOrName}/domains/{domain}
//   GET    /v6/domains/{domain}/config       — verification status
//   DELETE /v9/projects/{idOrName}/domains/{domain}
//
// Auth: Bearer ${VERCEL_API_TOKEN}.
// Team-scoped projects need ?teamId={team_id}; we keep it simple and let
// the token be project- or user-scoped (which is the common Vercel pattern
// for app-owned automation tokens).

const API = 'https://api.vercel.com'
const DEFAULT_TIMEOUT_MS = 10_000

export class VercelApiError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly status: number,
    message: string,
  ) {
    super(`vercel ${endpoint}: ${message} (HTTP ${status})`)
    this.name = 'VercelApiError'
  }
}

function projectId(): string {
  const id = process.env.VERCEL_PROJECT_ID
  if (!id) throw new VercelApiError('config', 0, 'VERCEL_PROJECT_ID not set')
  return id
}

function teamQuery(): string {
  const team = process.env.VERCEL_TEAM_ID
  return team ? `?teamId=${encodeURIComponent(team)}` : ''
}

async function vercelFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const token = process.env.VERCEL_API_TOKEN
  if (!token) throw new VercelApiError('auth', 0, 'VERCEL_API_TOKEN not set')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    return await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export interface VercelDomainConfig {
  name: string
  /** When set, the domain is REDIRECT-type and Vercel 301s to this host. */
  redirect?: string | null
  redirectStatusCode?: number | null
  verified: boolean
  verification?: Array<{ type: string; domain: string; value: string; reason: string }>
}

export interface AddRedirectDomainArgs {
  domain: string
  redirectTo: string
  statusCode?: 301 | 302 | 307 | 308
}

// Add a domain to the project as a redirect-type domain. Idempotent:
// if the domain is already attached, returns its current configuration.
export async function addRedirectDomain(
  args: AddRedirectDomainArgs,
): Promise<VercelDomainConfig> {
  const body = {
    name: args.domain,
    redirect: args.redirectTo,
    redirectStatusCode: args.statusCode ?? 301,
  }
  if (devLogOnly('inngest') || devLogOnly()) {
    devLog('vercel', 'addRedirectDomain (dev-log-only)', body)
    return {
      name: args.domain,
      redirect: args.redirectTo,
      redirectStatusCode: body.redirectStatusCode,
      verified: true,
    }
  }
  const path = `/v10/projects/${projectId()}/domains${teamQuery()}`
  const res = await vercelFetch(path, { method: 'POST', body: JSON.stringify(body) })
  const json = (await readJson(res)) as
    | (VercelDomainConfig & { error?: { code?: string; message?: string } })
    | null
  if (res.ok && json && 'name' in json) return json
  // Idempotency: 409 + code "domain_already_in_use[_by_project]" means we
  // already own it on this project. Re-read configuration.
  const code = json?.error?.code
  if (
    res.status === 409 &&
    (code === 'domain_already_in_use_by_project' ||
      code === 'domain_already_exists' ||
      code === 'domain_already_in_use')
  ) {
    const existing = await getDomain(args.domain)
    if (existing) return existing
  }
  throw new VercelApiError(
    'addRedirectDomain',
    res.status,
    json?.error?.message ?? 'unexpected response',
  )
}

export async function getDomain(domain: string): Promise<VercelDomainConfig | null> {
  if (devLogOnly('inngest') || devLogOnly()) {
    devLog('vercel', 'getDomain (dev-log-only)', { domain })
    return { name: domain, verified: true, redirect: null, redirectStatusCode: null }
  }
  const path = `/v9/projects/${projectId()}/domains/${encodeURIComponent(domain)}${teamQuery()}`
  const res = await vercelFetch(path, { method: 'GET' })
  if (res.status === 404) return null
  const json = await readJson(res)
  if (!res.ok) {
    throw new VercelApiError(
      'getDomain',
      res.status,
      (json as { error?: { message?: string } } | null)?.error?.message ?? 'unexpected',
    )
  }
  return json as VercelDomainConfig
}

// Vercel's verification poller. Returns true if DNS is correctly pointed
// at us and Vercel has confirmed it. False otherwise — caller decides
// whether to keep polling.
export async function isVerified(domain: string): Promise<boolean> {
  const config = await getDomain(domain)
  return Boolean(config?.verified)
}

// Wait until verified or timeout. Polls every 10s up to maxWaitMs.
export async function waitForVerification(
  domain: string,
  maxWaitMs = 5 * 60 * 1000,
): Promise<boolean> {
  if (devLogOnly('inngest') || devLogOnly()) return true
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    if (await isVerified(domain)) return true
    await new Promise((r) => setTimeout(r, 10_000))
  }
  return false
}

// Remove a domain from the project. Used during takedown finalization
// (release the bespoke domain) and GDPR deletion.
export async function removeDomain(domain: string): Promise<void> {
  if (devLogOnly('inngest') || devLogOnly()) {
    devLog('vercel', 'removeDomain (dev-log-only)', { domain })
    return
  }
  const path = `/v9/projects/${projectId()}/domains/${encodeURIComponent(domain)}${teamQuery()}`
  const res = await vercelFetch(path, { method: 'DELETE' })
  // 404 on a domain we didn't have attached is a no-op success.
  if (res.status === 404) return
  if (!res.ok) {
    const json = await readJson(res)
    throw new VercelApiError(
      'removeDomain',
      res.status,
      (json as { error?: { message?: string } } | null)?.error?.message ?? 'unexpected',
    )
  }
}
