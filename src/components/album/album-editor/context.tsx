'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AlbumEditorContextType {
    previewPhotoGap: number | null;
    setPreviewPhotoGap: (value: number | null) => void;
    previewPageMargin: number | null;
    setPreviewPageMargin: (value: number | null) => void;
    previewCornerRadius: number | null;
    setPreviewCornerRadius: (value: number | null) => void;
}

const AlbumEditorContext = createContext<AlbumEditorContextType | undefined>(undefined);

export function AlbumEditorProvider({ children }: { children: ReactNode }) {
    const [previewPhotoGap, setPreviewPhotoGap] = useState<number | null>(null);
    const [previewPageMargin, setPreviewPageMargin] = useState<number | null>(null);
    const [previewCornerRadius, setPreviewCornerRadius] = useState<number | null>(null);

    return (
        <AlbumEditorContext.Provider
            value={{
                previewPhotoGap,
                setPreviewPhotoGap,
                previewPageMargin,
                setPreviewPageMargin,
                previewCornerRadius,
                setPreviewCornerRadius,
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
