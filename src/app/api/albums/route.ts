import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!

async function getSupabaseWithAuth(request: NextRequest) {
    const cookieStore = await cookies()

    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) =>
                    cookieStore.set(name, value, options)
                )
            },
        },
    })
}

// GET /api/albums - List all albums for the authenticated user
export async function GET(request: NextRequest) {
    try {
        const supabase = await getSupabaseWithAuth(request)

        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: albums, error } = await supabase
            .from('albums')
            .select('id, name, thumbnail_url, created_at, updated_at, pages, photos')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })

        if (error) {
            console.error('Error fetching albums:', error)
            return NextResponse.json({ error: 'Failed to fetch albums' }, { status: 500 })
        }

        return NextResponse.json({ albums })
    } catch (error) {
        console.error('Albums GET error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/albums - Create a new album
export async function POST(request: NextRequest) {
    try {
        const supabase = await getSupabaseWithAuth(request)

        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { name, config, pages, thumbnail_url } = body
        console.log('[POST /api/albums] Received body:', { name, config: !!config, pages: !!pages, thumbnail_url });

        const { data: album, error } = await supabase
            .from('albums')
            .insert({
                user_id: user.id,
                name: name || 'Untitled Album',
                config: config || {},
                pages: pages || [],
                thumbnail_url: thumbnail_url || null,
            })
            .select()
            .single()

        console.log('[POST /api/albums] Created album:', album?.id, 'thumbnail_url:', album?.thumbnail_url);

        if (error) {
            console.error('Error creating album:', error)
            return NextResponse.json({ error: 'Failed to create album' }, { status: 500 })
        }

        return NextResponse.json({ album }, { status: 201 })
    } catch (error) {
        console.error('Albums POST error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
