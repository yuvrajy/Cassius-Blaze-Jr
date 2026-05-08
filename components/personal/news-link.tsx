import { ArrowUpRight } from 'lucide-react'
import { articleUrl } from '@/lib/contracts/revalidation'

export function NewsLink({
  articleSlug,
  displayName,
  articleHeadline,
}: {
  articleSlug: string
  displayName: string
  articleHeadline?: string | null
}) {
  const href = articleUrl({ slug: articleSlug })
  const firstName = displayName.trim().split(/\s+/)[0] ?? displayName

  return (
    <section className="bg-[#0d0d10] px-6 py-24 sm:px-12 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-3xl">
        <p className="pn-sans text-[0.62rem] font-medium uppercase tracking-[0.4em] text-[#c9a84c]">
          In the Press
        </p>
        <a
          href={href}
          className="group mt-6 block border border-[#c9a84c]/20 bg-[#111115] p-8 transition hover:border-[#c9a84c] sm:p-12"
        >
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <p className="pn-sans text-[0.7rem] font-medium uppercase tracking-[0.25em] text-[#bbbbc4]">
                The Norm
              </p>
              <h3 className="pn-serif mt-4 text-[clamp(1.5rem,3vw,2.4rem)] font-light leading-[1.15] text-[#f5f3ee]">
                {articleHeadline?.trim()
                  ? articleHeadline
                  : `Read about ${firstName} on The Norm.`}
              </h3>
              <p className="pn-sans mt-5 text-[0.78rem] uppercase tracking-[0.2em] text-[#c9a84c]">
                Read the article
                <ArrowUpRight
                  className="ml-2 inline-block transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  size={14}
                  strokeWidth={1.6}
                />
              </p>
            </div>
          </div>
        </a>
      </div>
    </section>
  )
}
