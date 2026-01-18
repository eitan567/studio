import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { toBlob } from 'html-to-image';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { AlbumPage, AlbumConfig } from '@/lib/types';
import { PageLayout } from './page-layout';
import { AlbumCover, StaticCoverText, StaticCoverImage } from './album-cover';
import { LAYOUT_TEMPLATES, ADVANCED_TEMPLATES, getPhotoCount } from '@/hooks/useTemplates';
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
    exportPage: (pageId: string) => Promise<void>;
    exportToPdf: () => Promise<void>;
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
                        pixelRatio: 4, // 4x resolution to compensate for smaller base size (500px -> 2000px)
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
        },
        exportPage: async (pageId: string) => {
            try {
                if (!containerRef.current) return;

                const exportContainer = containerRef.current;
                const pageElement = Array.from(exportContainer.children).find(
                    (el) => (el as HTMLElement).dataset.pageId === pageId
                ) as HTMLElement;

                if (!pageElement) {
                    console.error(`Page element with ID ${pageId} not found`);
                    return;
                }

                // Brief wait to ensure stable rendering if needed
                await new Promise(r => setTimeout(r, 500));

                const isSpread = pageElement.dataset.isSpread === 'true';
                const isCover = pageElement.dataset.isCover === 'true';

                const blob = await toBlob(pageElement, {
                    quality: 0.95,
                    pixelRatio: 4,
                    skipAutoScale: true,
                    fontEmbedCSS: '',
                    cacheBust: false,
                });

                if (blob) {
                    let filename = `page-${pageId.slice(0, 8)}.png`;
                    if (isCover) filename = `cover.png`;
                    else if (isSpread) filename = `spread-${pageId.slice(0, 8)}.png`;

                    saveAs(blob, filename);
                }

            } catch (err) {
                console.error("Single page export failed:", err);
                onExportError?.(err);
            }
        },
        exportToPdf: async () => {
            try {
                if (!containerRef.current) return;
                onExportStart?.();

                const exportContainer = containerRef.current;

                // Wait for rendering
                await new Promise(r => setTimeout(r, 1000));

                const pageElements = Array.from(exportContainer.children) as HTMLElement[];
                const total = pageElements.length;

                // Initialize PDF
                // We'll determine orientation based on the first page, but typically albums are landscape-ish or square.
                // A4 is 210x297mm. 
                // We will create a PDF where each page matches the image dimensions.
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'px',
                    hotfixes: ['px_scaling']
                });

                // Clear initial page if we want to set specific dimensions per page
                pdf.deletePage(1);

                for (let i = 0; i < total; i++) {
                    const element = pageElements[i];
                    onExportProgress?.(i + 1, total);

                    const blob = await toBlob(element, {
                        quality: 0.95,
                        pixelRatio: 2, // 2x is enough for PDF usually, keeping it optimized
                        skipAutoScale: true,
                        fontEmbedCSS: '',
                        cacheBust: false,
                    });

                    if (blob) {
                        // Create a URL for the blob
                        const imgData = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });

                        const imgProps = pdf.getImageProperties(imgData);
                        const pdfWidth = imgProps.width;
                        const pdfHeight = imgProps.height;

                        // Add new page with the dimensions of the image
                        pdf.addPage([pdfWidth, pdfHeight], pdfWidth > pdfHeight ? 'landscape' : 'portrait');
                        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                    }
                }

                pdf.save(`album-export-${new Date().toISOString().split('T')[0]}.pdf`);
                onExportComplete?.();
            } catch (err) {
                console.error("PDF Export failed:", err);
                onExportError?.(err);
            }
        }
    }));

    // Render all pages in a hidden container
    // We use fixed width to ensure consistency regardless of screen size
    // Single: 500px (approx editor preview), Spread: 1000px
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
                const width = isSpread ? 1000 : 500;
                const height = 500; // 2:1 ratio for spread, 1:1 for single (assuming square format preference in config, typically 20x20 is square)
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
                            padding: page.isCover ? 0 : `${page.pageMargin ?? config.pageMargin}px`,
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
                                                fontSize: `${(page.titleFontSize || 24)}px`, // No scaling needed as base is approx preview size
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
                            ) : (isSpread && !page.isCover) ? (
                                (() => {
                                    const isSplit = page.spreadMode === 'split';
                                    if (isSplit) {
                                        const leftLayoutId = page.spreadLayouts?.left || LAYOUT_TEMPLATES[0].id;
                                        const rightLayoutId = page.spreadLayouts?.right || LAYOUT_TEMPLATES[0].id; // unused for slice, but good for consistency
                                        const leftTemplate = LAYOUT_TEMPLATES.find(t => t.id === leftLayoutId) || ADVANCED_TEMPLATES.find(t => t.id === leftLayoutId) || LAYOUT_TEMPLATES[0];
                                        const leftPhotos = page.photos.slice(0, getPhotoCount(leftTemplate));
                                        const rightPhotos = page.photos.slice(getPhotoCount(leftTemplate));

                                        return (
                                            <div
                                                className="relative h-full w-full flex"
                                                style={{ gap: `${(page.photoGap ?? config.photoGap) * 2}px` }}
                                            >
                                                <div className="h-full flex-1 min-w-0">
                                                    <PageLayout
                                                        page={page}
                                                        photoGap={page.photoGap ?? config.photoGap}
                                                        overridePhotos={leftPhotos}
                                                        overrideLayout={leftLayoutId}
                                                        onUpdatePhotoPanAndZoom={() => { }}
                                                        onInteractionChange={() => { }}
                                                        onDropPhoto={() => { }}
                                                        useSimpleImage={true}
                                                    />
                                                </div>
                                                <div className="h-full flex-1 min-w-0">
                                                    <PageLayout
                                                        page={page}
                                                        photoGap={page.photoGap ?? config.photoGap}
                                                        overridePhotos={rightPhotos}
                                                        overrideLayout={rightLayoutId}
                                                        onUpdatePhotoPanAndZoom={() => { }}
                                                        onInteractionChange={() => { }}
                                                        onDropPhoto={() => { }}
                                                        useSimpleImage={true}
                                                        photoIndexOffset={getPhotoCount(leftTemplate)}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="relative h-full w-full">
                                            <PageLayout
                                                page={page}
                                                photoGap={page.photoGap ?? config.photoGap}
                                                onUpdatePhotoPanAndZoom={() => { }}
                                                onInteractionChange={() => { }}
                                                onDropPhoto={() => { }}
                                                useSimpleImage={true}
                                            />
                                        </div>
                                    );
                                })()
                            ) : (
                                <PageLayout
                                    page={page}
                                    photoGap={page.photoGap ?? config.photoGap}
                                    onUpdatePhotoPanAndZoom={() => { }}
                                    onInteractionChange={() => { }}
                                    onDropPhoto={() => { }}
                                    useSimpleImage={true}
                                />
                            )}
                        </div>

                        {/* Overlays for Regular Pages */}
                        {!page.isCover && (
                            <>
                                {page.coverTexts?.map(textItem => {
                                    // Calculate font size in pixels relative to the export container width
                                    // Spreads use 3200 (full view).
                                    // Single pages in editor use 3200 logic but seemingly render slightly larger visually?
                                    // Tuning single page reference to 3000 to match user expectation ("tiny bit small" -> larger text).
                                    const referenceWidth = isSpread ? 3200 : 3000;
                                    const fontSizePx = (textItem.style.fontSize / referenceWidth) * width;

                                    return (
                                        <StaticCoverText
                                            key={textItem.id}
                                            item={textItem}
                                            fontSizeOverride={`${fontSizePx}px`}
                                        />
                                    );
                                })}
                                {page.coverImages?.map(imageItem => (
                                    <StaticCoverImage key={imageItem.id} item={imageItem} />
                                ))}
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
});

AlbumExporter.displayName = 'AlbumExporter';
