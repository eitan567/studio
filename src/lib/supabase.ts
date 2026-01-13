import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!

// Browser client for client-side components
export function createClient() {
    return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Server client for API routes
export function createServerClient() {
    return createSupabaseClient(supabaseUrl, supabaseAnonKey)
}

// ========================================
// AUTH FUNCTIONS
// ========================================

export async function signUp(email: string, password: string, fullName: string) {
    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
            },
        },
    })

    if (error) throw error
    return data
}

export async function signIn(email: string, password: string) {
    const supabase = createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) throw error
    return data
}

export async function signInWithGoogle() {
    const supabase = createClient()

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
        },
    })

    if (error) throw error
    return data
}

export async function signOut() {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) throw error
}

export async function getUser() {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
}

export async function getSession() {
    const supabase = createClient()
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
}

// ========================================
// TYPE DEFINITIONS
// ========================================

export type PhotoRow = {
    id: string
    filename: string
    original_name: string
    storage_path: string
    url: string
    width: number | null
    height: number | null
    capture_date: string | null
    created_at: string
    album_id: string | null
    user_id: string | null
}

export type AlbumRow = {
    id: string
    user_id: string
    name: string
    config: Record<string, unknown>
    pages: unknown[]
    thumbnail_url: string | null
    created_at: string
    updated_at: string
}

export type ProfileRow = {
    id: string
    email: string | null
    full_name: string | null
    avatar_url: string | null
    created_at: string
    updated_at: string
}
