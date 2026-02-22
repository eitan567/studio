import { useState, useCallback } from 'react'
import type { Photo } from '@/lib/types'
import exifr from 'exifr'
import { useSettings } from '@/hooks/use-settings'

interface UploadProgress {
    loaded: number
    total: number
    percent: number
}

interface UploadResult {
    success: boolean
    photo?: Photo
    url?: string
    error?: string
    ignoredDuplicate?: boolean
}

export function usePhotoUpload() {
    const { settings } = useSettings()
    const [isUploading, setIsUploading] = useState(false)
    const [progress, setProgress] = useState<UploadProgress | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Get image dimensions before upload
    const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
        return new Promise((resolve, reject) => {
            const img = new Image()
            img.onload = () => {
                resolve({ width: img.width, height: img.height })
                URL.revokeObjectURL(img.src)
            }
            img.onerror = () => {
                reject(new Error('Failed to load image'))
                URL.revokeObjectURL(img.src)
            }
            img.src = URL.createObjectURL(file)
        })
    }

    // Upload a single photo
    const uploadPhoto = useCallback(async (file: File, options?: { signal?: AbortSignal, skipStateUpdates?: boolean }): Promise<UploadResult> => {
        if (!options?.skipStateUpdates) {
            setIsUploading(true)
            setError(null)
            setProgress({ loaded: 0, total: file.size, percent: 0 })
        }

        try {
            // Get dimensions and EXIF data before upload
            const dimensions = await getImageDimensions(file)

            let captureDate: Date | undefined = undefined
            try {
                const exif = await exifr.parse(file)
                if (exif?.DateTimeOriginal) {
                    captureDate = new Date(exif.DateTimeOriginal)
                }
            } catch (e) {
                console.warn('Failed to extract EXIF data:', e)
            }

            const formData = new FormData()
            formData.append('file', file)
            if (captureDate) {
                formData.append('capture_date', captureDate.toISOString())
            }
            if (settings.duplicateUploadAction) {
                formData.append('duplicate_action', settings.duplicateUploadAction)
            }

            const response = await fetch('/api/photos/upload', {
                method: 'POST',
                body: formData,
                signal: options?.signal,
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed')
            }

            if (!options?.skipStateUpdates) {
                setProgress({ loaded: file.size, total: file.size, percent: 100 })
            }

            const ignoredDuplicate =
                data?.duplicate === true ||
                (typeof data?.message === 'string' &&
                    data.message.toLowerCase().includes('ignored'))

            // Convert to Photo type
            const photo: Photo = {
                id: data.photo?.id || crypto.randomUUID(),
                src: data.url,
                alt: file.name,
                width: dimensions.width,
                height: dimensions.height,
                captureDate: captureDate, // Use extracted date
            }

            return { success: true, photo, url: data.url, ignoredDuplicate }
        } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : 'Upload failed'
            // Don't set global error state if skipped, but do return it
            if (!options?.skipStateUpdates && err.name !== 'AbortError') {
                setError(errorMessage)
            }
            return { success: false, error: errorMessage }
        } finally {
            if (!options?.skipStateUpdates) {
                setIsUploading(false)
            }
        }
    }, [settings.duplicateUploadAction])

    // Upload multiple photos
    const uploadPhotos = useCallback(async (files: File[]): Promise<UploadResult[]> => {
        setIsUploading(true)
        setError(null)

        const results: UploadResult[] = []
        let totalSize = files.reduce((acc, f) => acc + f.size, 0)
        let uploadedSize = 0

        for (const file of files) {
            setProgress({
                loaded: uploadedSize,
                total: totalSize,
                percent: Math.round((uploadedSize / totalSize) * 100),
            })

            const result = await uploadPhoto(file)
            results.push(result)
            uploadedSize += file.size
        }

        setProgress({ loaded: totalSize, total: totalSize, percent: 100 })
        setIsUploading(false)

        return results
    }, [uploadPhoto])

    // Reset state
    const reset = useCallback(() => {
        setIsUploading(false)
        setProgress(null)
        setError(null)
    }, [])

    return {
        uploadPhoto,
        uploadPhotos,
        isUploading,
        progress,
        error,
        reset,
    }
}
