import 'server-only'
import type { PhotoFlag, PhotoVerdict } from '@/lib/contracts/moderation'
import { devLog, devLogOnly } from '@/lib/inngest/dev'

// Photo moderation. Two parallel checks per photo:
//   - Sightengine: nudity, gore, weapons, minor detection
//   - TinEye MatchEngine: reverse image search for stolen / celebrity hits
// Verdicts are merged into a single PhotoVerdict.
//
// On any third-party failure (5xx, rate-limit, timeout) we return a soft-flag
// verdict (`ok: false`, no concrete flag) with a moderation_unavailable note
// in the scores blob so admin manually reviews instead of auto-rejecting.

const TIMEOUT_MS = 15_000
const NSFW_THRESHOLD = 0.6

interface CheckArgs {
  photoId: string
  url: string
}

interface SightengineResult {
  scores: Record<string, number>
  flags: PhotoFlag[]
  ok: boolean
  unavailable?: boolean
}

interface TinEyeResult {
  flags: PhotoFlag[]
  ok: boolean
  scores: Record<string, number>
  reverse_image_hit?: PhotoVerdict['reverse_image_hit']
  unavailable?: boolean
}

export async function moderatePhoto(args: CheckArgs): Promise<PhotoVerdict> {
  const [se, ti] = await Promise.all([
    runSightengine(args).catch((err) => sightengineUnavailable(err)),
    runTinEye(args).catch((err) => tineyeUnavailable(err)),
  ])

  const flags = Array.from(new Set([...se.flags, ...ti.flags]))
  const scores: Record<string, number> = { ...se.scores, ...ti.scores }
  if (se.unavailable) scores.sightengine_unavailable = 1
  if (ti.unavailable) scores.tineye_unavailable = 1

  return {
    photo_id: args.photoId,
    // Soft-flag (ok=false) when either provider was unavailable so admin
    // reviews; otherwise ok iff both providers said ok.
    ok: !se.unavailable && !ti.unavailable && se.ok && ti.ok,
    flags,
    scores,
    reverse_image_hit: ti.reverse_image_hit,
  }
}

// ---------------------------------------------------------------------
// Sightengine
// ---------------------------------------------------------------------
async function runSightengine(args: CheckArgs): Promise<SightengineResult> {
  if (devLogOnly('sightengine')) {
    devLog('sightengine', 'check (dev-mode no-op)', args)
    return { scores: { dev_mode: 1 }, flags: [], ok: true }
  }
  const user = process.env.SIGHTENGINE_USER
  const secret = process.env.SIGHTENGINE_SECRET
  if (!user || !secret) {
    return sightengineUnavailable(new Error('credentials missing'))
  }

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const params = new URLSearchParams({
      url: args.url,
      models: 'nudity-2.0,offensive,gore,minor',
      api_user: user,
      api_secret: secret,
    })
    const r = await fetch(`https://api.sightengine.com/1.0/check.json?${params}`, {
      signal: ctrl.signal,
    })
    if (!r.ok) throw new Error(`sightengine ${r.status}`)
    const json = (await r.json()) as Record<string, unknown>
    return interpretSightengine(json)
  } finally {
    clearTimeout(timeout)
  }
}

function interpretSightengine(json: Record<string, unknown>): SightengineResult {
  const flags: PhotoFlag[] = []
  const scores: Record<string, number> = {}

  const nudity = json.nudity as Record<string, number> | undefined
  if (nudity) {
    const explicit = Math.max(
      nudity.sexual_activity ?? 0,
      nudity.sexual_display ?? 0,
      nudity.erotica ?? 0,
    )
    scores.nudity = explicit
    if (explicit > NSFW_THRESHOLD) flags.push('nudity')
  }
  const gore = (json.gore as Record<string, number> | undefined)?.prob
  if (typeof gore === 'number') {
    scores.gore = gore
    if (gore > NSFW_THRESHOLD) flags.push('gore')
  }
  const offensive = (json.offensive as Record<string, number> | undefined)?.prob
  if (typeof offensive === 'number') {
    scores.offensive = offensive
    if (offensive > NSFW_THRESHOLD) flags.push('weapons')
  }
  const minor = (json.minor as Record<string, number> | undefined)?.prob
  if (typeof minor === 'number') {
    scores.minor = minor
    if (minor > NSFW_THRESHOLD) flags.push('minor_subject')
  }
  return { flags, scores, ok: flags.length === 0 }
}

function sightengineUnavailable(err: unknown): SightengineResult {
  return {
    flags: [],
    scores: { sightengine_error: 1 },
    ok: false,
    unavailable: true,
    ...(err instanceof Error ? { error: err.message } : {}),
  } as SightengineResult
}

// ---------------------------------------------------------------------
// TinEye MatchEngine
// ---------------------------------------------------------------------
const CELEB_DOMAINS = [
  'gettyimages.com',
  'shutterstock.com',
  'apnews.com',
  'reuters.com',
  'wikipedia.org',
  'wikimedia.org',
  'imdb.com',
  'eonline.com',
  'tmz.com',
  'people.com',
]

async function runTinEye(args: CheckArgs): Promise<TinEyeResult> {
  if (devLogOnly('tineye')) {
    devLog('tineye', 'search (dev-mode no-op)', args)
    return { flags: [], ok: true, scores: { dev_mode: 1 } }
  }
  const pub = process.env.TINEYE_PUBLIC_KEY
  const priv = process.env.TINEYE_PRIVATE_KEY
  if (!pub || !priv) {
    return tineyeUnavailable(new Error('credentials missing'))
  }

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const form = new FormData()
    form.append('image_url', args.url)
    const r = await fetch('https://matchengine.tineye.com/rest/search/', {
      method: 'POST',
      body: form,
      headers: {
        Authorization: `Basic ${Buffer.from(`${pub}:${priv}`).toString('base64')}`,
      },
      signal: ctrl.signal,
    })
    if (!r.ok) throw new Error(`tineye ${r.status}`)
    const json = (await r.json()) as {
      results?: { matches?: Array<{ score?: number; backlinks?: Array<{ url?: string }> }> }
    }
    return interpretTinEye(json)
  } finally {
    clearTimeout(timeout)
  }
}

function interpretTinEye(json: {
  results?: { matches?: Array<{ score?: number; backlinks?: Array<{ url?: string }> }> }
}): TinEyeResult {
  const matches = json.results?.matches ?? []
  const flags: PhotoFlag[] = []
  let topHit: PhotoVerdict['reverse_image_hit'] | undefined
  let bestScore = 0

  for (const m of matches) {
    const score = m.score ?? 0
    const url = m.backlinks?.[0]?.url
    if (!url) continue
    let domain: string
    try {
      domain = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      continue
    }
    if (score > bestScore) {
      bestScore = score
      topHit = { url, domain, score }
    }
    if (CELEB_DOMAINS.some((d) => domain.endsWith(d))) flags.push('celebrity_match')
    else flags.push('duplicate_elsewhere')
  }

  return {
    flags: Array.from(new Set(flags)),
    ok: flags.length === 0,
    scores: { tineye_top_score: bestScore },
    reverse_image_hit: topHit,
  }
}

function tineyeUnavailable(err: unknown): TinEyeResult {
  return {
    flags: [],
    scores: { tineye_error: 1 },
    ok: false,
    unavailable: true,
    ...(err instanceof Error ? { error: err.message } : {}),
  } as TinEyeResult
}
