'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const AlbumEditor = dynamic(
    () => import('./album-editor').then((mod) => mod.AlbumEditor),
    {
        loading: () => (
            <div className="flex items-center justify-center h-screen bg-background text-primary">
                <Loader2 className="h-10 w-10 animate-spin" />
            </div>
        ),
        ssr: false,
    }
);

interface AlbumEditorWrapperProps {
    albumId: string;
}

export function AlbumEditorWrapper({ albumId }: AlbumEditorWrapperProps) {
    return <AlbumEditor albumId={albumId} />;
}
