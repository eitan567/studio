'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AlbumPreviewContextType {
    previewPhotoGap: number | null;
    setPreviewPhotoGap: (value: number | null) => void;
    previewPageMargin: number | null;
    setPreviewPageMargin: (value: number | null) => void;
    previewCornerRadius: number | null;
    setPreviewCornerRadius: (value: number | null) => void;
}

const AlbumPreviewContext = createContext<AlbumPreviewContextType | undefined>(undefined);

export function AlbumPreviewProvider({ children }: { children: ReactNode }) {
    const [previewPhotoGap, setPreviewPhotoGap] = useState<number | null>(null);
    const [previewPageMargin, setPreviewPageMargin] = useState<number | null>(null);
    const [previewCornerRadius, setPreviewCornerRadius] = useState<number | null>(null);

    return (
        <AlbumPreviewContext.Provider
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
        </AlbumPreviewContext.Provider>
    );
}

export function useAlbumPreview() {
    const context = useContext(AlbumPreviewContext);
    if (context === undefined) {
        throw new Error('useAlbumPreview must be used within an AlbumPreviewProvider');
    }
    return context;
}
