import { parentDomain } from '@/components/personal/helpers'

export const revalidate = 3600

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ subdomain: string }> },
) {
  const { subdomain } = await ctx.params
  const parent = parentDomain()
  const body = `User-agent: *
Allow: /

Sitemap: https://${subdomain}.${parent}/sitemap.xml
`
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
