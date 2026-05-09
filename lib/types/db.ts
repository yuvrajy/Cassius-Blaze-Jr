// Hand-written types mirroring supabase/migrations/0001_initial_schema.sql.
//
// REGENERATE with the Supabase CLI once the project is provisioned:
//   pnpm dlx supabase gen types typescript \
//     --project-id "$SUPABASE_PROJECT_ID" --schema public \
//     > lib/types/db.ts
//
// Keep the export name `Database` and the `*Row` aliases stable — sub-agents
// 2–7 import them directly through the typed Supabase clients in
// `lib/supabase/`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type PaymentTier = 'base' | 'bespoke_domain'
export type TakedownRequestor =
  | 'customer'
  | 'admin'
  | 'expiry'
  | 'gdpr'
  | 'moderation'

export type ProfileStatus = 'pending_moderation' | 'live' | 'taken_down' | 'rejected'
export type ArticleStatus = 'pending_moderation' | 'live' | 'taken_down'
export type SocialPlatform =
  | 'twitter'
  | 'instagram'
  | 'linkedin'
  | 'github'
  | 'tiktok'
  | 'youtube'
  | 'email'
  | 'website'

export type ProfileRow = {
  id: string
  user_id: string | null
  subdomain: string
  display_name: string
  tagline: string | null
  bio: string
  status: ProfileStatus
  bespoke_domain: string | null
  moderation_notes: string | null
  expires_at: string | null
  expiry_warning_sent_at: string | null
  takedown_finalized_at: string | null
  bespoke_domain_email_sent_at: string | null
  created_at: string
  updated_at: string
}

export type ArticleRow = {
  id: string
  profile_id: string
  slug: string
  headline: string
  subheadline: string | null
  body: string
  author_name: string
  status: ArticleStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

export type PhotoVariants = {
  thumb?: string
  medium?: string
  large?: string
  original?: string
}

export type PhotoRow = {
  id: string
  profile_id: string
  storage_path: string
  variants: PhotoVariants
  is_primary: boolean
  sort_order: number
  consent_logged: boolean
  consent_ip: string | null
  consent_user_agent: string | null
  consent_at: string | null
  created_at: string
}

export type SocialLinkRow = {
  id: string
  profile_id: string
  platform: SocialPlatform
  value: string
  sort_order: number
  created_at: string
}

export type PaymentRow = {
  id: string
  profile_id: string | null
  user_id: string | null
  stripe_session_id: string | null
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  amount_cents: number
  currency: string
  tier: PaymentTier
  status: string
  bespoke_domain_chosen: string | null
  created_at: string
}

export type TakedownRow = {
  id: string
  profile_id: string
  reason: string | null
  requested_by: TakedownRequestor
  created_at: string
}

export type TcAcceptanceRow = {
  id: string
  profile_id: string | null
  user_id: string | null
  tc_version: string
  ip_address: string
  user_agent: string
  dob: string
  accepted_at: string
}

export type NameCollisionCheckRow = {
  id: string
  name_normalized: string
  severity: number
  evidence: Json
  checked_at: string
}

export type PendingSignupRow = {
  id: string
  payload: Json
  created_at: string
  expires_at: string
}

// Database type — the shape supabase-js expects via its generic.
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: {
          id?: string
          user_id?: string | null
          subdomain: string
          display_name: string
          tagline?: string | null
          bio: string
          status?: ProfileStatus
          bespoke_domain?: string | null
          moderation_notes?: string | null
          expires_at?: string | null
          expiry_warning_sent_at?: string | null
          takedown_finalized_at?: string | null
          bespoke_domain_email_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          subdomain?: string
          display_name?: string
          tagline?: string | null
          bio?: string
          status?: ProfileStatus
          bespoke_domain?: string | null
          moderation_notes?: string | null
          expires_at?: string | null
          expiry_warning_sent_at?: string | null
          takedown_finalized_at?: string | null
          bespoke_domain_email_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      articles: {
        Row: ArticleRow
        Insert: {
          id?: string
          profile_id: string
          slug: string
          headline: string
          subheadline?: string | null
          body: string
          author_name?: string
          status?: ArticleStatus
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          slug?: string
          headline?: string
          subheadline?: string | null
          body?: string
          author_name?: string
          status?: ArticleStatus
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'articles_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      photos: {
        Row: PhotoRow
        Insert: {
          id?: string
          profile_id: string
          storage_path: string
          variants?: PhotoVariants
          is_primary?: boolean
          sort_order?: number
          consent_logged?: boolean
          consent_ip?: string | null
          consent_user_agent?: string | null
          consent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          storage_path?: string
          variants?: PhotoVariants
          is_primary?: boolean
          sort_order?: number
          consent_logged?: boolean
          consent_ip?: string | null
          consent_user_agent?: string | null
          consent_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'photos_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      social_links: {
        Row: SocialLinkRow
        Insert: {
          id?: string
          profile_id: string
          platform: SocialPlatform
          value: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          platform?: SocialPlatform
          value?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'social_links_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      payments: {
        Row: PaymentRow
        Insert: {
          id?: string
          profile_id?: string | null
          user_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
          amount_cents: number
          currency?: string
          tier: PaymentTier
          status: string
          bespoke_domain_chosen?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string | null
          user_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
          amount_cents?: number
          currency?: string
          tier?: PaymentTier
          status?: string
          bespoke_domain_chosen?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payments_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      takedowns: {
        Row: TakedownRow
        Insert: {
          id?: string
          profile_id: string
          reason?: string | null
          requested_by: TakedownRequestor
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          reason?: string | null
          requested_by?: TakedownRequestor
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'takedowns_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      tc_acceptances: {
        Row: TcAcceptanceRow
        Insert: {
          id?: string
          profile_id?: string | null
          user_id?: string | null
          tc_version: string
          ip_address: string
          user_agent: string
          dob: string
          accepted_at?: string
        }
        Update: {
          id?: string
          profile_id?: string | null
          user_id?: string | null
          tc_version?: string
          ip_address?: string
          user_agent?: string
          dob?: string
          accepted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tc_acceptances_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      name_collision_checks: {
        Row: NameCollisionCheckRow
        Insert: {
          id?: string
          name_normalized: string
          severity: number
          evidence?: Json
          checked_at?: string
        }
        Update: {
          id?: string
          name_normalized?: string
          severity?: number
          evidence?: Json
          checked_at?: string
        }
        Relationships: []
      }
      pending_signups: {
        Row: PendingSignupRow
        Insert: {
          id?: string
          payload: Json
          created_at?: string
          expires_at?: string
        }
        Update: {
          id?: string
          payload?: Json
          created_at?: string
          expires_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
