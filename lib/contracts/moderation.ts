// Contract: moderation result shapes.
//
// Producer:  sub-agent 6 (workflows) — runs Claude bio review, Sightengine
//            and TinEye photo checks, and the Google CSE name-collision
//            lookup. Returns these shapes.
// Consumer:  sub-agent 5 (admin queue) renders these to the moderator;
//            sub-agent 2 (signup) shows live preview verdicts during the
//            form step.

// ---------------------------------------------------------------------
// Bio verdict
// ---------------------------------------------------------------------
export type BioFlag =
  | 'pii_leakage'        // exposes other people's contact info / addresses
  | 'self_harm'          // self-harm or suicide ideation
  | 'sexual_content'     // sexual content involving the subject
  | 'hate'               // hate speech / slurs
  | 'illegal'            // confessions to illegal activity, threats
  | 'minor_subject'      // claims to be under 18
  | 'impersonation'      // claims to be a public figure they aren't
  | 'spam_promotional'   // primarily a marketing pitch, not biographical

export interface BioVerdict {
  ok: boolean
  flags: BioFlag[]
  // Plain-language summary the moderator can read at a glance.
  summary: string
  // Optional cleaner version of the bio Claude can suggest. Only present
  // when ok=true and the moderator opts to auto-rewrite.
  suggested_rewrite?: string
}

// ---------------------------------------------------------------------
// Photo verdict
// ---------------------------------------------------------------------
export type PhotoFlag =
  | 'nudity'
  | 'gore'
  | 'weapons'
  | 'minor_subject'
  | 'celebrity_match'    // TinEye / face-search returned a public-figure hit
  | 'duplicate_elsewhere'// reverse-image hit on the open web

export interface PhotoVerdict {
  // Photo row this verdict is about.
  photo_id: string
  ok: boolean
  flags: PhotoFlag[]
  // Sightengine / TinEye raw scores so the moderator can second-guess.
  scores: Record<string, number>
  // Top reverse-image hit, when relevant.
  reverse_image_hit?: { url: string; domain: string; score: number }
}

// ---------------------------------------------------------------------
// Name collision verdict
// ---------------------------------------------------------------------
// Severity scale (mirrors name_collision_checks.severity 0–5):
//   0 — no notable existing presence; safe to publish.
//   1 — niche LinkedIn / personal sites; safe.
//   2 — minor public footprint; safe but flag for review.
//   3 — meaningful collision (small business, podcast); manual decision.
//   4 — substantial public figure overlap; usually reject.
//   5 — major public figure or celebrity by exact name; reject.
export type NameCollisionSeverity = 0 | 1 | 2 | 3 | 4 | 5

export interface NameCollisionEvidence {
  // Top Google CSE results, normalized.
  results: Array<{
    title: string
    url: string
    snippet: string
    domain: string
  }>
  // Wikipedia / Wikidata QIDs we matched against.
  wikidata?: Array<{ qid: string; label: string; description: string }>
}

export interface NameCollisionVerdict {
  name_normalized: string
  severity: NameCollisionSeverity
  evidence: NameCollisionEvidence
  // The moderator-facing one-liner that explains the severity.
  summary: string
}

// ---------------------------------------------------------------------
// Aggregated moderation result for a profile (what the admin queue shows)
// ---------------------------------------------------------------------
export interface ProfileModerationResult {
  profile_id: string
  bio: BioVerdict
  photos: PhotoVerdict[]
  name_collision: NameCollisionVerdict
  // Auto-decision the system would make if the moderator did nothing.
  auto_decision: 'approve' | 'reject' | 'manual_review'
}
