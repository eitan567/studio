import React from 'react';
import { cn } from '@/lib/utils';
import { AdvancedTemplate, insetPolygon } from '@/lib/advanced-layout-types';

export const TemplatePreview = ({ template }: { template: AdvancedTemplate }) => {
    const sortedRegions = [...template.regions].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const GAP_INSET = 1;
    const EDGE_MARGIN = 2;
    const scale = (100 - EDGE_MARGIN * 2) / 100;

    return (
        <div className="w-full h-full relative">
            {sortedRegions.map((region, index) => {
                const isCircular = region.shape === 'circle' || region.shape === 'ellipse';
                const isPolygon = region.shape === 'polygon' && region.points && region.points.length >= 3;

                if (region.shape === 'path' && region.path) {
                    const vb = region.viewBox ? region.viewBox.split(' ').map(Number) : [0, 0, 100, 100];
                    const [vx, vy, vw, vh] = vb;
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
                    const clipPathPoints = insetPoints.map(([px, py]) => {
                        const scaledX = EDGE_MARGIN + (px * scale);
                        const scaledY = EDGE_MARGIN + (py * scale);
                        return `${scaledX}% ${scaledY}%`;
                    }).join(', ');

                    return (
                        <div
                            key={region.id || index}
                            className="absolute bg-primary/20"
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
                        className={cn('absolute bg-primary/20', isCircular ? 'rounded-full' : 'rounded-sm')}
                        style={{
                            left: `${x}%`, top: `${y}%`, width: `${width}%`, height: `${height}%`,
                            zIndex: region.zIndex ?? 0,
                        }}
                    />
                );
            })}
        </div>
    );
};
