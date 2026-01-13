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

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            )
        }

        const timestamp = Date.now()
        const randomId = Math.random().toString(36).substring(2, 8)
        const extension = file.name.split('.').pop()
        const filename = `${timestamp}-${randomId}.${extension}`
        const storagePath = `${user.id}/${filename}` // Path structure: user_id/filename

        // Upload to Supabase Storage
        const { data: storageData, error: storageError } = await supabase.storage
            .from('photos')
            .upload(storagePath, file, {
                cacheControl: '3600',
                upsert: false,
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

        // Save metadata to database
        const { data: photoData, error: dbError } = await supabase
            .from('photos')
            .insert({
                user_id: user.id, // Ensure photo is linked to the user
                filename,
                original_name: file.name,
                storage_path: storagePath,
                url: publicUrl,
            })
            .select()
            .single()

        if (dbError) {
            console.error('Database insert error:', dbError)
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

