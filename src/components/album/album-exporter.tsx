import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { toBlob } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { AlbumPage, AlbumConfig } from '@/lib/types';
import { PageLayout } from './page-layout';
import { AlbumCover } from './album-cover';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';

interface AlbumExporterProps {
    pages: AlbumPage[];
    config: AlbumConfig;
    onExportStart?: () => void;
    onExportProgress?: (current: number, total: number) => void;
    onExportComplete?: () => void;
    onExportError?: (error: any) => void;
}

export interface AlbumExporterRef {
    exportAlbum: () => Promise<void>;
}

export const AlbumExporter = forwardRef<AlbumExporterRef, AlbumExporterProps>(({
    pages,
    config,
    onExportStart,
    onExportProgress,
    onExportComplete,
    onExportError
}, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
        exportAlbum: async () => {
            try {
                if (!containerRef.current) return;
                onExportStart?.();

                const zip = new JSZip();
                const exportContainer = containerRef.current;

                // We need to wait a moment for the images to load if they were just mounted?
                // Since we render them always (but hidden), they might be ready.
                // But `html-to-image` is better if we give it a tick.
                await new Promise(r => setTimeout(r, 1000));

                const pageElements = Array.from(exportContainer.children) as HTMLElement[];
                const total = pageElements.length;

                for (let i = 0; i < total; i++) {
                    const element = pageElements[i];
                    const pageId = element.dataset.pageId;
                    const isSpread = element.dataset.isSpread === 'true';
                    const isCover = element.dataset.isCover === 'true';

                    onExportProgress?.(i + 1, total);

                    // Capture
                    const blob = await toBlob(element, {
                        quality: 0.95,
                        pixelRatio: 2, // 2x resolution for better quality
                        skipAutoScale: true, // We want to capture exactly what is rendered
                        fontEmbedCSS: '', // Disable font embedding to avoid CORS issues
                        cacheBust: false, // Disable cache bust to see if it fixes duplication
                    });

                    if (blob) {
                        let filename = `page-${String(i + 1).padStart(3, '0')}.png`;
                        if (isCover) filename = `cover.png`;
                        else if (isSpread) filename = `spread-${String(i + 1).padStart(3, '0')}.png`;

                        zip.file(filename, blob);
                    }
                }

                // Generate ZIP
                const content = await zip.generateAsync({ type: 'blob' });
                saveAs(content, `album-export-${new Date().toISOString().split('T')[0]}.zip`);

                onExportComplete?.();
            } catch (err) {
                console.error("Export failed:", err);
                onExportError?.(err);
            }
        }
    }));

    // Render all pages in a hidden container
    // We use fixed width to ensure consistency regardless of screen size
    // Single: 1000px, Spread: 2000px
    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                top: '-10000px',
                left: '-10000px',
                width: 'auto', // Allow children to define width
                height: 'auto',
                overflow: 'hidden',
                pointerEvents: 'none',
                display: 'flex', // stack them horizontally or vertically, doesn't matter much as long as they don't overlap in a way that breaks capture
                flexDirection: 'column',
            }}
        >
            {pages.map((page, index) => {
                const isSpread = page.type === 'spread' || page.isCover;
                const width = isSpread ? 2000 : 1000;
                const height = 1000; // 2:1 ratio for spread, 1:1 for single (assuming square format preference in config, typically 20x20 is square)
                // Note: The app supports 20x20 which is square. So Single is Square. Spread is 2 Squares (2:1).

                return (
                    <div
                        key={page.id}
                        data-page-id={page.id}
                        data-is-spread={isSpread}
                        data-is-cover={page.isCover}
                        style={{
                            width: `${width}px`,
                            height: `${height}px`,
                            marginBottom: '20px', // spacing to avoid bleed during capture if careless
                            position: 'relative',
                            backgroundColor: page.backgroundColor || config.backgroundColor || '#ffffff',
                        }}
                    >
                        {/* Background Image Layer */}
                        {(page.backgroundImage || config.backgroundImage) && (
                            <div
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundImage: `url(${page.backgroundImage || config.backgroundImage})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    zIndex: 0
                                }}
                            />
                        )}

                        <div style={{
                            position: 'relative',
                            width: '100%',
                            height: '100%',
                            zIndex: 1,
                            padding: page.isCover ? 0 : `${config.pageMargin}px`,
                            boxSizing: 'border-box'
                        }}>
                            {page.isCover ? (
                                <div className="relative h-full w-full">
                                    <AlbumCover
                                        page={page}
                                        config={config}
                                        mode="preview"
                                        activeView="full"
                                        onUpdateTitleSettings={() => { }}
                                        onDropPhoto={() => { }}
                                        onUpdatePhotoPanAndZoom={() => { }}
                                        useSimpleImage={true}
                                    />
                                    {/* Title Overlay for Cover */}
                                    {page.titleText && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: `${page.titlePosition?.x || 50}%`,
                                                top: `${page.titlePosition?.y || 50}%`,
                                                transform: 'translate(-50%, -50%)',
                                                fontSize: `${(page.titleFontSize || 24) * 2}px`, // Scale font size if we scaled container? 
                                                // Actually, if we use standard px units in editor (e.g. 24px) but render at 1000px height...
                                                // Editor view is usually ~400-600px height. 
                                                // So 1000px height is ~2x. We might need to scale font size?
                                                // DraggableTitle in preview uses px.
                                                // If the capture container is larger than screen, px text remains small.
                                                // If the user set 24px on a 500px screen, it looks X big.
                                                // On a 1000px image, 24px will look 0.5X big.
                                                // I should probably stick to a standard size or use a scaling factor.
                                                // For now, I'll trust the user's px settings or the flow.
                                                fontFamily: page.titleFontFamily,
                                                color: page.titleColor,
                                                whiteSpace: 'nowrap',
                                                zIndex: 40
                                            }}
                                        >
                                            {page.titleText}
                                        </div>
                                    )}
                                </div>
                            ) : isSpread ? (
                                <div className="relative h-full w-full">
                                    <PageLayout
                                        page={page}
                                        // Scale gap? If we render at 2000px width (approx 50-60cm?), 
                                        // and photoGap is 10px... 
                                        // It's probably fine to keep 1:1 if we assume the editor config is "px on a large canvas".
                                        photoGap={config.photoGap}
                                        onUpdatePhotoPanAndZoom={() => { }}
                                        onInteractionChange={() => { }}
                                        onDropPhoto={() => { }}
                                        useSimpleImage={true}
                                    />
                                </div>
                            ) : (
                                <PageLayout
                                    page={page}
                                    photoGap={config.photoGap}
                                    onUpdatePhotoPanAndZoom={() => { }}
                                    onInteractionChange={() => { }}
                                    onDropPhoto={() => { }}
                                    useSimpleImage={true}
                                />
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
});

AlbumExporter.displayName = 'AlbumExporter';
