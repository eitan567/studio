import { LayoutRegion } from './advanced-layout-types';

const EDGE_EPS = 0.35;

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
    if (region.isBackground) return true;
    if (!allRegions || allRegions.length === 0) return false;

    const minZ = Math.min(...allRegions.map((r) => r.zIndex ?? 0));
    if ((region.zIndex ?? 0) !== minZ) return false;

    const baseLayerRegions = allRegions.filter((r) => (r.zIndex ?? 0) === minZ);
    if (baseLayerRegions.length === 0) return false;
    const area = getRegionAreaPercent(region);
    const sortedAreas = baseLayerRegions.map(getRegionAreaPercent).sort((a, b) => b - a);
    const maxArea = sortedAreas[0] ?? 0;
    const secondArea = sortedAreas[1] ?? 0;
    const isLargest = Math.abs(area - maxArea) <= 0.001;
    const touchCount = getRegionBoundaryTouchCount(region);

    // Heuristics:
    // - Strong boundary participation indicates "page background" frame.
    // - Only largest base-layer region can become background by heuristic.
    // - Must dominate next largest region (avoid marking grid corners/cells).
    if (!isLargest) return false;
    if (touchCount >= 3 && area >= 18) return true;
    if (touchCount >= 2 && area >= 25 && (secondArea <= 0 || area >= secondArea * 1.35)) return true;
    if (area >= 70) return true;

    return false;
};

export const markLikelyBackgroundRegions = (regions: LayoutRegion[]): LayoutRegion[] => {
    if (!regions || regions.length === 0) return regions;
    return regions.map((region) => {
        if (isLikelyBackgroundRegion(region, regions)) {
            return {
                ...region,
                isBackground: true,
                imageGroundRotation: 0
            };
        }
        return region;
    });
};
