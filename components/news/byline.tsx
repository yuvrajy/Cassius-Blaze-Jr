import { formatDateline, readMinutes } from '@/components/news/date'

export function Byline({
  authorName,
  publishedAt,
  body,
}: {
  authorName: string
  publishedAt: string | null
  body: string
}) {
  const mins = readMinutes(body)
  return (
    <div className="border-y border-[var(--norm-rule)] py-4">
      <p className="norm-kicker flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium text-[var(--norm-ink)]">By {authorName}</span>
        {publishedAt ? (
          <>
            <span className="opacity-40">·</span>
            <time dateTime={publishedAt}>{formatDateline(publishedAt)}</time>
          </>
        ) : null}
        <span className="opacity-40">·</span>
        <span>{mins} min read</span>
      </p>
    </div>
  )
}
