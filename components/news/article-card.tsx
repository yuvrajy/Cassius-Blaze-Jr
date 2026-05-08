import Link from 'next/link'
import type { ArticleWithProfile } from '@/lib/contracts/profile'
import { primaryPhotoUrl } from '@/lib/contracts/profile'
import { formatDateline, timeAgo } from '@/components/news/date'
import { Photo } from '@/components/news/photo'

type Variant = 'hero' | 'lead' | 'grid' | 'small'

export function ArticleCard({
  article,
  variant = 'grid',
}: {
  article: ArticleWithProfile
  variant?: Variant
}) {
  const href = `/article/${article.slug}`
  const photo = primaryPhotoUrl(article.profile)
  const published = article.published_at ?? article.created_at

  if (variant === 'hero') {
    return (
      <article className="grid gap-8 md:grid-cols-12 md:gap-10">
        <Link
          href={href}
          className="block md:col-span-7"
          aria-label={article.headline}
        >
          <Photo
            src={photo}
            alt={article.profile.display_name}
            className="aspect-[16/10]"
            sizes="(min-width: 768px) 60vw, 100vw"
            priority
          />
        </Link>
        <div className="md:col-span-5 md:pt-2">
          <p className="norm-kicker mb-3">Profile</p>
          <h2 className="norm-headline-xl text-[2.25rem] sm:text-[2.75rem] md:text-[3rem]">
            <Link href={href} className="hover:underline">
              {article.headline}
            </Link>
          </h2>
          {article.subheadline ? (
            <p className="mt-4 font-serif text-lg leading-snug text-[var(--norm-muted)]">
              {article.subheadline}
            </p>
          ) : null}
          <p className="norm-kicker mt-5">
            <span>{article.author_name}</span>
            <span className="mx-2 opacity-40">·</span>
            <span>{formatDateline(published)}</span>
          </p>
        </div>
      </article>
    )
  }

  if (variant === 'lead') {
    return (
      <article className="border-t border-[var(--norm-rule)] pt-6">
        <Link href={href} className="block">
          <Photo
            src={photo}
            alt={article.profile.display_name}
            className="aspect-[4/3]"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          />
        </Link>
        <p className="norm-kicker mt-4">Profile</p>
        <h3 className="norm-headline-xl mt-2 text-2xl sm:text-[1.65rem]">
          <Link href={href} className="hover:underline">
            {article.headline}
          </Link>
        </h3>
        {article.subheadline ? (
          <p className="mt-2 line-clamp-3 font-serif text-base leading-snug text-[var(--norm-muted)]">
            {article.subheadline}
          </p>
        ) : null}
        <p className="norm-kicker mt-3">
          {article.author_name}
          <span className="mx-2 opacity-40">·</span>
          {timeAgo(published)}
        </p>
      </article>
    )
  }

  if (variant === 'small') {
    return (
      <article className="flex gap-4 border-t border-[var(--norm-rule)] pt-4">
        <Link href={href} className="block w-24 shrink-0">
          <Photo
            src={photo}
            alt={article.profile.display_name}
            className="aspect-square"
            sizes="96px"
          />
        </Link>
        <div className="min-w-0">
          <h4 className="norm-headline-xl text-base leading-tight">
            <Link href={href} className="hover:underline">
              {article.headline}
            </Link>
          </h4>
          <p className="norm-kicker mt-2">{timeAgo(published)}</p>
        </div>
      </article>
    )
  }

  // grid (default)
  return (
    <article className="border-t border-[var(--norm-rule)] pt-5">
      <Link href={href} className="block">
        <Photo
          src={photo}
          alt={article.profile.display_name}
          className="aspect-[4/3]"
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"
        />
      </Link>
      <h3 className="norm-headline-xl mt-3 text-xl">
        <Link href={href} className="hover:underline">
          {article.headline}
        </Link>
      </h3>
      {article.subheadline ? (
        <p className="mt-2 line-clamp-2 font-serif text-sm leading-snug text-[var(--norm-muted)]">
          {article.subheadline}
        </p>
      ) : null}
      <p className="norm-kicker mt-3">
        {article.author_name}
        <span className="mx-2 opacity-40">·</span>
        {timeAgo(published)}
      </p>
    </article>
  )
}
