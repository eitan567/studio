import React, { useMemo, useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, BookOpen, ChevronsLeft, ChevronsRight, CornerDownRight } from 'lucide-react';
import { AlbumPage, AlbumConfig, PhotoPanAndZoom } from '@/lib/types';
import { AlbumCover } from './album-cover';
import { PhotoRenderer } from '../layouts/photo-renderer';
import { LAYOUT_TEMPLATES } from '@/hooks/useTemplates';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/use-settings';

// Same fold-shadow component used by the album editor for regular spread pages
function SpineEffectOverlay() {
    const { settings } = useSettings();
    const { spineEffectSpread, spineEffectColor, spineEffectColorOpacity, spineEffectWidth, spineEffectOpacity, spineEffectCenterOpacity } = settings;
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    return (
        <>
            <div className="absolute top-0 bottom-0 pointer-events-none z-40" style={{ left: `calc(50% - ${spineEffectWidth}px)`, width: `${spineEffectWidth}px`, background: `linear-gradient(to left, rgba(0,0,0,${spineEffectOpacity}), transparent)` }} />
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] z-40" style={{ backgroundColor: hexToRgba(spineEffectColor, spineEffectColorOpacity) }}>
                <div className="absolute inset-y-0 pointer-events-none mix-blend-multiply" style={{ left: `-${spineEffectSpread}px`, right: `-${spineEffectSpread}px`, background: `linear-gradient(to right, transparent, rgba(0,0,0,${spineEffectCenterOpacity}), transparent)` }} />
            </div>
            <div className="absolute top-0 bottom-0 left-1/2 pointer-events-none z-40" style={{ width: `${spineEffectWidth}px`, background: `linear-gradient(to right, rgba(0,0,0,${spineEffectOpacity}), transparent)` }} />
        </>
    );
}

interface BookViewOverlayProps {
    pages: AlbumPage[];
    config: AlbumConfig;
    onClose: () => void;
    onUpdatePage?: (pageId: string, updatedPage: AlbumPage) => void;
}

interface Spread {
    left: AlbumPage | null;
    right: AlbumPage | null;
    isCover?: boolean;
    isBackCover?: boolean;
    isPanoramic?: boolean;
    pageLabel: string;
    pageStart?: number;
    pageEnd?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PanoramicSpreadViewer
// Renders a full-spread page as ONE unified, interactive image across both pages.
// The overlay covers the entire book container (2:1 aspect ratio), and AlbumCover
// renders the spread at width:100% of that container — identical to the two-halves
// approach but without the seam. Pan/zoom is editable and saved.
// ─────────────────────────────────────────────────────────────────────────────
function PanoramicSpreadViewer({
    page,
    config,
    onUpdatePage,
}: {
    page: AlbumPage;
    config: AlbumConfig;
    onUpdatePage?: (updatedPage: AlbumPage) => void;
}) {
    const localPageRef = useRef<AlbumPage>(page);

    // Sync ref when navigating to a different spread (page ID changes)
    const prevIdRef = useRef(page.id);
    if (prevIdRef.current !== page.id) {
        prevIdRef.current = page.id;
        localPageRef.current = page;
    }

    // IMPORTANT: PhotoRenderer calls onInteractionChange(false) BEFORE onUpdate (commitChanges).
    // Therefore we must save here — onUpdate fires exactly once at drag end.
    // Do NOT wait for onInteractionChange; it fires too early.
    const handleUpdatePhotoPanAndZoom = (_pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => {
        const updated = {
            ...localPageRef.current,
            photos: localPageRef.current.photos.map(ph =>
                ph.id === photoId ? { ...ph, panAndZoom } : ph
            ),
        };
        localPageRef.current = updated;
        // Save immediately to the album
        onUpdatePage?.(updated);
    };

    return (
        <div className="absolute inset-0 z-[15] rounded-[4px] overflow-hidden">
            <AlbumCover
                page={page}
                config={config}
                mode="preview"
                activeView="full"
                useSimpleImage={false}
                onUpdatePhotoPanAndZoom={handleUpdatePhotoPanAndZoom}
            />
            {onUpdatePage && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 bg-black/60 text-white/80 text-[11px] px-3 py-1.5 rounded-full pointer-events-none select-none whitespace-nowrap">
                    Drag photos to reposition · Saves automatically
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// BookViewOverlay
// ─────────────────────────────────────────────────────────────────────────────
export function BookViewOverlay({ pages, config, onClose, onUpdatePage }: BookViewOverlayProps) {
    const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);

    // Build Spreads
    const spreads = useMemo(() => {
        const newSpreads: Spread[] = [];
        if (pages.length === 0) return newSpreads;

        const frontCover = pages.find(p => p.isCover) || pages[0];
        const innerPages = pages.filter(p => !p.isCover && p !== frontCover);
        let pageCounter = 1;

        // 1. Front Cover (right side only)
        newSpreads.push({ left: null, right: frontCover, isCover: true, pageLabel: 'Front Cover', pageStart: 0, pageEnd: 0 });

        let i = 0;

        // First inner page might be a lone single on the right
        if (innerPages.length > 0 && innerPages[0].type === 'single') {
            newSpreads.push({ left: null, right: innerPages[0], pageLabel: `Page ${pageCounter}`, pageStart: pageCounter, pageEnd: pageCounter });
            pageCounter++;
            i++;
        }

        while (i < innerPages.length) {
            const current = innerPages[i];

            if (current.type === 'spread') {
                const start = pageCounter;
                const end = pageCounter + 1;
                newSpreads.push({ left: current, right: current, isPanoramic: true, pageLabel: `Pages ${start}-${end}`, pageStart: start, pageEnd: end });
                pageCounter += 2;
                i++;
            } else {
                const next = innerPages[i + 1];
                if (next && next.type === 'single') {
                    const start = pageCounter;
                    const end = pageCounter + 1;
                    newSpreads.push({ left: current, right: next, pageLabel: `Pages ${start}-${end}`, pageStart: start, pageEnd: end });
                    pageCounter += 2;
                    i += 2;
                } else {
                    const cur = pageCounter;
                    newSpreads.push({ left: current, right: null, pageLabel: `Page ${cur}`, pageStart: cur, pageEnd: cur });
                    pageCounter++;
                    i++;
                }
            }
        }

        // 3. Back Cover
        if (frontCover) {
            newSpreads.push({ left: frontCover, right: null, isBackCover: true, pageLabel: 'Back Cover', pageStart: 0, pageEnd: 0 });
        }

        return newSpreads;
    }, [pages]);

    const goToNext = () => {
        if (currentSpreadIndex < spreads.length - 1) setCurrentSpreadIndex(prev => prev + 1);
    };
    const goToPrev = () => {
        if (currentSpreadIndex > 0) setCurrentSpreadIndex(prev => prev - 1);
    };

    React.useEffect(() => {
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
            {/* Background */}
            <div className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle at center, #333 0%, #000 100%)' }} />

            {/* Header */}
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
                <button onClick={onClose}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-all flex items-center gap-2 text-sm font-medium">
                    <X className="w-4 h-4" /> Exit Preview
                </button>
            </div>

            {/* Book Stage */}
            <div className="relative flex items-center justify-center w-full h-full p-4 md:p-10">

                <button onClick={goToPrev} disabled={currentSpreadIndex === 0}
                    className="absolute left-4 md:left-8 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-0 text-white transition-all backdrop-blur-md shadow-lg">
                    <ChevronLeft className="w-8 h-8" />
                </button>

                {/* ── The Book ── */}
                <div
                    className="relative flex shadow-2xl"
                    style={{ height: 'min(85vh, 60vw)', aspectRatio: '2 / 1', maxHeight: '900px' }}
                >
                    {/* Page label */}
                    <div className="absolute -top-8 w-full text-center text-white/40 text-xs tracking-widest uppercase pointer-events-none">
                        {currentSpread.pageLabel}
                    </div>

                    {/* Left Page — white background pane */}
                    <div
                        className={cn(
                            'flex-1 relative overflow-hidden transition-opacity duration-500 bg-white',
                            // Show border-r only for non-panoramic (panoramic has overlay without seam)
                            !currentSpread.isPanoramic && 'border-r border-[#ccc]',
                            currentSpread.left || (!currentSpread.isCover && !currentSpread.isPanoramic) ? 'opacity-100' : 'opacity-0'
                        )}
                        style={{ borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px' }}
                    >
                        {/* Spine shadow — not shown for panoramic (overlay handles it) */}
                        {!currentSpread.isPanoramic && (
                            <div className={cn(
                                'absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/20 to-transparent z-20 pointer-events-none mix-blend-multiply',
                                !currentSpread.left && currentSpread.isCover ? 'hidden' : 'block'
                            )} />
                        )}

                        {/* Content for non-panoramic left page */}
                        {currentSpread.left && !currentSpread.isPanoramic && (
                            <div className="w-full h-full relative">
                                {currentSpread.isBackCover ? (
                                    <AlbumCover page={currentSpread.left} config={config} mode="preview" activeView="back" />
                                ) : (
                                    <AlbumCover page={currentSpread.left} config={config} mode="preview" activeView="full" />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Panoramic overlay — covers both pages as one unified image */}
                    {currentSpread.isPanoramic && currentSpread.left && (
                        <PanoramicSpreadViewer
                            page={currentSpread.left}
                            config={config}
                            onUpdatePage={
                                onUpdatePage
                                    ? (updated) => onUpdatePage(updated.id, updated)
                                    : undefined
                            }
                        />
                    )}

                    {/* Spine fold visual:
                         - Cover/back-cover: the real Spine component is rendered by AlbumCover internally
                         - Panoramic spread pages: SpineEffectOverlay (same fold shadow as album editor)
                         - Non-panoramic two-page spreads: SpineEffectOverlay between the two pages
                    */}
                    {currentSpread.isPanoramic
                        ? <SpineEffectOverlay />
                        : !currentSpread.isCover && !currentSpread.isBackCover && <SpineEffectOverlay />
                    }
                    <div
                        className={cn(
                            'flex-1 relative overflow-hidden transition-opacity duration-500 bg-white',
                            currentSpread.right || (!currentSpread.isBackCover && !currentSpread.isPanoramic) ? 'opacity-100' : 'opacity-0'
                        )}
                        style={{ borderTopRightRadius: '4px', borderBottomRightRadius: '4px' }}
                    >
                        {/* Spine shadow — not for panoramic */}
                        {!currentSpread.isPanoramic && (
                            <div className={cn(
                                'absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/20 to-transparent z-20 pointer-events-none mix-blend-multiply',
                                !currentSpread.right && currentSpread.isBackCover ? 'hidden' : 'block'
                            )} />
                        )}

                        {/* Content for non-panoramic right page */}
                        {currentSpread.right && !currentSpread.isPanoramic && (
                            <div className="w-full h-full relative">
                                {currentSpread.isCover ? (
                                    <AlbumCover page={currentSpread.right} config={config} mode="preview" activeView="front" />
                                ) : (
                                    <AlbumCover page={currentSpread.right} config={config} mode="preview" activeView="full" />
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Panoramic Overlay ──
                        For spread pages: a SINGLE AlbumCover fills the entire 2:1 book container.
                        AlbumCover with activeView="full" renders at width:100% of THIS overlay div,
                        which equals the full book width → correct 2:1 spread, no seam.
                        The two white page divs behind provide the book-like background.
                    */}
                    {currentSpread.isPanoramic && currentSpread.left && (
                        <PanoramicSpreadViewer
                            page={currentSpread.left}
                            config={config}
                            onUpdatePage={
                                onUpdatePage
                                    ? (updated) => onUpdatePage(updated.id, updated)
                                    : undefined
                            }
                        />
                    )}
                </div>

                <button onClick={goToNext} disabled={currentSpreadIndex === spreads.length - 1}
                    className="absolute right-4 md:right-8 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-0 text-white transition-all backdrop-blur-md shadow-lg">
                    <ChevronRight className="w-8 h-8" />
                </button>
            </div>

            {/* Footer Navigation */}
            <div className="absolute bottom-4 z-50">
                <BookNavigationControls
                    currentIndex={currentSpreadIndex}
                    totalSpreads={spreads.length}
                    spreads={spreads}
                    onJump={(idx) => setCurrentSpreadIndex(idx)}
                />
            </div>
        </div>
    );
}

function BookNavigationControls({ currentIndex, totalSpreads, spreads, onJump }: {
    currentIndex: number; totalSpreads: number; spreads: Spread[]; onJump: (idx: number) => void;
}) {
    const [targetSpread, setTargetSpread] = useState<string>('');

    const handleJump = () => {
        const pageNum = parseInt(targetSpread);
        if (!isNaN(pageNum)) {
            const idx = spreads.findIndex(s =>
                s.pageStart && s.pageEnd && pageNum >= s.pageStart && pageNum <= s.pageEnd
            );
            if (idx !== -1) { onJump(idx); setTargetSpread(''); }
            else if (pageNum === 0) { onJump(0); setTargetSpread(''); }
        }
    };

    return (
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-2xl">
            <button onClick={() => onJump(0)} disabled={currentIndex === 0}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors disabled:opacity-30" title="Jump to Start">
                <ChevronsLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 mx-1 bg-white/5 rounded-full px-2 py-0.5 border border-white/5 focus-within:border-white/20 transition-colors">
                <input type="number"
                    className="w-8 bg-transparent text-center text-sm text-white focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none font-mono"
                    placeholder="#" value={targetSpread}
                    onChange={(e) => setTargetSpread(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                />
                <button onClick={handleJump} disabled={!targetSpread}
                    className="p-1 rounded-full hover:bg-white/20 text-white/50 hover:text-white transition-colors disabled:opacity-0">
                    <CornerDownRight className="w-3 h-3" />
                </button>
            </div>
            <button onClick={() => onJump(totalSpreads - 1)} disabled={currentIndex === totalSpreads - 1}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors disabled:opacity-30" title="Jump to End">
                <ChevronsRight className="w-4 h-4" />
            </button>
        </div>
    );
}
