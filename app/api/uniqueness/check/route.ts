import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  NameCollisionVerdict,
  NameCollisionEvidence,
  NameCollisionSeverity,
} from '@/lib/contracts/moderation'

export const runtime = 'nodejs'

type CseItem = {
  title?: string
  link?: string
  snippet?: string
  displayLink?: string
}

function normalizeName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

function devStubVerdict(name: string): NameCollisionVerdict {
  return {
    name_normalized: normalizeName(name),
    severity: 0,
    evidence: { results: [] },
    summary: '[stub] No API keys configured in dev — assuming clear.',
  }
}

async function fetchGoogleEvidence(name: string): Promise<NameCollisionEvidence> {
  const key = process.env.GOOGLE_API_KEY
  const cx = process.env.GOOGLE_CSE_ID
  if (!key || !cx) return { results: [] }

  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', key)
  url.searchParams.set('cx', cx)
  url.searchParams.set('q', `"${name}"`)
  url.searchParams.set('num', '10')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return { results: [] }
  const json = (await res.json()) as { items?: CseItem[] }
  const items = json.items ?? []

  return {
    results: items.slice(0, 10).map(it => ({
      title: it.title ?? '',
      url: it.link ?? '',
      snippet: it.snippet ?? '',
      domain: it.displayLink ?? '',
    })),
  }
}

async function classifyWithClaude(
  name: string,
  evidence: NameCollisionEvidence,
): Promise<{
  severity: NameCollisionSeverity
  summary: string
  suggested_variations: string[]
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      severity: 0,
      summary: 'No Claude API key configured — defaulting to clear.',
      suggested_variations: [],
    }
  }

  const client = new Anthropic({ apiKey })

  const prompt = `You are evaluating whether a person's chosen public-facing display name will collide with existing notable people on the open web. Their name is: "${name}"

Top 10 Google results for an exact-phrase search of that name:
${evidence.results
  .map(
    (r, i) =>
      `${i + 1}. ${r.title} — ${r.domain}\n   ${r.url}\n   ${r.snippet}`,
  )
  .join('\n\n') || '(no results returned)'}

Rate the collision severity on a 0–5 scale:
0 — no notable existing presence; safe.
1 — niche LinkedIn / personal sites; safe.
2 — minor public footprint; safe but worth flagging.
3 — meaningful collision (small business, podcast); manual decision.
4 — substantial public-figure overlap; usually reject.
5 — major public figure or celebrity by exact name; reject.

If severity ≥ 3, propose 3 distinct variations of the name (e.g. add a middle initial, append a city, swap to a fuller form) that would reduce collision. Keep variations natural — they will be shown to the user as suggested fixes.

Respond with ONLY a JSON object, no prose, matching exactly:
{"severity": <0-5>, "summary": "<one sentence>", "suggested_variations": ["...","...","..."]}`

  const resp = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()

  // Tolerate fenced code blocks Claude sometimes wraps JSON in.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')

  const parsed = JSON.parse(cleaned) as {
    severity: number
    summary: string
    suggested_variations?: string[]
  }
  const sev = Math.max(0, Math.min(5, Math.round(parsed.severity))) as NameCollisionSeverity

  return {
    severity: sev,
    summary: parsed.summary || 'No summary returned.',
    suggested_variations: Array.isArray(parsed.suggested_variations)
      ? parsed.suggested_variations.slice(0, 5)
      : [],
  }
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name =
    body && typeof body === 'object' && 'name' in body && typeof (body as { name: unknown }).name === 'string'
      ? ((body as { name: string }).name)
      : ''

  if (!name || name.trim().length < 2 || name.trim().length > 80) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
  }

  const normalized = normalizeName(name)

  // In dev with no keys at all, return a stub immediately so the form is
  // testable without any external services configured.
  const hasGoogle = !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID)
  const hasClaude = !!process.env.ANTHROPIC_API_KEY
  if (!hasGoogle && !hasClaude) {
    const stub = devStubVerdict(name)
    return NextResponse.json({
      ...stub,
      stubbed: true,
      suggested_variations: [],
    })
  }

  // Cache lookup. We don't fail the request if Supabase is down — we just
  // miss the cache and re-run the check.
  let supabase: ReturnType<typeof createAdminClient> | null = null
  try {
    supabase = createAdminClient()
  } catch {
    supabase = null
  }

  if (supabase) {
    const { data: cached } = await supabase
      .from('name_collision_checks')
      .select('name_normalized, severity, evidence')
      .eq('name_normalized', normalized)
      .maybeSingle()

    if (cached) {
      const ev = (cached.evidence ?? { results: [] }) as unknown as
        NameCollisionEvidence & { suggested_variations?: string[]; summary?: string }
      const verdict: NameCollisionVerdict & { suggested_variations: string[] } = {
        name_normalized: cached.name_normalized,
        severity: cached.severity as NameCollisionSeverity,
        evidence: { results: ev.results ?? [], wikidata: ev.wikidata },
        summary: ev.summary ?? '',
        suggested_variations: ev.suggested_variations ?? [],
      }
      return NextResponse.json(verdict)
    }
  }

  const evidence = await fetchGoogleEvidence(name)
  const { severity, summary, suggested_variations } = await classifyWithClaude(
    name,
    evidence,
  )

  const verdict: NameCollisionVerdict & { suggested_variations: string[] } = {
    name_normalized: normalized,
    severity,
    evidence,
    summary,
    suggested_variations,
  }

  if (supabase) {
    // The contract NameCollisionEvidence does not carry summary or
    // suggested_variations, but the DB column is JSONB so we can extend it.
    // Agent 5/6 read evidence as JSON; storing the extras here keeps cache
    // hits cheap (no extra Claude call to re-derive variations).
    await supabase.from('name_collision_checks').upsert(
      {
        name_normalized: normalized,
        severity,
        evidence: {
          ...evidence,
          summary,
          suggested_variations,
        },
      },
      { onConflict: 'name_normalized' },
    )
  }

  return NextResponse.json(verdict)
}
