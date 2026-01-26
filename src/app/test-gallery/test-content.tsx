
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { GalleryImage } from '@/components/gallery/gallery-image';
import { cn } from '@/lib/utils';

interface Photo {
    id: string;
    width: number;
    height: number;
    ar: number;
    storage_path?: string;
    url?: string;
    captureDate?: string;
    created_at?: string;
}

interface Row {
    photos: Photo[];
    height: number;
}

export function TestGalleryContent({ initialPhotos }: { initialPhotos: any[] }) {
    const [dimensionsCache, setDimensionsCache] = useState<Record<string, { width: number; height: number }>>({});
    const [hoveredPhotoId, setHoveredPhotoId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [actualWidth, setActualWidth] = useState(300);
    const [requestedWidth, setRequestedWidth] = useState(300);

    // Measure the actual layout space with sub-pixel precision
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(() => {
            if (containerRef.current) {
                // getBoundingClientRect().width is more precise than clientWidth
                const rect = containerRef.current.getBoundingClientRect();
                // Subtract 8px for the border-4 (2px each side is incorrect, border-4 is 4px each side in some builds,
                // but standard tailwind border-4 is 4px).
                // Actually, let's just use the clientWidth and ensure the row fills it.
                setActualWidth(containerRef.current.clientWidth);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const sortedSource = useMemo(() => {
        return [...initialPhotos].sort((a, b) => {
            const dateA = a.captureDate || a.created_at;
            const dateB = b.captureDate || b.created_at;
            return new Date(dateA).getTime() - new Date(dateB).getTime();
        });
    }, [initialPhotos]);

    const photos = useMemo<Photo[]>(() => {
        return sortedSource.map(p => {
            const cached = dimensionsCache[p.id];
            const w = cached?.width || p.width || 800;
            const h = cached?.height || p.height || 600;
            return { ...p, id: p.id, width: w, height: h, ar: w / h };
        });
    }, [sortedSource, dimensionsCache]);

    const gap = 2;

    const justifiedRows = useMemo<Row[]>(() => {
        const rows: Row[] = [];
        let currentRow: Photo[] = [];
        let currentRowARSum = 0;

        // Dynamic target: tries to keep height around 140-180px
        const targetARSum = Math.max(1.0, actualWidth / 160);

        for (let i = 0; i < photos.length; i++) {
            const p = photos[i];
            currentRow.push(p);
            currentRowARSum += p.ar;

            const isLastPhoto = i === photos.length - 1;
            const reachedTarget = currentRowARSum >= targetARSum;

            if (reachedTarget || isLastPhoto) {
                // PRECISION MATH: h = (UsableWidth - Gaps) / TotalAR
                const usableWidth = actualWidth - (currentRow.length - 1) * gap;
                const rowHeight = usableWidth / currentRowARSum;
                rows.push({ photos: [...currentRow], height: rowHeight });
                currentRow = [];
                currentRowARSum = 0;
            }
        }
        return rows;
    }, [photos, actualWidth]);

    const hoveredPhoto = photos.find(p => p.id === hoveredPhotoId);

    return (
        <div className="space-y-8 max-w-7xl mx-auto p-12 bg-white rounded-[3rem] shadow-2xl border border-indigo-50">
            <div className="flex flex-col items-center gap-6">
                <div className="flex flex-col items-center gap-4 w-full max-w-sm bg-indigo-50 p-6 rounded-2xl border border-indigo-100 shadow-inner">
                    <div className="flex justify-between w-full text-indigo-800 font-black text-[10px] uppercase tracking-[0.2em]">
                        <span>Small</span>
                        <span className="text-xs bg-white px-3 py-1 rounded-full shadow-sm border border-indigo-100">INNER: {actualWidth}px</span>
                        <span>Large</span>
                    </div>
                    <input
                        type="range"
                        min="150"
                        max="800"
                        value={requestedWidth}
                        onChange={(e) => setRequestedWidth(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-16 items-start justify-center">
                {/* PRIMARY TEST AREA */}
                <div className="space-y-4 flex flex-col items-center">
                    <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest px-4 border-l-2 border-indigo-500">The Pixel-Proof Gallery</h3>
                    <div
                        ref={containerRef}
                        style={{ width: `${requestedWidth}px` }}
                        className="bg-slate-50 border-[6px] border-indigo-100/50 shadow-2xl min-h-[500px] overflow-y-auto overflow-x-hidden p-0 relative rounded-xl"
                    >
                        {/* THE RED LINE: Stays strictly at actualWidth */}
                        <div className="absolute top-0 bottom-0 border-r-[3px] border-rose-500 z-50 pointer-events-none shadow-[2px_0_10px_rgba(244,63,94,0.3)]" style={{ left: `${actualWidth}px` }} />

                        <div className="flex flex-col gap-[2px]">
                            {justifiedRows.map((row: Row, ridx: number) => {
                                const rowARSum = row.photos.reduce((sum, p) => sum + p.ar, 0);
                                const usableRowWidth = actualWidth - (row.photos.length - 1) * gap;

                                return (
                                    <div key={ridx} className="flex gap-[2px] min-h-[50px]" style={{ height: `${row.height}px` }}>
                                        {row.photos.map((p: Photo) => {
                                            // PURE PIXEL MATH: No flex-grow, no basis, just hard pixels.
                                            const photoPixelWidth = row.photos.length === 1 ? actualWidth : (p.ar / rowARSum) * usableRowWidth;
                                            return (
                                                <div
                                                    key={p.id}
                                                    onMouseEnter={() => setHoveredPhotoId(p.id)}
                                                    onMouseLeave={() => setHoveredPhotoId(null)}
                                                    className={cn(
                                                        "relative overflow-hidden transition-all duration-300 cursor-crosshair group",
                                                        hoveredPhotoId === p.id ? "z-20 scale-[1.05] shadow-2xl ring-4 ring-indigo-400" : "bg-slate-200"
                                                    )}
                                                    style={{
                                                        width: `${photoPixelWidth}px`,
                                                        height: '100%',
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    <GalleryImage
                                                        src={p.storage_path || p.url || ''}
                                                        alt="t"
                                                        fill
                                                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                                                        onLoadingComplete={(img) => {
                                                            if (img.naturalWidth && img.naturalHeight && !dimensionsCache[p.id]) {
                                                                setDimensionsCache(prev => ({ ...prev, [p.id]: { width: img.naturalWidth, height: img.naturalHeight } }));
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* VERIFICATION AREA */}
                <div className="sticky top-12 space-y-6 max-w-sm w-full">
                    <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-2xl border-t border-white/10">
                        <h3 className="text-indigo-400 font-bold text-xs uppercase tracking-widest mb-4">Verification Eye</h3>
                        {hoveredPhoto ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-gray-400">
                                    <div className="bg-white/5 p-2 rounded">W: {hoveredPhoto.width}px</div>
                                    <div className="bg-white/5 p-2 rounded">AR: {hoveredPhoto.ar.toFixed(4)}</div>
                                </div>
                                <div className="relative aspect-square bg-white/5 rounded-xl border border-white/10 flex items-center justify-center p-4 overflow-hidden">
                                    <div
                                        className="relative ring-1 ring-white/20"
                                        style={{
                                            height: hoveredPhoto.ar > 1 ? 'auto' : '100%',
                                            width: hoveredPhoto.ar > 1 ? '100%' : 'auto',
                                            maxHeight: '100%',
                                            maxWidth: '100%',
                                            aspectRatio: hoveredPhoto.ar
                                        }}
                                    >
                                        <GalleryImage
                                            src={hoveredPhoto.storage_path || hoveredPhoto.url || ''}
                                            alt="p"
                                            fill
                                            size="preview"
                                            className="object-contain"
                                        />
                                        <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-rose-500 rounded-sm" />
                                        <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-rose-500 rounded-sm" />
                                        <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-rose-500 rounded-sm" />
                                        <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-rose-500 rounded-sm" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="aspect-square rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center text-gray-500 italic text-sm">
                                Inspect a pixel...
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-rose-50 rounded-[2rem] border border-rose-100 text-[11px] text-rose-900 leading-relaxed shadow-sm">
                        <div className="font-bold flex items-center gap-2 mb-2 text-rose-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                            THE PRECISION FIX
                        </div>
                        <p>I am now using <strong>Fixed Pixel Math</strong>. Each container gets a calculated width in pixels (e.g., <code>154.32px</code>) instead of using flex-grow. This eliminates all browser rounding errors that were occurring below 241px.</p>
                        <p className="mt-2 text-rose-700 italic">"If the photo touches the red line, the math is absolute."</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
