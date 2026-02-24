import React from 'react';
import { cn } from '@/lib/utils';
import { AdvancedTemplate, insetPolygon } from '@/lib/advanced-layout-types';

export const TemplatePreview = ({
    template,
    variant = 'compact',
}: {
    template: AdvancedTemplate;
    variant?: 'compact' | 'detailed';
}) => {
    const sortedRegions = [...template.regions].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const isDetailed = variant === 'detailed';
    const GAP_INSET = 1;
    const EDGE_MARGIN = 2;
    const scale = (100 - EDGE_MARGIN * 2) / 100;
    const strokePrimary = 'hsl(var(--foreground) / 0.98)';
    const strokeSecondary = 'hsl(var(--foreground) / 0.55)';
    const regionFill = 'hsl(var(--foreground) / 0.08)';
    const detailedClipBounds = React.useMemo(() => {
        if (!isDetailed) {
            return {
                left: EDGE_MARGIN,
                top: EDGE_MARGIN,
                width: 100 - (EDGE_MARGIN * 2),
                height: 100 - (EDGE_MARGIN * 2),
            };
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let found = false;

        for (const region of sortedRegions) {
            // Path regions are often the source of overflow artifacts;
            // derive clip bounds from slot geometry only.
            if (region.shape === 'path') continue;

            if (region.shape === 'polygon' && region.points && region.points.length >= 3) {
                const insetPoints = insetPolygon(region.points, GAP_INSET);
                for (const [px, py] of insetPoints) {
                    const sx = EDGE_MARGIN + (px * scale);
                    const sy = EDGE_MARGIN + (py * scale);
                    minX = Math.min(minX, sx);
                    minY = Math.min(minY, sy);
                    maxX = Math.max(maxX, sx);
                    maxY = Math.max(maxY, sy);
                }
                found = true;
                continue;
            }

            const gapX = region.bounds.x + GAP_INSET;
            const gapY = region.bounds.y + GAP_INSET;
            const gapW = Math.max(0, region.bounds.width - (GAP_INSET * 2));
            const gapH = Math.max(0, region.bounds.height - (GAP_INSET * 2));
            const x = EDGE_MARGIN + (gapX * scale);
            const y = EDGE_MARGIN + (gapY * scale);
            const w = gapW * scale;
            const h = gapH * scale;

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
            found = true;
        }

        if (!found) {
            return {
                left: EDGE_MARGIN,
                top: EDGE_MARGIN,
                width: 100 - (EDGE_MARGIN * 2),
                height: 100 - (EDGE_MARGIN * 2),
            };
        }

        const left = Math.max(0, Math.min(100, minX));
        const top = Math.max(0, Math.min(100, minY));
        const right = Math.max(left, Math.min(100, maxX));
        const bottom = Math.max(top, Math.min(100, maxY));

        return {
            left,
            top,
            width: Math.max(0, right - left),
            height: Math.max(0, bottom - top),
        };
    }, [isDetailed, sortedRegions, GAP_INSET, EDGE_MARGIN, scale]);

    const regionsContent = sortedRegions.map((region, index) => {
                const isCircular = region.shape === 'circle' || region.shape === 'ellipse';
                const isPolygon = region.shape === 'polygon' && region.points && region.points.length >= 3;

                if (region.shape === 'path' && region.path) {
                    const vb = region.viewBox ? region.viewBox.split(' ').map(Number) : [0, 0, 100, 100];
                    const [vx, vy, vw, vh] = vb;

                    if (isDetailed) {
                        return (
                            <svg
                                key={region.id || index}
                                className="absolute overflow-visible"
                                viewBox={`${vx} ${vy} ${vw} ${vh}`}
                                preserveAspectRatio="xMidYMid slice"
                                style={{
                                    left: `${region.bounds.x}%`,
                                    top: `${region.bounds.y}%`,
                                    width: `${region.bounds.width}%`,
                                    height: `${region.bounds.height}%`,
                                    zIndex: region.zIndex ?? 0,
                                }}
                            >
                                <defs>
                                    <clipPath id={`preview-detailed-clip-${template.id}-${index}`}>
                                        <path d={region.path} />
                                    </clipPath>
                                </defs>
                                <g clipPath={`url(#preview-detailed-clip-${template.id}-${index})`}>
                                    <rect
                                        x={vx - 1000}
                                        y={vy - 1000}
                                        width={vw + 2000}
                                        height={vh + 2000}
                                        fill={regionFill}
                                    />
                                </g>
                                <path
                                    d={region.path}
                                    fill="none"
                                    stroke={strokePrimary}
                                    strokeWidth={2}
                                    vectorEffect="non-scaling-stroke"
                                />
                                <path
                                    d={region.path}
                                    fill="none"
                                    stroke={strokeSecondary}
                                    strokeWidth={1}
                                    vectorEffect="non-scaling-stroke"
                                />
                            </svg>
                        );
                    }

                    return (
                        <svg
                            key={region.id || index}
                            className="absolute overflow-visible"
                            viewBox={`${vx} ${vy} ${vw} ${vh}`}
                            preserveAspectRatio="xMidYMid slice"
                            style={{
                                left: `${region.bounds.x}%`,
                                top: `${region.bounds.y}%`,
                                width: `${region.bounds.width}%`,
                                height: `${region.bounds.height}%`,
                                zIndex: region.zIndex ?? 0,
                            }}
                        >
                            <defs>
                                <clipPath id={`preview-clip-${template.id}-${index}`}>
                                    <path d={region.path} />
                                </clipPath>
                            </defs>
                            <g clipPath={`url(#preview-clip-${template.id}-${index})`}>
                                <rect x={vx - 1000} y={vy - 1000} width={vw + 2000} height={vh + 2000} className="fill-primary/20" />
                            </g>
                        </svg>
                    );
                }

                if (isPolygon && region.points) {
                    const insetPoints = insetPolygon(region.points, GAP_INSET);
                    const scaledPoints = insetPoints.map(([px, py]) => {
                        const scaledX = EDGE_MARGIN + (px * scale);
                        const scaledY = EDGE_MARGIN + (py * scale);
                        return [scaledX, scaledY] as const;
                    });
                    const clipPathPoints = scaledPoints.map(([sx, sy]) => `${sx}% ${sy}%`).join(', ');
                    const svgPoints = scaledPoints.map(([sx, sy]) => `${sx},${sy}`).join(' ');

                    if (isDetailed) {
                        return (
                            <div
                                key={region.id || index}
                                className="absolute"
                                style={{
                                    left: 0,
                                    top: 0,
                                    width: '100%',
                                    height: '100%',
                                    zIndex: region.zIndex ?? 0,
                                }}
                            >
                                <div
                                    className="absolute inset-0"
                                    style={{
                                        clipPath: `polygon(${clipPathPoints})`,
                                        backgroundColor: regionFill,
                                    }}
                                />
                                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                    <polygon
                                        points={svgPoints}
                                        fill="none"
                                        stroke={strokePrimary}
                                        strokeWidth={1.8}
                                        vectorEffect="non-scaling-stroke"
                                        strokeLinejoin="round"
                                    />
                                    <polygon
                                        points={svgPoints}
                                        fill="none"
                                        stroke={strokeSecondary}
                                        strokeWidth={0.9}
                                        vectorEffect="non-scaling-stroke"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>
                        );
                    }

                    return (
                        <div
                            key={region.id || index}
                            className={cn("absolute", !isDetailed && "bg-primary/20")}
                            style={{
                                left: 0, top: 0, width: '100%', height: '100%',
                                clipPath: `polygon(${clipPathPoints})`,
                                zIndex: region.zIndex ?? 0,
                            }}
                        />
                    );
                }

                const gapX = region.bounds.x + GAP_INSET;
                const gapY = region.bounds.y + GAP_INSET;
                const gapW = Math.max(0, region.bounds.width - (GAP_INSET * 2));
                const gapH = Math.max(0, region.bounds.height - (GAP_INSET * 2));

                const x = EDGE_MARGIN + (gapX * scale);
                const y = EDGE_MARGIN + (gapY * scale);
                const width = gapW * scale;
                const height = gapH * scale;

                return (
                    <div
                        key={region.id || index}
                        className={cn('absolute', !isDetailed && 'bg-primary/20', isCircular ? 'rounded-full' : 'rounded-sm')}
                        style={{
                            left: `${x}%`, top: `${y}%`, width: `${width}%`, height: `${height}%`,
                            zIndex: region.zIndex ?? 0,
                            backgroundColor: isDetailed ? regionFill : undefined,
                            border: isDetailed ? `1.8px solid ${strokePrimary}` : undefined,
                            boxShadow: isDetailed ? `inset 0 0 0 0.9px ${strokeSecondary}` : undefined,
                        }}
                    />
                );
            });

    return (
        <div
            className={cn("w-full h-full relative", isDetailed && "bg-background")}
            style={isDetailed ? {
                backgroundImage: 'linear-gradient(180deg, hsl(var(--muted) / 0.55), hsl(var(--background) / 0.96))'
            } : undefined}
        >
            {isDetailed ? (
                <div
                    className="absolute overflow-hidden"
                    style={{
                        left: `${detailedClipBounds.left}%`,
                        top: `${detailedClipBounds.top}%`,
                        width: `${detailedClipBounds.width}%`,
                        height: `${detailedClipBounds.height}%`,
                    }}
                >
                    {regionsContent}
                </div>
            ) : (
                regionsContent
            )}
        </div>
    );
};
