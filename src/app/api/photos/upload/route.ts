import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!

export async function POST(request: NextRequest) {
    try {
        const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

        const formData = await request.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            )
        }

        // Generate unique filename
        const timestamp = Date.now()
        const randomId = Math.random().toString(36).substring(2, 8)
        const extension = file.name.split('.').pop()
        const filename = `${timestamp}-${randomId}.${extension}`
        const storagePath = `uploads/${filename}`

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
                filename,
                original_name: file.name,
                storage_path: storagePath,
                url: publicUrl,
                // width and height can be extracted client-side before upload
                // capture_date can be extracted from EXIF if needed
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
