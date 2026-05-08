import { createClient } from '@/lib/supabase/server'
import { parentDomain } from '@/components/personal/helpers'

export const revalidate = 300

// Single-URL sitemap for one subdomain. Even though the personal site is
// just one page, the sitemap still helps Google's crawler discover the
// page faster and read `lastmod` for freshness signals.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ subdomain: string }> },
) {
  const { subdomain } = await ctx.params
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('subdomain, updated_at, status')
    .eq('subdomain', subdomain)
    .eq('status', 'live')
    .maybeSingle()

  const parent = parentDomain()
  const loc = `https://${subdomain}.${parent}`

  const row = data as unknown as { updated_at: string } | null

  if (!row) {
    return new Response(emptySitemap(), {
      status: 404,
      headers: { 'content-type': 'application/xml; charset=utf-8' },
    })
  }

  const lastmod = new Date(row.updated_at).toISOString()
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, s-maxage=300, stale-while-revalidate=86400',
    },
  })
}

function emptySitemap() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>
`
}
