import { listLiveArticlesForFeed } from '@/components/news/queries'

export const revalidate = 600

const SITE = 'https://thenorm.info'
const FEED_TITLE = 'The Norm'
const FEED_DESC =
  'Profiles of emerging voices, builders, and people worth knowing.'

export async function GET() {
  const articles = await listLiveArticlesForFeed({ limit: 50 })
  const lastBuildDate = new Date().toUTCString()

  const items = articles
    .map((a) => {
      const link = `${SITE}/article/${a.slug}`
      const pub = a.published_at
        ? new Date(a.published_at).toUTCString()
        : new Date(a.updated_at).toUTCString()
      const description =
        a.subheadline ?? excerpt(a.body, 280)
      return (
        `    <item>\n` +
        `      <title>${esc(a.headline)}</title>\n` +
        `      <link>${esc(link)}</link>\n` +
        `      <guid isPermaLink="true">${esc(link)}</guid>\n` +
        `      <pubDate>${esc(pub)}</pubDate>\n` +
        `      <author>editors@thenorm.info (${esc(a.author_name)})</author>\n` +
        `      <description>${cdata(description)}</description>\n` +
        `    </item>`
      )
    })
    .join('\n')

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>${esc(FEED_TITLE)}</title>\n` +
    `    <link>${esc(SITE)}</link>\n` +
    `    <description>${esc(FEED_DESC)}</description>\n` +
    `    <language>en-us</language>\n` +
    `    <lastBuildDate>${esc(lastBuildDate)}</lastBuildDate>\n` +
    `    <atom:link href="${esc(SITE)}/rss.xml" rel="self" type="application/rss+xml"/>\n` +
    `${items}\n` +
    `  </channel>\n` +
    `</rss>\n`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
    },
  })
}

function excerpt(body: string, max: number): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  return flat.slice(0, max - 1).trimEnd() + '…'
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function cdata(s: string): string {
  // CDATA cannot contain "]]>" — split it if present.
  return `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}
