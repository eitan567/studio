import React, { useMemo, useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, BookOpen, ChevronsLeft, ChevronsRight, CornerDownRight } from 'lucide-react';
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
    isPanoramic?: boolean;
}

// ReadOnlyPage removed in favor of direct AlbumCover usage for consistency


export function BookViewOverlay({ pages, config, onClose }: BookViewOverlayProps) {
    const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);

    // Build Spreads Logic
    const spreads = useMemo(() => {
        const newSpreads: Spread[] = [];
        if (pages.length === 0) return newSpreads;

        // Separate Cover and Inner Pages
        const frontCover = pages.find(p => p.isCover) || pages[0];
        const innerPages = pages.filter(p => !p.isCover && p !== frontCover);

        // 1. Front Cover (Right side)
        newSpreads.push({ left: null, right: frontCover, isCover: true });

        // 2. Inner Spreads
        let i = 0;

        // Check for Single Page at start
        if (innerPages.length > 0 && innerPages[0].type === 'single') {
            // First page is Single -> Place on Right, Left is Blank
            newSpreads.push({ left: null, right: innerPages[0] });
            i++;
        }

        while (i < innerPages.length) {
            const current = innerPages[i];

            // Layout Logic:
            if (current.type === 'spread') {
                // If it's a spread, it occupies BOTH sides.
                newSpreads.push({
                    left: current,
                    right: current,
                    isPanoramic: true
                });
                i++;
            } else {
                // It's a single page. Look for a partner.
                const next = innerPages[i + 1];

                if (next && next.type === 'single') {
                    // Pair two singles
                    newSpreads.push({ left: current, right: next });
                    i += 2;
                } else {
                    // Next is missing or is a spread -> Solitary Single on Left
                    newSpreads.push({ left: current, right: null });
                    i++;
                }
            }
        }

        // 3. Back Cover
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
            if (e.key === 'ArrowRight') goToNext();
            if (e.key === 'ArrowLeft') goToPrev();
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
                        height: 'min(85vh, 60vw)',
                        aspectRatio: '2 / 1',
                        maxHeight: '900px'
                    }}
                >
                    {/* Top Label */}
                    <div className="absolute -top-8 w-full text-center text-white/40 text-xs tracking-widest uppercase pointer-events-none">
                        {currentSpread.isCover ? 'Front Cover' :
                            currentSpread.isBackCover ? 'Back Cover' : 'Open Album'}
                    </div>

                    {/* Left Page */}
                    <div
                        className={cn(
                            "flex-1 relative overflow-hidden transition-opacity duration-500 bg-white border-r border-[#ccc]",
                            // Logic: If Left exists, Show. 
                            // If Empty Slot: Hide (Transparent) if Cover; Show (White) if Inner.
                            currentSpread.left || (!currentSpread.isCover && !currentSpread.isPanoramic) ? "opacity-100" : "opacity-0"
                        )}
                        style={{
                            borderTopLeftRadius: '4px',
                            borderBottomLeftRadius: '4px'
                        }}
                    >
                        {/* Inner Gradient Shadow (Spine) - Visible unless transparent */}
                        <div className={cn(
                            "absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/20 to-transparent z-20 pointer-events-none mix-blend-multiply",
                            !currentSpread.left && currentSpread.isCover ? "hidden" : "block"
                        )} />

                        {currentSpread.left && (
                            <div className={cn("w-full h-full relative", currentSpread.isPanoramic && "overflow-hidden")}>
                                {currentSpread.isBackCover ? (
                                    <AlbumCover
                                        page={currentSpread.left}
                                        config={config}
                                        mode="preview"
                                        activeView="back"
                                    />
                                ) : (
                                    <div className={cn(
                                        "w-full h-full",
                                        currentSpread.isPanoramic && "absolute top-0 left-0 w-[200%]" // Double width for panoramic left half
                                    )}>
                                        <AlbumCover
                                            page={currentSpread.left}
                                            config={config}
                                            mode="preview"
                                            activeView="full"
                                        />
                                    </div>
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
                            currentSpread.right || (!currentSpread.isBackCover && !currentSpread.isPanoramic) ? "opacity-100" : "opacity-0"
                        )}
                        style={{
                            borderTopRightRadius: '4px',
                            borderBottomRightRadius: '4px'
                        }}
                    >
                        {/* Inner Gradient Shadow (Spine) */}
                        <div className={cn(
                            "absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/20 to-transparent z-20 pointer-events-none mix-blend-multiply",
                            !currentSpread.right && currentSpread.isBackCover ? "hidden" : "block"
                        )} />

                        {currentSpread.right && (
                            <div className={cn("w-full h-full relative", currentSpread.isPanoramic && "overflow-hidden")}>
                                {currentSpread.isCover ? (
                                    <AlbumCover
                                        page={currentSpread.right}
                                        config={config}
                                        mode="preview"
                                        activeView="front"
                                    />
                                ) : (
                                    <div className={cn(
                                        "w-full h-full",
                                        currentSpread.isPanoramic && "absolute top-0 left-[-100%] w-[200%]" // Double width, shifted left for right half
                                    )}>
                                        <AlbumCover
                                            page={currentSpread.right}
                                            config={config}
                                            mode="preview"
                                            activeView="full"
                                        />
                                    </div>
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

            {/* Footer Navigation */}
            <div className="absolute bottom-4 z-50">
                <BookNavigationControls
                    currentIndex={currentSpreadIndex}
                    totalSpreads={spreads.length}
                    onJump={(idx) => setCurrentSpreadIndex(idx)}
                />
            </div>
        </div>
    );
}

function BookNavigationControls({ currentIndex, totalSpreads, onJump }: { currentIndex: number, totalSpreads: number, onJump: (idx: number) => void }) {
    const [targetSpread, setTargetSpread] = useState<string>("");

    const handleJump = () => {
        const pageNum = parseInt(targetSpread);
        if (!isNaN(pageNum)) {
            // User enters 1-based "Spread Number"
            // Clamp to valid range (1 to totalSpreads) -> Convert to 0-based index
            const idx = Math.max(0, Math.min(totalSpreads - 1, pageNum - 1));
            onJump(idx);
            setTargetSpread("");
        }
    };

    return (
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-2xl">
            <button
                onClick={() => onJump(0)}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors disabled:opacity-30"
                disabled={currentIndex === 0}
                title="Jump to Start"
            >
                <ChevronsLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 mx-1 bg-white/5 rounded-full px-2 py-0.5 border border-white/5 focus-within:border-white/20 transition-colors">
                <input
                    type="number"
                    className="w-8 bg-transparent text-center text-sm text-white focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none font-mono"
                    placeholder="#"
                    value={targetSpread}
                    onChange={(e) => setTargetSpread(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                />
                <button
                    onClick={handleJump}
                    disabled={!targetSpread}
                    className="p-1 rounded-full hover:bg-white/20 text-white/50 hover:text-white transition-colors disabled:opacity-0"
                >
                    <CornerDownRight className="w-3 h-3" />
                </button>
            </div>

            <button
                onClick={() => onJump(totalSpreads - 1)}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors disabled:opacity-30"
                disabled={currentIndex === totalSpreads - 1}
                title="Jump to End"
            >
                <ChevronsRight className="w-4 h-4" />
            </button>
        </div>
    );
}
