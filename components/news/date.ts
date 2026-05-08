// Date helpers used across the news site. Two formats:
// - formatDateline → "May 8, 2026" (long, used in bylines and the masthead)
// - timeAgo        → "3 hours ago" / "2 days ago" (used in card lists)

const LONG = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

export function formatDateline(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return LONG.format(d)
}

const UNITS: [string, number][] = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
]

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  if (seconds < 60) return 'just now'
  for (const [name, s] of UNITS) {
    if (seconds >= s) {
      const n = Math.floor(seconds / s)
      return `${n} ${name}${n === 1 ? '' : 's'} ago`
    }
  }
  return 'just now'
}

export function readMinutes(text: string): number {
  if (!text) return 1
  const words = text.trim().split(/\s+/).length
  return Math.max(1, Math.ceil(words / 200))
}
