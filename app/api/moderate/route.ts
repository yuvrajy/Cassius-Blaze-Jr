import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import {
  sendProfileUpdated,
  sendTakedownRequested,
} from '@/lib/inngest/client'
import { revalidateProfile, articleUrl, profileUrls } from '@/lib/contracts/revalidation'
import { sendEmail } from '@/lib/email/client'
import { approvedEmail } from '@/lib/email/templates/approved'
import { rejectedEmail } from '@/lib/email/templates/rejected'

// POST /api/moderate
//
// Admin-only endpoint called by agent 5's queue UI. Body:
//   { profile_id: uuid, action: 'approve' | 'reject' | 'remoderate' | 'takedown', reason?: string }
//
// CONTRACT NOTE: the brief described agent 5 firing
// `Events.PROFILE_UPDATED { action: 'approved' | 'rejected' }` directly.
// The frozen contract has no `action` field on PROFILE_UPDATED, so we
// surface the action here as an HTTP-level discriminator instead. Approve
// and reject mutate the DB directly + send email + revalidate; remoderate
// fires PROFILE_UPDATED with `changed_fields: ['bio']`; takedown fires
// TAKEDOWN_REQUESTED with `requested_by: 'admin'`.

interface Body {
  profile_id: string
  action: 'approve' | 'reject' | 'remoderate' | 'takedown'
  reason?: string
}

export async function POST(req: Request) {
  const adminGuard = await requireAdminEmail()
  if (adminGuard) return adminGuard

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  if (!body.profile_id || !body.action) {
    return NextResponse.json({ error: 'profile_id + action required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, subdomain, display_name, user_id, status, articles(id, slug)')
    .eq('id', body.profile_id)
    .single()
  if (error || !profile) {
    return NextResponse.json({ error: 'profile not found' }, { status: 404 })
  }
  const article = (profile as typeof profile & { articles: { id: string; slug: string }[] })
    .articles?.[0]

  switch (body.action) {
    case 'approve': {
      await admin
        .from('profiles')
        .update({ status: 'live' })
        .eq('id', body.profile_id)
      if (article) {
        await admin
          .from('articles')
          .update({ status: 'live', published_at: new Date().toISOString() })
          .eq('id', article.id)
      }
      // Email
      const userEmail = await getUserEmail(profile.user_id)
      if (userEmail && article) {
        const urls = profileUrls({ subdomain: profile.subdomain })
        await sendEmail({
          to: userEmail,
          email: approvedEmail({
            display_name: profile.display_name,
            article_url: articleUrl({ slug: article.slug }),
            personal_url: urls.personal,
          }),
          idempotencyKey: `approved:${profile.id}`,
        })
      }
      if (article) {
        await revalidateProfile(
          { subdomain: profile.subdomain },
          { slug: article.slug },
        )
      }
      return NextResponse.json({ ok: true, status: 'live' })
    }

    case 'reject': {
      const reason = body.reason ?? 'Did not meet our editorial standards.'
      await admin
        .from('profiles')
        .update({
          status: 'rejected',
          moderation_notes: JSON.stringify({
            rejected_at: new Date().toISOString(),
            reason,
          }),
        })
        .eq('id', body.profile_id)
      const userEmail = await getUserEmail(profile.user_id)
      if (userEmail) {
        await sendEmail({
          to: userEmail,
          email: rejectedEmail({
            display_name: profile.display_name,
            reason,
          }),
          idempotencyKey: `rejected:${profile.id}`,
        })
      }
      if (article) {
        await revalidateProfile(
          { subdomain: profile.subdomain },
          { slug: article.slug },
        )
      }
      return NextResponse.json({ ok: true, status: 'rejected' })
    }

    case 'remoderate': {
      await sendProfileUpdated({
        profile_id: body.profile_id,
        changed_fields: ['bio'],
      })
      return NextResponse.json({ ok: true, queued: true })
    }

    case 'takedown': {
      await sendTakedownRequested({
        profile_id: body.profile_id,
        requested_by: 'admin',
        reason: body.reason,
      })
      return NextResponse.json({ ok: true, queued: true })
    }
  }
}

async function getUserEmail(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(userId)
  return data.user?.email ?? null
}

async function requireAdminEmail(): Promise<NextResponse | null> {
  const allow = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (allow.length === 0) {
    return NextResponse.json({ error: 'admin allowlist empty' }, { status: 503 })
  }
  const supabase = await createServerClient()
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email?.toLowerCase()
  if (!email || !allow.includes(email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return null
}
