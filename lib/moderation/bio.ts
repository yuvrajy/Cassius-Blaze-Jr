import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import type { BioFlag, BioVerdict } from '@/lib/contracts/moderation'
import { devLog, devLogOnly } from '@/lib/inngest/dev'

// Bio moderation. We ask Claude for a structured JSON verdict and map it
// onto the BioFlag union from the contract. Any third-party hiccup (parse
// error, API timeout, missing key) returns a soft-flag verdict so the admin
// queue gets the row instead of the workflow exploding.

const MODEL = 'claude-opus-4-7'

const SYSTEM = `You review bios submitted to a profile-publishing service. Detect any of:
- pii_leakage: doxxes a third party
- self_harm: self-harm or suicide ideation
- sexual_content: sexual content involving the subject
- hate: hate speech or slurs
- illegal: confessions to illegal activity, threats
- minor_subject: claims to be under 18
- impersonation: claims to be a public figure they probably aren't
- spam_promotional: primarily a marketing pitch, not biographical

Reply with JSON only, matching this exact schema:
{ "ok": boolean, "flags": string[], "summary": string, "suggested_rewrite": string }

"ok" is true when none of the flags above apply. "summary" is at most 200 chars and is shown to a human moderator. "suggested_rewrite" is optional; only include when "ok" is true and the bio could be tightened editorially.`

export async function moderateBio(bio: string): Promise<BioVerdict> {
  if (devLogOnly('anthropic')) {
    devLog('anthropic', 'moderateBio (dev-mode no-op)', { bioPreview: bio.slice(0, 80) })
    return {
      ok: true,
      flags: [],
      summary: 'dev-mode: bio moderation skipped',
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return softFlag('anthropic_unavailable', 'ANTHROPIC_API_KEY not set; admin must review.')
  }

  const client = new Anthropic({ apiKey })
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: SYSTEM,
      messages: [{ role: 'user', content: bio }],
    })
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
    return parseVerdict(text)
  } catch (err) {
    return softFlag(
      'anthropic_error',
      `Claude bio call failed: ${err instanceof Error ? err.message : 'unknown'}; admin must review.`,
    )
  }
}

const ALL_FLAGS = new Set<BioFlag>([
  'pii_leakage',
  'self_harm',
  'sexual_content',
  'hate',
  'illegal',
  'minor_subject',
  'impersonation',
  'spam_promotional',
])

function parseVerdict(raw: string): BioVerdict {
  // Strip ``` fences if Claude wrapped the JSON.
  const trimmed = raw.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
  try {
    const parsed = JSON.parse(trimmed) as Partial<BioVerdict> & {
      flags?: unknown
    }
    const flags = Array.isArray(parsed.flags)
      ? parsed.flags.filter((f): f is BioFlag => typeof f === 'string' && ALL_FLAGS.has(f as BioFlag))
      : []
    return {
      ok: typeof parsed.ok === 'boolean' ? parsed.ok : flags.length === 0,
      flags,
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 200) : '',
      suggested_rewrite:
        typeof parsed.suggested_rewrite === 'string' && parsed.suggested_rewrite.length > 0
          ? parsed.suggested_rewrite
          : undefined,
    }
  } catch {
    return softFlag('parse_error', `Claude returned non-JSON; admin must review. Raw: ${raw.slice(0, 100)}`)
  }
}

function softFlag(_reason: string, summary: string): BioVerdict {
  return { ok: false, flags: [], summary }
}
