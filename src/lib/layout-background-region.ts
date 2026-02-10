import { LayoutRegion } from './advanced-layout-types';

const EDGE_EPS = 0.35;
const PAGE_AREA = 100 * 100;

const getPolygonArea = (points: [number, number][]): number => {
    if (!points || points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i][0] * points[j][1] - points[j][0] * points[i][1];
    }
    return Math.abs(area) / 2;
};

export const getRegionAreaPercent = (region: LayoutRegion): number => {
    if (region.shape === 'polygon' && region.points && region.points.length >= 3) {
        return getPolygonArea(region.points);
    }
    return Math.max(0, region.bounds.width) * Math.max(0, region.bounds.height);
};

export const getRegionBoundaryTouchCount = (region: LayoutRegion): number => {
    const touches = new Set<'left' | 'right' | 'top' | 'bottom'>();

    if (region.shape === 'polygon' && region.points && region.points.length > 0) {
        for (const [x, y] of region.points) {
            if (Math.abs(x - 0) <= EDGE_EPS) touches.add('left');
            if (Math.abs(x - 100) <= EDGE_EPS) touches.add('right');
            if (Math.abs(y - 0) <= EDGE_EPS) touches.add('top');
            if (Math.abs(y - 100) <= EDGE_EPS) touches.add('bottom');
        }
    } else {
        const { x, y, width, height } = region.bounds;
        if (Math.abs(x - 0) <= EDGE_EPS) touches.add('left');
        if (Math.abs((x + width) - 100) <= EDGE_EPS) touches.add('right');
        if (Math.abs(y - 0) <= EDGE_EPS) touches.add('top');
        if (Math.abs((y + height) - 100) <= EDGE_EPS) touches.add('bottom');
    }

    return touches.size;
};

export const isLikelyBackgroundRegion = (region: LayoutRegion, allRegions: LayoutRegion[]): boolean => {
    if (!allRegions || allRegions.length === 0) return false;

    const area = getRegionAreaPercent(region);
    const areaRatio = area / PAGE_AREA;
    const touchCount = getRegionBoundaryTouchCount(region);

    // Backward compatibility:
    // Older saved templates may contain incorrect `isBackground` flags on small regions.
    // Trust explicit flags only for reasonably large/edge-participating regions.
    if (region.isBackground) {
        return areaRatio >= 0.25 || (areaRatio >= 0.18 && touchCount >= 2);
    }

    const minZ = Math.min(...allRegions.map((r) => r.zIndex ?? 0));
    if ((region.zIndex ?? 0) !== minZ) return false;
    const baseLayerCount = allRegions.filter((r) => (r.zIndex ?? 0) === minZ).length;

    // Conservative fallback for legacy templates:
    // Only very large regions can be treated as background automatically.
    // This prevents rotated-grid corner cells from being mistaken as background.
    if (baseLayerCount >= 8 && areaRatio < 0.7) return false;
    if (areaRatio >= 0.7) return true;
    if (areaRatio >= 0.55 && touchCount >= 2) return true;
    if (areaRatio >= 0.45 && touchCount >= 3) return true;

    return false;
};

export const markLikelyBackgroundRegions = (regions: LayoutRegion[]): LayoutRegion[] => {
    if (!regions || regions.length === 0) return regions;
    const candidates = regions
        .map((region, index) => ({ region, index, area: getRegionAreaPercent(region) }))
        .filter(({ region }) => isLikelyBackgroundRegion(region, regions));

    if (candidates.length === 0) {
        return regions.map((region) => (region.isBackground ? { ...region, isBackground: false } : region));
    }

    // Keep exactly one background region (largest candidate).
    const primary = candidates.reduce((best, curr) => (curr.area > best.area ? curr : best), candidates[0]);

    return regions.map((region, index) => {
        if (index === primary.index) {
            return {
                ...region,
                isBackground: true,
                imageGroundRotation: 0
            };
        }
        return region.isBackground ? { ...region, isBackground: false } : region;
    });
};
