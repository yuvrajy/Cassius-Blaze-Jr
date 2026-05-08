import { NextRequest, NextResponse } from 'next/server'

// Hostname → internal-route routing.
//
// We deploy ONE Next.js app behind THREE hostnames:
//   thenorm.info       → /news/...        (editorial)
//   *.iam.bio          → /personal/<sub>/...  (multi-tenant personal sites)
//   getknown.com       → /service/...     (marketing + signup + dashboards)
//
// The matcher below excludes Next internals and static assets. Anything else
// is rewritten (NOT redirected) so the browser URL stays on the real hostname.
//
// Supabase session cookies are refreshed inside the rewritten branches by
// each route's server component reading `lib/supabase/server.ts`. Doing the
// refresh here would require fetching from Supabase on every request — we
// keep middleware pure-routing and let RSCs handle auth state.

const HUB = 'thenorm.info'

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0]
  const url = req.nextUrl.clone()
  const parent = process.env.NEXT_PUBLIC_PARENT_DOMAIN ?? ''

  if (host === HUB || host === `www.${HUB}`) {
    url.pathname = `/news${url.pathname === '/' ? '' : url.pathname}`
    return NextResponse.rewrite(url)
  }

  if (parent && host.endsWith(`.${parent}`)) {
    const subdomain = host.slice(0, -1 * (parent.length + 1))
    if (subdomain && subdomain !== 'www') {
      url.pathname = `/personal/${subdomain}${url.pathname === '/' ? '' : url.pathname}`
      return NextResponse.rewrite(url)
    }
  }

  url.pathname = `/service${url.pathname === '/' ? '' : url.pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
