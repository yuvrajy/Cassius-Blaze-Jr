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

export interface ProfileRow {
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
  created_at: string
  updated_at: string
}

export interface ArticleRow {
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

export interface PhotoVariants {
  thumb?: string
  medium?: string
  large?: string
  original?: string
}

export interface PhotoRow {
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

export interface SocialLinkRow {
  id: string
  profile_id: string
  platform: SocialPlatform
  value: string
  sort_order: number
  created_at: string
}

export interface PaymentRow {
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
  created_at: string
}

export interface TakedownRow {
  id: string
  profile_id: string
  reason: string | null
  requested_by: TakedownRequestor
  created_at: string
}

export interface TcAcceptanceRow {
  id: string
  profile_id: string | null
  user_id: string | null
  tc_version: string
  ip_address: string
  user_agent: string
  dob: string
  accepted_at: string
}

export interface NameCollisionCheckRow {
  id: string
  name_normalized: string
  severity: number
  evidence: Json
  checked_at: string
}

// Database type — the shape supabase-js expects via its generic. Tables only;
// no Views/Functions/Enums until we add any.
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Omit<ProfileRow, 'id' | 'created_at' | 'updated_at'> &
          Partial<Pick<ProfileRow, 'id' | 'created_at' | 'updated_at'>>
        Update: Partial<ProfileRow>
        Relationships: []
      }
      articles: {
        Row: ArticleRow
        Insert: Omit<ArticleRow, 'id' | 'created_at' | 'updated_at'> &
          Partial<Pick<ArticleRow, 'id' | 'created_at' | 'updated_at'>>
        Update: Partial<ArticleRow>
        Relationships: []
      }
      photos: {
        Row: PhotoRow
        Insert: Omit<PhotoRow, 'id' | 'created_at'> &
          Partial<Pick<PhotoRow, 'id' | 'created_at'>>
        Update: Partial<PhotoRow>
        Relationships: []
      }
      social_links: {
        Row: SocialLinkRow
        Insert: Omit<SocialLinkRow, 'id' | 'created_at'> &
          Partial<Pick<SocialLinkRow, 'id' | 'created_at'>>
        Update: Partial<SocialLinkRow>
        Relationships: []
      }
      payments: {
        Row: PaymentRow
        Insert: Omit<PaymentRow, 'id' | 'created_at'> &
          Partial<Pick<PaymentRow, 'id' | 'created_at'>>
        Update: Partial<PaymentRow>
        Relationships: []
      }
      takedowns: {
        Row: TakedownRow
        Insert: Omit<TakedownRow, 'id' | 'created_at'> &
          Partial<Pick<TakedownRow, 'id' | 'created_at'>>
        Update: Partial<TakedownRow>
        Relationships: []
      }
      tc_acceptances: {
        Row: TcAcceptanceRow
        Insert: Omit<TcAcceptanceRow, 'id' | 'accepted_at'> &
          Partial<Pick<TcAcceptanceRow, 'id' | 'accepted_at'>>
        Update: Partial<TcAcceptanceRow>
        Relationships: []
      }
      name_collision_checks: {
        Row: NameCollisionCheckRow
        Insert: Omit<NameCollisionCheckRow, 'id' | 'checked_at'> &
          Partial<Pick<NameCollisionCheckRow, 'id' | 'checked_at'>>
        Update: Partial<NameCollisionCheckRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
