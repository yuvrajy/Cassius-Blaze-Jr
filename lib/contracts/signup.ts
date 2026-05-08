import { z } from 'zod'

// Contract: signup form payload.
//
// Producer:  sub-agent 2 (signup form) — assembles this client-side and
//            POSTs to /api/signup.
// Consumer:  sub-agent 6 (workflows) — re-validates server-side before
//            persisting and kicking off the SIGNUP_PAID flow.
//
// Photos: the `storage_path` references an object already uploaded by the
// browser to Supabase Storage's `photos` bucket via the path scheme
// `{user_id}/{tmp_id}/{filename}`. The /api/signup handler is responsible
// for moving objects out of the tmp prefix once the profile_id is known.
//
// `tc_accepted` and `age_confirmed` are checkbox literals — z.literal(true)
// rejects unchecked / falsy values.

export const SocialPlatform = z.enum([
  'twitter',
  'instagram',
  'linkedin',
  'github',
  'tiktok',
  'youtube',
  'email',
  'website',
])

export const SocialLinkInput = z.object({
  platform: SocialPlatform,
  value: z.string().min(1).max(500),
})
export type SocialLinkInput = z.infer<typeof SocialLinkInput>

export const PhotoUploadInput = z.object({
  storage_path: z.string(),
  is_primary: z.boolean(),
  sort_order: z.number().int().min(0).max(4),
  consent_attested: z.literal(true),
})
export type PhotoUploadInput = z.infer<typeof PhotoUploadInput>

export const SignupInput = z.object({
  // Display name shown in the article and on the personal site.
  display_name: z.string().min(2).max(80),
  // Subdomain segment — must be URL-safe and globally unique. Length cap
  // matches the longest CNAME segment we want to issue.
  subdomain: z.string().regex(/^[a-z0-9-]{2,40}$/),
  // Optional one-line tagline used in the hero of the personal site.
  tagline: z.string().max(120).optional(),
  // Bio that drives the article body. Lower bound prevents thin content
  // from generating an SEO-empty page; upper bound matches Claude prompt
  // budget.
  bio: z.string().min(50).max(7000),
  social_links: z.array(SocialLinkInput).max(6),
  photos: z.array(PhotoUploadInput).min(1).max(5),
  // ISO date string (YYYY-MM-DD). Server checks 18+.
  dob: z.string(),
  // Version string of the T&Cs the user accepted (e.g. "2026-05-01").
  tc_version: z.string(),
  tc_accepted: z.literal(true),
  age_confirmed: z.literal(true),
})
export type SignupInput = z.infer<typeof SignupInput>
