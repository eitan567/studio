'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { AlbumConfig, AlbumPage, Album } from '@/lib/types'


interface UseAlbumOptions {
    autoSave?: boolean
    autoSaveDelay?: number
}

const DEFAULT_CONFIG: AlbumConfig = {
    size: '25x25',
    photoGap: 4,
    pageMargin: 10,
    backgroundColor: '#ffffff',
    cornerRadius: 0,
}

export function useAlbum(albumId: string | null, options: UseAlbumOptions = {}) {
    const { autoSave = true, autoSaveDelay = 2000 } = options
    const router = useRouter()

    const [album, setAlbum] = useState<Album | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)

    // Ref to track pending save timeout
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const pendingDataRef = useRef<{ pages?: AlbumPage[]; config?: AlbumConfig; name?: string; thumbnail_url?: string; photos?: any[] } | null>(null)

    // Load album
    const loadAlbum = useCallback(async (id: string) => {
        if (id === 'new') {
            setAlbum(null)
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch(`/api/albums/${id}`)

            if (!response.ok) {
                if (response.status === 404) {
                    setError('Album not found')
                } else if (response.status === 401) {
                    router.push('/login')
                    return
                } else {
                    setError('Failed to load album')
                }
                setAlbum(null)
                return
            }

            const data = await response.json()
            setAlbum({
                ...data.album,
                config: { ...DEFAULT_CONFIG, ...(data.album.config || {}) },
                pages: data.album.pages || [],
            })
        } catch (err) {
            console.error('Load album error:', err)
            setError('Failed to load album')
        } finally {
            setIsLoading(false)
        }
    }, [router])

    // Create new album
    const createAlbum = useCallback(async (name: string = 'Untitled Album', config?: AlbumConfig, pages?: AlbumPage[], photos?: any[]) => {
        setIsSaving(true)
        setError(null)

        try {
            const response = await fetch('/api/albums', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    config: config || DEFAULT_CONFIG,
                    pages: pages || [],
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to create album')
            }

            const data = await response.json()
            setAlbum({
                ...data.album,
                config: data.album.config || DEFAULT_CONFIG,
                pages: data.album.pages || [],
            })
            setLastSaved(new Date())

            // Update URL to new album ID
            router.replace(`/album/${data.album.id}`)

            return data.album
        } catch (err) {
            console.error('Create album error:', err)
            setError('Failed to create album')
            throw err
        } finally {
            setIsSaving(false)
        }
    }, [router])

    // Save album (debounced)
    const saveAlbum = useCallback(async (data?: { pages?: AlbumPage[]; config?: AlbumConfig; name?: string; thumbnail_url?: string; photos?: any[] }) => {
        if (!album) return

        const dataToSave = data || pendingDataRef.current || {}

        // Critical: Ensure we persist the remoteUrl as src, not the local blob URL
        if (dataToSave.photos) {
            dataToSave.photos = dataToSave.photos.map(p => ({
                ...p,
                src: p.remoteUrl || p.src,
                // We can optionally clean up remoteUrl here or keep it, but src MUST be the remote one for DB
            }));
        }

        // Also sanitize pages if they are being saved, as they contain photo objects too
        if (dataToSave.pages) {
            dataToSave.pages = dataToSave.pages.map(page => ({
                ...page,
                photos: page.photos.map(p => ({
                    ...p,
                    src: p.remoteUrl || p.src
                })),
                // Handle nested photos in spreads if any (structure depends on spread implementation, but standard pages store flat photo lists usually)
            }));
        }

        pendingDataRef.current = null

        setIsSaving(true)

        try {
            const response = await fetch(`/api/albums/${album.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSave),
            })

            if (!response.ok) {
                throw new Error('Failed to save album')
            }

            const result = await response.json()

            // On success, we don't necessarily want to replace our local state with result state 
            // because our local state might have blob URLs that we want to keep for performance/flicker prevention.
            // However, to be safe and consistent, we usually merge. 
            // For now, let's update everything EXCEPT photos if we want to preserve blobs, 
            // OR finding matching photos and preserving their blob src if it exists.

            setAlbum(prev => {
                if (!prev) return null;
                const updatedAlbum = { ...prev, ...result.album };

                // Restore blob URLs for photos if they exist in our previous state
                // This prevents the "flash" when the saved data (remote URL) comes back and replaces the blob
                if (prev.photos) {
                    updatedAlbum.photos = result.album.photos.map((newP: any) => {
                        const oldP = prev.photos?.find(p => p.id === newP.id);
                        if (oldP && oldP.src.startsWith('blob:')) {
                            return { ...newP, src: oldP.src, remoteUrl: newP.src };
                        }
                        return newP;
                    });
                }

                return updatedAlbum;
            });

            setHasUnsavedChanges(false)
            setLastSaved(new Date())
        } catch (err) {
            console.error('Save album error:', err)
            setError('Failed to save changes')
        } finally {
            setIsSaving(false)
        }
    }, [album])

    // Queue an auto-save
    const queueSave = useCallback((data: { pages?: AlbumPage[]; config?: AlbumConfig; name?: string; thumbnail_url?: string; photos?: any[] }) => {
        if (!autoSave || !album) return

        setHasUnsavedChanges(true)
        pendingDataRef.current = { ...pendingDataRef.current, ...data }

        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }

        // Set new timeout
        saveTimeoutRef.current = setTimeout(() => {
            saveAlbum()
        }, autoSaveDelay)
    }, [autoSave, autoSaveDelay, album, saveAlbum])

    // Update pages (triggers auto-save)
    const updatePages = useCallback((pages: AlbumPage[]) => {
        setAlbum(prev => prev ? { ...prev, pages } : null)
        queueSave({ pages })
    }, [queueSave])

    // Update config (triggers auto-save) - accepts partial config and merges
    const updateConfig = useCallback((partialConfig: Partial<AlbumConfig>) => {
        setAlbum(prev => {
            if (!prev) return null;
            const mergedConfig = { ...prev.config, ...partialConfig };
            queueSave({ config: mergedConfig });
            return { ...prev, config: mergedConfig };
        })
    }, [queueSave])

    // Update name (triggers auto-save)
    const updateName = useCallback((name: string) => {
        setAlbum(prev => prev ? { ...prev, name } : null)
        queueSave({ name })
    }, [queueSave])

    // Update thumbnail (triggers auto-save)
    const updateThumbnail = useCallback((thumbnail_url: string) => {
        setAlbum(prev => prev ? { ...prev, thumbnail_url } : null)
        queueSave({ thumbnail_url })
    }, [queueSave])

    // Update photos (triggers auto-save)
    const updatePhotos = useCallback((photosOrFn: any[] | ((prev: any[]) => any[])) => {
        setAlbum(prev => {
            if (!prev) return null
            const currentPhotos = prev.photos || []
            const newPhotos = typeof photosOrFn === 'function'
                ? photosOrFn(currentPhotos)
                : photosOrFn

            queueSave({ photos: newPhotos })
            return { ...prev, photos: newPhotos }
        })
    }, [queueSave])

    // Delete album
    const deleteAlbum = useCallback(async () => {
        if (!album) return

        try {
            const response = await fetch(`/api/albums/${album.id}`, {
                method: 'DELETE',
            })

            if (!response.ok) {
                throw new Error('Failed to delete album')
            }

            router.push('/dashboard')
        } catch (err) {
            console.error('Delete album error:', err)
            setError('Failed to delete album')
        }
    }, [album, router])

    // Force save now (e.g., before leaving page)
    const saveNow = useCallback(async () => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
            saveTimeoutRef.current = null
        }

        if (hasUnsavedChanges || pendingDataRef.current) {
            await saveAlbum()
        }
    }, [hasUnsavedChanges, saveAlbum])

    // Load album on mount or ID change
    useEffect(() => {
        if (albumId) {
            loadAlbum(albumId)
        }
    }, [albumId, loadAlbum])

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
            }
        }
    }, [])

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault()
                return ''
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [hasUnsavedChanges])

    return {
        album,
        isLoading,
        isSaving,
        error,
        hasUnsavedChanges,
        lastSaved,

        // Actions
        loadAlbum,
        createAlbum,
        saveAlbum,
        saveNow,
        deleteAlbum,
        updatePages,
        updateConfig,
        updateName,
        updateThumbnail,
        updatePhotos: updatePhotos as (photos: any[] | ((prev: any[]) => any[])) => void,

        // Convenience getters
        pages: album?.pages || [],
        photos: album?.photos || [],
        config: album?.config || DEFAULT_CONFIG,
        name: album?.name || 'Untitled Album',
        thumbnail_url: album?.thumbnail_url,
        isNew: albumId === 'new',
    }
}
