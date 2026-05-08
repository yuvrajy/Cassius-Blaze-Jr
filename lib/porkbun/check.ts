import 'server-only'
import { checkPrice } from './client'

// Curated cheap-promo TLD list. Order doesn't matter — results are sorted
// by first-year price ascending. We deliberately avoid the gTLDs (.com,
// .net) that are never under $5 — the pitch for the upsell is "a custom
// domain for the price of a coffee."
export const CHEAP_TLDS = [
  'xyz',
  'top',
  'click',
  'lol',
  'bond',
  'sbs',
  'cyou',
  'uno',
  'cfd',
  'lat',
] as const

export type CheapTld = (typeof CHEAP_TLDS)[number]

const MAX_FIRST_YEAR_USD = 5

export interface DomainOption {
  domain: string
  tld: CheapTld
  first_year_usd: number
  renewal_usd: number | null
  is_premium: boolean
}

const VALID_NAME = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

export class InvalidNameError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidNameError'
  }
}

// Normalize a user-typed name into the SLD we'll combine with each TLD.
// Strips leading/trailing whitespace, lowercases, and rejects anything
// that wouldn't be a valid DNS label.
export function sanitizeName(input: string): string {
  const trimmed = (input ?? '').trim().toLowerCase()
  if (trimmed.length < 2 || trimmed.length > 40) {
    throw new InvalidNameError('name must be 2–40 characters')
  }
  if (!VALID_NAME.test(trimmed)) {
    throw new InvalidNameError(
      'name must be alphanumeric or hyphen, no leading/trailing hyphen',
    )
  }
  return trimmed
}

function parsePrice(s: string | undefined): number | null {
  if (!s) return null
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function isPremium(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1'
}

// Search every TLD in CHEAP_TLDS in parallel. Returns only domains that:
//   - returned a valid checkPrice payload (i.e. exist + are sellable)
//   - are NOT flagged premium (premium domains are not "cheap")
//   - have a first-year price strictly under $5
// Sorted by first-year price ascending so the front-end can render top-N.
export async function searchAvailable(name: string): Promise<DomainOption[]> {
  const sld = sanitizeName(name)
  const results = await Promise.all(
    CHEAP_TLDS.map(async (tld) => {
      const domain = `${sld}.${tld}`
      try {
        const p = await checkPrice(domain)
        if (!p) return null
        if (isPremium(p.premium)) return null
        const firstYear = parsePrice(p.price)
        if (firstYear == null || firstYear >= MAX_FIRST_YEAR_USD) return null
        const renewal =
          parsePrice(p.additional?.renewal?.price) ??
          parsePrice(p.regularPrice) ??
          null
        return {
          domain,
          tld,
          first_year_usd: firstYear,
          renewal_usd: renewal,
          is_premium: false,
        } satisfies DomainOption
      } catch {
        // Ignore per-TLD failures so a single flaky upstream doesn't kill
        // the whole search.
        return null
      }
    }),
  )
  return results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.first_year_usd - b.first_year_usd)
}
