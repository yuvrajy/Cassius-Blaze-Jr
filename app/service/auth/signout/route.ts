import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST-only sign-out. Server actions and forms post here; the Supabase
// server client clears the auth cookies for us, then we 303 the browser
// home so the user lands on the marketing site signed-out.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', request.url), { status: 303 })
}
