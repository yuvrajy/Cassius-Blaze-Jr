import type { ArticleWithProfile } from '@/lib/contracts/profile'
import { ArticleCard } from '@/components/news/article-card'

export function RelatedStories({ articles }: { articles: ArticleWithProfile[] }) {
  if (articles.length === 0) return null
  return (
    <section className="border-t-2 border-[var(--norm-ink)] pt-8 pb-12">
      <h2 className="mb-6 font-serif text-2xl font-black">More from The Norm</h2>
      <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} variant="grid" />
        ))}
      </div>
    </section>
  )
}
