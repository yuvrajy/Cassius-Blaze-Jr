// Shared types and constants for the signup wizard.

export const TC_VERSION = '2026-05-08'

// localStorage key for the draft. We key by session_id so multiple drafts
// could in theory coexist, but in practice we only ever look at the most
// recent one (`getknown.signup.draft.current`).
export const DRAFT_INDEX_KEY = 'getknown.signup.draft.current'
export const DRAFT_PREFIX = 'getknown.signup.draft.'

export const STEP_LABELS = [
  'Terms & age',
  'Your name',
  'Your address',
  'Your bio',
  'Tagline',
  'Photos',
  'Links',
  'Review',
] as const

export const TOTAL_STEPS = STEP_LABELS.length

export const SUBDOMAIN_REGEX = /^[a-z0-9-]{2,40}$/

export type WordCount = { words: number; chars: number }

export function countWords(text: string): WordCount {
  const trimmed = text.trim()
  return {
    words: trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length,
    chars: text.length,
  }
}

export function suggestSubdomain(displayName: string): string {
  return displayName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40)
}

export function calcAge(dob: string): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
  return age
}
