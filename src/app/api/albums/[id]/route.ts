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

        // 1. Fetch album to get photos list
        const { data: album, error: fetchError } = await supabase
            .from('albums')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (fetchError || !album) {
            // If not found, just return (or error?)
            // If manual 404, maybe it's already gone.
        }

        // 2. Extract photos to delete
        // Album 'photos' column is a JSON array of Photo objects
        const albumPhotos = album?.photos || [];

        const getStoragePath = (url: string) => {
            try {
                // Extracts content after /photos/
                // Supports: .../photos/user_id/file.jpg
                const match = url.match(/\/photos\/(.+)$/);
                if (match && match[1]) {
                    const path = decodeURIComponent(match[1]);
                    console.log('[DELETE] Extracted path:', path, 'from URL:', url);
                    return path;
                }
                console.log('[DELETE] Failed to extract path from URL:', url);
                return null;
            } catch (e) {
                console.error('[DELETE] Error extracting path:', e);
                return null;
            }
        };

        const pathsToDelete = Array.isArray(albumPhotos) ? albumPhotos
            .map((p: any) => p.src ? getStoragePath(p.src) : null)
            .filter((p: string | null) => p !== null) as string[] : [];

        console.log('[DELETE] Initial paths to delete (from photos):', pathsToDelete);

        // Also delete the thumbnail if it exists in storage
        if (album?.thumbnail_url) {
            console.log('[DELETE] Checking thumbnail_url:', album.thumbnail_url);
            const thumbnailPath = getStoragePath(album.thumbnail_url);
            if (thumbnailPath) {
                if (!pathsToDelete.includes(thumbnailPath)) {
                    pathsToDelete.push(thumbnailPath);
                    console.log('[DELETE] Added thumbnail to deletion list:', thumbnailPath);
                } else {
                    console.log('[DELETE] Thumbnail already in deletion list');
                }
            }
        }

        // 3. Delete from Storage and DB
        if (pathsToDelete.length > 0) {
            console.log('[DELETE] Removing files from storage:', pathsToDelete);
            // Storage
            const { error: storageError } = await supabase.storage.from('photos').remove(pathsToDelete);
            if (storageError) console.error('[DELETE] Storage Remove Error:', storageError);

            // DB
            const { error: dbDeleteError } = await supabase.from('photos').delete().in('storage_path', pathsToDelete);
            if (dbDeleteError) console.error('[DELETE] DB Photo Delete Error:', dbDeleteError);
        } else {
            console.log('[DELETE] No files to delete.');
        }

        // 4. Delete Album
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
