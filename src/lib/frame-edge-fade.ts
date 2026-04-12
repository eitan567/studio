import type { CSSProperties } from 'react';

const MAX_FRAME_EDGE_FADE = 200;

export const normalizeFrameEdgeFade = (value: unknown, max = MAX_FRAME_EDGE_FADE): number => {
    const numericValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.max(0, Math.min(max, numericValue));
};

export const buildFrameEdgeFadeMaskStyle = (fadePx: number): CSSProperties | undefined => {
    const fade = normalizeFrameEdgeFade(fadePx);
    if (fade <= 0) return undefined;

    const innerStop = `${fade}px`;
    const softStop = `${fade * 0.45}px`;
    const maskImage = [
        'radial-gradient(ellipse closest-side at center',
        '#000 0',
        `#000 calc(100% - ${innerStop})`,
        `rgba(0, 0, 0, 0.55) calc(100% - ${softStop})`,
        'rgba(0, 0, 0, 0) 100%)'
    ].join(', ');

    return {
        WebkitMaskImage: maskImage,
        maskImage,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
    } as CSSProperties;
};
