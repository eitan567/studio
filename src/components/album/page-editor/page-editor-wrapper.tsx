'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const PageEditor = dynamic(
    () => import('./page-editor').then((mod) => mod.PageEditor),
    {
        loading: () => (
            <div className="flex items-center justify-center h-screen bg-background text-primary">
                <Loader2 className="h-10 w-10 animate-spin" />
            </div>
        ),
        ssr: false,
    }
);

interface PageEditorWrapperProps {
    albumId: string;
}

export function PageEditorWrapper({ albumId }: PageEditorWrapperProps) {
    return <PageEditor albumId={albumId} />;
}
