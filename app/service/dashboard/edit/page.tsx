import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { EditForm } from '@/components/dashboard/edit-form'
import { loadOwnerProfile } from '../_lib/profile'

export const metadata = { title: 'Edit profile' }

export default async function EditPage() {
  const user = await requireUser()
  const supabase = await createClient()
  const profile = await loadOwnerProfile(supabase, user.id)

  return (
    <DashboardShell email={user.email} active="edit">
      <div className="mx-auto max-w-2xl space-y-6">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/dashboard" />}
        >
          <ArrowLeftIcon /> Back to dashboard
        </Button>

        <header className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Edit profile
          </h1>
          <p className="text-sm text-muted-foreground">
            Bio changes go through review again. Tagline and social links
            publish immediately.
          </p>
        </header>

        {profile ? (
          <EditForm
            displayName={profile.display_name}
            subdomain={profile.subdomain}
            tagline={profile.tagline}
            bio={profile.bio}
            socialLinks={profile.social_links.map((l) => ({
              platform: l.platform,
              value: l.value,
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No profile to edit.</p>
        )}
      </div>
    </DashboardShell>
  )
}
