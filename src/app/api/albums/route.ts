import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'
import {
    normalizeAlbumMediaUrls,
    normalizeAlbumPageMediaUrls,
    normalizeSupabaseStorageUrl
} from '@/lib/supabase-media-normalizer'

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
            logger.error('Error fetching albums:', error)
            return NextResponse.json({ error: 'Failed to fetch albums' }, { status: 500 })
        }

        // Strip heavy JSONB arrays — compute lightweight summary fields server-side
        // so the client receives only integers instead of full pages/photos payloads.
        const lightAlbums = (albums ?? []).map((album) => {
            const pages: Array<{ photos?: Array<{ src?: string }> }> = album.pages ?? []
            const pagesCount = pages.length
            const photosCount: number = album.photos?.length ?? 0

            let totalSlots = 0
            let filledSlots = 0
            for (const page of pages) {
                const slots = page.photos ?? []
                totalSlots += slots.length
                filledSlots += slots.filter((p) => p.src && p.src !== '').length
            }

            const { pages: _pages, photos: _photos, ...rest } = album
            return {
                ...rest,
                thumbnail_url: normalizeSupabaseStorageUrl(rest.thumbnail_url as string | null | undefined),
                pages_count: pagesCount,
                photos_count: photosCount,
                total_slots: totalSlots,
                filled_slots: filledSlots,
            }
        })

        return NextResponse.json({ albums: lightAlbums })
    } catch (error) {
        logger.error('Albums GET error:', error)
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
        logger.debug('POST /api/albums: Received body:', { name, config: !!config, pages: !!pages, thumbnail_url });

        const { data: album, error } = await supabase
            .from('albums')
            .insert({
                user_id: user.id,
                name: name || 'Untitled Album',
                config: config || {},
                pages: Array.isArray(pages) ? pages.map((page: any) => normalizeAlbumPageMediaUrls(page)) : [],
                thumbnail_url: normalizeSupabaseStorageUrl(thumbnail_url || null),
            })
            .select()
            .single()

        logger.debug('POST /api/albums: Created album:', album?.id, 'thumbnail_url:', album?.thumbnail_url);

        if (error) {
            logger.error('Error creating album:', error)
            return NextResponse.json({ error: 'Failed to create album' }, { status: 500 })
        }

        return NextResponse.json({ album: normalizeAlbumMediaUrls(album) }, { status: 201 })
    } catch (error) {
        logger.error('Albums POST error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
