import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

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

export async function POST(request: NextRequest) {
    try {
        // Create authenticated Supabase client
        const supabase = await getSupabaseWithAuth()

        // Verify user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            console.error('Upload unauthorized:', authError)
            return NextResponse.json(
                { error: 'Unauthorized: You must be logged in to upload photos' },
                { status: 401 }
            )
        }

        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const captureDate = formData.get('capture_date') as string | null
        const duplicateAction = (formData.get('duplicate_action') as string) || 'ignore'

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            )
        }

        // --- DUPLICATE CHECK ---
        const { data: existingPhotos, error: findError } = await supabase
            .from('photos')
            .select('*')
            .eq('user_id', user.id)
            .eq('original_name', file.name)
            .order('created_at', { ascending: false })
            .limit(1)

        const existingPhoto = existingPhotos?.[0]

        if (existingPhoto) {
            if (duplicateAction === 'ignore') {
                // Return existing photo early
                return NextResponse.json({
                    success: true,
                    photo: existingPhoto,
                    url: existingPhoto.url,
                    message: 'Upload ignored (duplicate)'
                })
            }
        }
        // ------------------------

        const timestamp = Date.now()
        const randomId = Math.random().toString(36).substring(2, 8)
        const extension = file.name.split('.').pop()

        // If replacing, reuse the exact storage path of the existing photo. Otherwise, create new.
        const filename = existingPhoto && duplicateAction === 'replace'
            ? existingPhoto.filename
            : `${timestamp}-${randomId}.${extension}`

        const storagePath = existingPhoto && duplicateAction === 'replace'
            ? existingPhoto.storage_path
            : `${user.id}/${filename}` // Path structure: user_id/filename

        // Upload to Supabase Storage
        const { data: storageData, error: storageError } = await supabase.storage
            .from('photos')
            .upload(storagePath, file, {
                cacheControl: '3600',
                upsert: existingPhoto && duplicateAction === 'replace' ? true : false,
            })

        if (storageError) {
            console.error('Storage upload error:', storageError)
            return NextResponse.json(
                { error: 'Failed to upload file', details: storageError.message },
                { status: 500 }
            )
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('photos')
            .getPublicUrl(storagePath)

        const publicUrl = urlData.publicUrl

        let photoData = null;
        let dbError = null;

        if (existingPhoto && duplicateAction === 'replace') {
            // Update existing record
            const { data: updateData, error: updateError } = await supabase
                .from('photos')
                .update({
                    capture_date: captureDate ? new Date(captureDate).toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingPhoto.id)
                .select()
                .single()

            photoData = updateData;
            dbError = updateError;
        } else {
            // Insert new record
            const { data: insertData, error: insertError } = await supabase
                .from('photos')
                .insert({
                    user_id: user.id, // Ensure photo is linked to the user
                    filename,
                    original_name: file.name,
                    storage_path: storagePath,
                    url: publicUrl,
                    capture_date: captureDate ? new Date(captureDate).toISOString() : null,
                })
                .select()
                .single()

            photoData = insertData;
            dbError = insertError;
        }

        if (dbError) {
            console.error('Database save error:', dbError)
            // Still return success since file was uploaded
            return NextResponse.json({
                success: true,
                url: publicUrl,
                path: storagePath,
                error: 'File uploaded but metadata save failed',
            })
        }

        return NextResponse.json({
            success: true,
            photo: photoData,
            url: publicUrl,
        })
    } catch (error) {
        console.error('Upload error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

