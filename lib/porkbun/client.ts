import 'server-only'
import { devLog, devLogOnly } from '@/lib/inngest/dev'

// Thin Porkbun JSON API wrapper. The API authenticates via two header
// fields on every request body (apikey + secretapikey); there is no token
// header. Endpoints we use:
//
//   POST /api/json/v3/ping                       sanity / dev-mode probe
//   POST /api/json/v3/domain/checkPrice/{domain} availability + pricing
//   POST /api/json/v3/domain/create              register a domain
//   POST /api/json/v3/dns/retrieve/{domain}      list DNS records
//   POST /api/json/v3/dns/create/{domain}        add a DNS record
//
// All Porkbun endpoints accept POST with JSON body containing the auth pair
// plus per-call params. Responses are JSON with a `status: "SUCCESS" | "ERROR"`
// discriminator.
//
// In dev (DEV_MODE_LOG_ONLY=1 or DEV_PORKBUN_LOG_ONLY=1) we never hit the
// real API — calls are logged and return canned shapes so the lifecycle
// handlers can be exercised end-to-end without burning real domains.

const BASE_URL = 'https://api.porkbun.com/api/json/v3'
const DEFAULT_TIMEOUT_MS = 8000

export interface PorkbunSuccess<T> {
  status: 'SUCCESS'
  data: T
}

export interface PorkbunError {
  status: 'ERROR'
  message: string
}

export type PorkbunResult<T> = PorkbunSuccess<T> | PorkbunError

export class PorkbunApiError extends Error {
  constructor(
    public readonly endpoint: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`porkbun ${endpoint}: ${message}`)
    this.name = 'PorkbunApiError'
  }
}

interface AuthEnvelope {
  apikey: string
  secretapikey: string
}

function authEnvelope(): AuthEnvelope {
  const apikey = process.env.PORKBUN_API_KEY
  const secretapikey = process.env.PORKBUN_SECRET_KEY
  if (!apikey || !secretapikey) {
    throw new PorkbunApiError('auth', 'PORKBUN_API_KEY / PORKBUN_SECRET_KEY not set')
  }
  return { apikey, secretapikey }
}

async function porkbunPost<T>(
  endpoint: string,
  body: Record<string, unknown> = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`
  const payload = { ...authEnvelope(), ...body }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    let json: unknown
    try {
      json = await res.json()
    } catch (e) {
      throw new PorkbunApiError(endpoint, `non-json response (HTTP ${res.status})`, e)
    }
    if (!res.ok) {
      const msg =
        (json as { message?: string } | null)?.message ?? `HTTP ${res.status}`
      throw new PorkbunApiError(endpoint, msg)
    }
    const result = json as PorkbunResult<T>
    if (result.status === 'ERROR') {
      throw new PorkbunApiError(endpoint, result.message)
    }
    return result.data
  } catch (e) {
    if (e instanceof PorkbunApiError) throw e
    if ((e as { name?: string })?.name === 'AbortError') {
      throw new PorkbunApiError(endpoint, `timeout after ${timeoutMs}ms`)
    }
    throw new PorkbunApiError(endpoint, (e as Error).message ?? 'unknown', e)
  } finally {
    clearTimeout(timer)
  }
}

// =====================================================================
// Typed call sites
// =====================================================================

export interface CheckPriceData {
  /** Porkbun returns these as strings, e.g. "9.13". */
  price: string
  regularPrice?: string
  firstYearPromo?: 'true' | 'false' | boolean
  premium?: 'true' | 'false' | boolean
  /** Porkbun's "additional" sometimes contains a renewal price block. */
  additional?: {
    renewal?: { price?: string }
    transfer?: { price?: string }
  }
}

export async function ping(): Promise<{ yourIp: string }> {
  if (devLogOnly('inngest') || devLogOnly()) {
    devLog('porkbun', 'ping (dev-log-only)')
    return { yourIp: '127.0.0.1' }
  }
  return porkbunPost<{ yourIp: string }>('/ping')
}

export async function checkPrice(domain: string): Promise<CheckPriceData | null> {
  if (devLogOnly('inngest') || devLogOnly()) {
    devLog('porkbun', 'checkPrice (dev-log-only)', { domain })
    return {
      price: '2.99',
      regularPrice: '12.99',
      firstYearPromo: 'true',
      premium: 'false',
      additional: { renewal: { price: '12.99' } },
    }
  }
  try {
    return await porkbunPost<CheckPriceData>(`/domain/checkPrice/${domain}`)
  } catch (e) {
    // Unavailable / unsupported TLDs come back as ERROR. Treat as "not
    // available" rather than propagating — the search route is best-effort.
    if (e instanceof PorkbunApiError) return null
    throw e
  }
}

export interface CreateDomainArgs {
  domain: string
  /** 1 = one year. Porkbun supports 1-10. */
  years?: number
  /** Default "yes" — turn on auto-renew so we don't lose the domain. */
  autorenew?: '0' | '1'
  /** Default "1" — Porkbun enables WHOIS privacy when the TLD supports it. */
  whoisprivacy?: '0' | '1'
}

export async function createDomain(args: CreateDomainArgs): Promise<void> {
  const body = {
    domain: args.domain,
    years: args.years ?? 1,
    autorenew: args.autorenew ?? '1',
    whoisprivacy: args.whoisprivacy ?? '1',
  }
  if (devLogOnly('inngest') || devLogOnly()) {
    devLog('porkbun', 'createDomain (dev-log-only)', body)
    return
  }
  await porkbunPost('/domain/create', body)
}

export interface DnsRecord {
  id: string
  name: string
  type: string
  content: string
  ttl: string
  prio?: string
  notes?: string
}

export async function listDns(domain: string): Promise<DnsRecord[]> {
  if (devLogOnly('inngest') || devLogOnly()) {
    devLog('porkbun', 'listDns (dev-log-only)', { domain })
    return []
  }
  const data = await porkbunPost<{ records?: DnsRecord[] }>(
    `/dns/retrieve/${domain}`,
  )
  return data.records ?? []
}

export interface CreateDnsArgs {
  domain: string
  /** Subdomain, '' for apex. */
  name?: string
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'ALIAS'
  content: string
  ttl?: string
  prio?: string
}

export async function createDnsRecord(args: CreateDnsArgs): Promise<void> {
  const body: Record<string, unknown> = {
    name: args.name ?? '',
    type: args.type,
    content: args.content,
    ttl: args.ttl ?? '600',
  }
  if (args.prio) body.prio = args.prio
  if (devLogOnly('inngest') || devLogOnly()) {
    devLog('porkbun', 'createDnsRecord (dev-log-only)', { domain: args.domain, ...body })
    return
  }
  await porkbunPost(`/dns/create/${args.domain}`, body)
}
