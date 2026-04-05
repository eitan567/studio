'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AlbumEditorContextType {
    previewPhotoGap: number | null;
    setPreviewPhotoGap: (value: number | null) => void;
    previewPageMargin: number | null;
    setPreviewPageMargin: (value: number | null) => void;
    previewCornerRadius: number | null;
    setPreviewCornerRadius: (value: number | null) => void;
    // Gallery Navigation
    registerGalleryScroll: (scrollFn: (photoId: string) => void) => void;
    scrollToGallery: (photoId: string) => void;
    highlightedPhotoId: string | null;
    activeAlbumDrag: { pageId: string; photoId: string } | null;
    setActiveAlbumDrag: (value: { pageId: string; photoId: string } | null) => void;
    activeGalleryDrag: { photoId: string; selectedPhotoIds?: string[] } | null;
    setActiveGalleryDrag: (value: { photoId: string; selectedPhotoIds?: string[] } | null) => void;
}

const AlbumEditorContext = createContext<AlbumEditorContextType | undefined>(undefined);

export function AlbumEditorProvider({ children }: { children: ReactNode }) {
    const [previewPhotoGap, setPreviewPhotoGap] = useState<number | null>(null);
    const [previewPageMargin, setPreviewPageMargin] = useState<number | null>(null);
    const [previewCornerRadius, setPreviewCornerRadius] = useState<number | null>(null);

    // Gallery Navigation Ref
    const galleryScrollFnRef = React.useRef<((photoId: string) => void) | null>(null);
    const [highlightedPhotoId, setHighlightedPhotoId] = useState<string | null>(null);
    const highlightTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [activeAlbumDrag, setActiveAlbumDrag] = useState<{ pageId: string; photoId: string } | null>(null);
    const [activeGalleryDrag, setActiveGalleryDrag] = useState<{ photoId: string; selectedPhotoIds?: string[] } | null>(null);

    React.useEffect(() => {
        const clearActiveDragState = () => {
            setActiveAlbumDrag((currentValue) => (currentValue ? null : currentValue));
            setActiveGalleryDrag((currentValue) => (currentValue ? null : currentValue));
        };

        window.addEventListener('dragend', clearActiveDragState);
        window.addEventListener('drop', clearActiveDragState);

        return () => {
            window.removeEventListener('dragend', clearActiveDragState);
            window.removeEventListener('drop', clearActiveDragState);
        };
    }, []);

    const registerGalleryScroll = React.useCallback((scrollFn: (photoId: string) => void) => {
        galleryScrollFnRef.current = scrollFn;
    }, []);

    const scrollToGallery = React.useCallback((photoId: string) => {
        if (galleryScrollFnRef.current) {
            galleryScrollFnRef.current(photoId);

            // Set highlighted photo
            setHighlightedPhotoId(photoId);

            // Clear existing timeout
            if (highlightTimeoutRef.current) {
                clearTimeout(highlightTimeoutRef.current);
            }

            // Clear highlight after 3.5 seconds (1s delay + 1.2s animation + buffer)
            highlightTimeoutRef.current = setTimeout(() => {
                setHighlightedPhotoId(null);
                highlightTimeoutRef.current = null;
            }, 3500);
        }
    }, []);

    return (
        <AlbumEditorContext.Provider
            value={{
                previewPhotoGap,
                setPreviewPhotoGap,
                previewPageMargin,
                setPreviewPageMargin,
                previewCornerRadius,
                setPreviewCornerRadius,
                registerGalleryScroll,
                scrollToGallery,
                highlightedPhotoId,
                activeAlbumDrag,
                setActiveAlbumDrag,
                activeGalleryDrag,
                setActiveGalleryDrag,
            }}
        >
            {children}
        </AlbumEditorContext.Provider>
    );
}

export function useAlbumEditor() {
    const context = useContext(AlbumEditorContext);
    if (context === undefined) {
        throw new Error('useAlbumEditor must be used within an AlbumEditorProvider');
    }
    return context;
}

export function useOptionalAlbumEditor() {
    return useContext(AlbumEditorContext);
}
