import { listLiveArticleSlugs } from '@/components/news/queries'

export const revalidate = 3600

const SITE = 'https://thenorm.info'

export async function GET() {
  const articles = await listLiveArticleSlugs()

  type SitemapUrl = {
    loc: string
    lastmod?: string
    changefreq: string
    priority: string
  }

  const staticUrls: SitemapUrl[] = [
    { loc: `${SITE}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE}/about`, changefreq: 'monthly', priority: '0.5' },
  ]

  const articleUrls: SitemapUrl[] = articles.map((a) => ({
    loc: `${SITE}/article/${a.slug}`,
    lastmod: a.updated_at,
    changefreq: 'weekly',
    priority: '0.7',
  }))

  const urls = [...staticUrls, ...articleUrls]
    .map(
      (u) =>
        `  <url>\n` +
        `    <loc>${escapeXml(u.loc)}</loc>\n` +
        (u.lastmod ? `    <lastmod>${escapeXml(u.lastmod)}</lastmod>\n` : '') +
        `    <changefreq>${u.changefreq}</changefreq>\n` +
        `    <priority>${u.priority}</priority>\n` +
        `  </url>`,
    )
    .join('\n')

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n` +
    `</urlset>\n`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
