'use client';

import dynamic from 'next/dynamic';
import { AlbumLoadingSkeleton } from './album-loading-skeleton';

const AlbumEditor = dynamic(
    () => import('./album-editor').then((mod) => mod.AlbumEditor),
    {
        loading: () => <AlbumLoadingSkeleton />,
        ssr: false,
    }
);

interface AlbumEditorWrapperProps {
    albumId: string;
}

export function AlbumEditorWrapper({ albumId }: AlbumEditorWrapperProps) {
    return <AlbumEditor albumId={albumId} />;
}
