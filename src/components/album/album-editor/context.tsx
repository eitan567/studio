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
