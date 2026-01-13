import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!

async function getSupabaseWithAuth() {
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

// GET /api/albums/[id] - Get a specific album
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await getSupabaseWithAuth()

        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: album, error } = await supabase
            .from('albums')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({ error: 'Album not found' }, { status: 404 })
            }
            console.error('Error fetching album:', error)
            return NextResponse.json({ error: 'Failed to fetch album' }, { status: 500 })
        }

        return NextResponse.json({ album })
    } catch (error) {
        console.error('Album GET error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PUT /api/albums/[id] - Update an album
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await getSupabaseWithAuth()

        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { name, config, pages, thumbnail_url, photos } = body

        // Build update object with only provided fields
        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        }

        if (name !== undefined) updateData.name = name
        if (config !== undefined) updateData.config = config
        if (pages !== undefined) updateData.pages = pages
        if (thumbnail_url !== undefined) updateData.thumbnail_url = thumbnail_url
        if (body.photos !== undefined) updateData.photos = body.photos

        const { data: album, error } = await supabase
            .from('albums')
            .update(updateData)
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({ error: 'Album not found' }, { status: 404 })
            }
            console.error('Error updating album:', error)
            return NextResponse.json({ error: 'Failed to update album' }, { status: 500 })
        }

        return NextResponse.json({ album })
    } catch (error) {
        console.error('Album PUT error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/albums/[id] - Delete an album
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await getSupabaseWithAuth()

        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { error } = await supabase
            .from('albums')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

        if (error) {
            console.error('Error deleting album:', error)
            return NextResponse.json({ error: 'Failed to delete album' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Album DELETE error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
