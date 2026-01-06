import React, { useMemo, useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { AlbumPage, AlbumConfig } from '@/lib/types';
import { AlbumCover } from './album-cover';
import { PhotoRenderer } from './photo-renderer';
import { LAYOUT_TEMPLATES } from './layout-templates';
import { cn } from '@/lib/utils';

interface BookViewOverlayProps {
    pages: AlbumPage[];
    config: AlbumConfig;
    onClose: () => void;
}

interface Spread {
    left: AlbumPage | null;
    right: AlbumPage | null;
    isCover?: boolean;
    isBackCover?: boolean;
}

// Helper to render a single page face (read-only)
function ReadOnlyPage({ page, config }: { page: AlbumPage; config: AlbumConfig }) {
    const template = LAYOUT_TEMPLATES.find(t => t.id === page.layout) || LAYOUT_TEMPLATES[0];
    const photos = page.photos || [];

    return (
        <div
            className="grid grid-cols-12 grid-rows-12 h-full w-full bg-white shadow-sm"
            style={{
                gap: `${config.photoGap}px`,
                padding: `${config.pageMargin}px`,
                backgroundColor: config.backgroundColor,
                backgroundImage: (page.backgroundImage || config.backgroundImage) ? `url(${page.backgroundImage || config.backgroundImage})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            {photos.slice(0, template.photoCount).map((photo, index) => (
                <div
                    key={photo.id}
                    className={cn(
                        'relative overflow-hidden bg-muted pointer-events-none',
                        template.grid[index]
                    )}
                >
                    <PhotoRenderer
                        photo={photo}
                        onUpdate={() => { }}
                        onInteractionChange={() => { }}
                    />
                </div>
            ))}
        </div>
    );
}

export function BookViewOverlay({ pages, config, onClose }: BookViewOverlayProps) {
    const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);

    // Build Spreads Logic (mimicking reference)
    const spreads = useMemo(() => {
        const newSpreads: Spread[] = [];
        if (pages.length === 0) return newSpreads;

        // Separate Cover and Inner Pages
        // Allowing for flexibility, but typically pages[0] is cover.
        const frontCover = pages.find(p => p.isCover) || pages[0];
        const innerPages = pages.filter(p => !p.isCover && p !== frontCover);

        // 1. Front Cover (Right side)
        newSpreads.push({ left: null, right: frontCover, isCover: true });

        // 2. Inner Spreads
        let i = 0;
        while (i < innerPages.length) {
            // If we have a pair, add them.
            // If we have one left over at the end, it goes to LEFT.
            const left = innerPages[i];
            const right = innerPages[i + 1] || null;

            newSpreads.push({ left, right });
            i += 2;
        }

        // 3. Back Cover
        // Explicitly add a spread for the back cover (appearing on the Left)
        if (frontCover) {
            newSpreads.push({ left: frontCover, right: null, isBackCover: true });
        }

        return newSpreads;
    }, [pages]);

    const goToNext = () => {
        if (currentSpreadIndex < spreads.length - 1) {
            setCurrentSpreadIndex(prev => prev + 1);
        }
    };

    const goToPrev = () => {
        if (currentSpreadIndex > 0) {
            setCurrentSpreadIndex(prev => prev - 1);
        }
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevent default scrolling only if we are consuming the event
            if (e.key === 'ArrowRight') {
                // e.preventDefault();
                goToNext();
            }
            if (e.key === 'ArrowLeft') {
                // e.preventDefault();
                goToPrev();
            }
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentSpreadIndex, spreads.length, onClose]);

    if (spreads.length === 0) return null;

    const currentSpread = spreads[currentSpreadIndex];

    return (
        <div className="fixed inset-0 z-50 bg-[#1a1a1a] flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-300">
            {/* Background Texture */}
            <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle at center, #333 0%, #000 100%)' }}
            />

            {/* Header Controls */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 text-white/80">
                <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5" />
                    <div className="flex flex-col">
                        <span className="font-bold text-lg leading-none text-white">Album Preview</span>
                        <span className="text-xs opacity-70 font-medium tracking-wide">
                            SPREAD {currentSpreadIndex + 1} / {spreads.length}
                        </span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-all flex items-center gap-2 text-sm font-medium"
                >
                    <X className="w-4 h-4" /> Exit Preview
                </button>
            </div>

            {/* Book Stage */}
            <div className="relative flex items-center justify-center w-full h-full p-4 md:p-10 perspective-[2000px]">

                {/* Previous Button */}
                <button
                    onClick={goToPrev}
                    disabled={currentSpreadIndex === 0}
                    className="absolute left-4 md:left-8 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-0 text-white transition-all backdrop-blur-md shadow-lg"
                >
                    <ChevronLeft className="w-8 h-8" />
                </button>

                {/* The Book Container */}
                <div
                    className="relative flex shadow-2xl transition-transform duration-500 ease-out"
                    style={{
                        // Constrain height and maintain aspect ratio
                        // Assuming 2:1 spread
                        height: 'min(85vh, 60vw)', // Dynamic sizing
                        aspectRatio: '2 / 1',
                        maxHeight: '900px'
                    }}
                >
                    {/* Left Page */}
                    <div
                        className={cn(
                            "flex-1 relative overflow-hidden transition-opacity duration-500 bg-white border-r border-[#ccc]",
                            currentSpread.left ? "opacity-100" : "opacity-0"
                        )}
                        style={{
                            borderTopLeftRadius: '4px',
                            borderBottomLeftRadius: '4px'
                        }}
                    >
                        {currentSpread.left && (
                            <div className="w-full h-full relative">
                                {/* Inner Gradient Shadow (Spine) */}
                                <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/20 to-transparent z-20 pointer-events-none mix-blend-multiply" />

                                {/* Render Content */}
                                {currentSpread.isBackCover ? (
                                    <AlbumCover
                                        page={currentSpread.left}
                                        config={config}
                                        mode="preview"
                                        activeView="back"
                                    />
                                ) : (
                                    <ReadOnlyPage page={currentSpread.left} config={config} />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Spine / Center Fold Visual */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-0 z-30 shadow-[0_0_30px_5px_rgba(0,0,0,0.4)]" />

                    {/* Right Page */}
                    <div
                        className={cn(
                            "flex-1 relative overflow-hidden transition-opacity duration-500 bg-white",
                            currentSpread.right ? "opacity-100" : "opacity-0"
                        )}
                        style={{
                            borderTopRightRadius: '4px',
                            borderBottomRightRadius: '4px'
                        }}
                    >
                        {currentSpread.right && (
                            <div className="w-full h-full relative">
                                {/* Inner Gradient Shadow (Spine) */}
                                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/20 to-transparent z-20 pointer-events-none mix-blend-multiply" />

                                {/* Render Content */}
                                {currentSpread.isCover ? (
                                    <AlbumCover
                                        page={currentSpread.right}
                                        config={config}
                                        mode="preview"
                                        activeView="front"
                                    />
                                ) : (
                                    <ReadOnlyPage page={currentSpread.right} config={config} />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Next Button */}
                <button
                    onClick={goToNext}
                    disabled={currentSpreadIndex === spreads.length - 1}
                    className="absolute right-4 md:right-8 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-0 text-white transition-all backdrop-blur-md shadow-lg"
                >
                    <ChevronRight className="w-8 h-8" />
                </button>

            </div>

            {/* Footer Info */}
            <div className="absolute bottom-4 text-white/40 text-xs tracking-widest uppercase pointer-events-none">
                {currentSpread.isCover ? 'Front Cover' :
                    currentSpread.isBackCover ? 'Back Cover' : 'Open Album'}
            </div>
        </div>
    );
}
