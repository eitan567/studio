import { LayoutRegion } from './advanced-layout-types';

type PercentPoint = [number, number];

const EDGE_EPSILON = 0.08;

const pointOnSegment = (
    point: PercentPoint,
    a: PercentPoint,
    b: PercentPoint,
    epsilon: number = EDGE_EPSILON
): boolean => {
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const apx = point[0] - a[0];
    const apy = point[1] - a[1];
    const abLenSq = (abx * abx) + (aby * aby);
    if (abLenSq < 1e-8) return Math.hypot(apx, apy) <= epsilon;
    const t = ((apx * abx) + (apy * aby)) / abLenSq;
    if (t < -0.001 || t > 1.001) return false;
    const projX = a[0] + (abx * t);
    const projY = a[1] + (aby * t);
    return Math.hypot(point[0] - projX, point[1] - projY) <= epsilon;
};

const isPointInPolygon = (point: PercentPoint, polygon: PercentPoint[]): boolean => {
    if (polygon.length < 3) return false;

    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        if (pointOnSegment(point, a, b)) return true;
    }

    let inside = false;
    const x = point[0];
    const y = point[1];
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0];
        const yi = polygon[i][1];
        const xj = polygon[j][0];
        const yj = polygon[j][1];
        const intersects = ((yi > y) !== (yj > y)) &&
            (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
        if (intersects) inside = !inside;
    }
    return inside;
};

const isPointInsideRegion = (region: LayoutRegion, point: PercentPoint): boolean => {
    if (region.shape === 'polygon' && region.points && region.points.length >= 3) {
        return isPointInPolygon(point, region.points);
    }

    const { x, y, width, height } = region.bounds;
    return point[0] >= (x - EDGE_EPSILON) &&
        point[0] <= (x + width + EDGE_EPSILON) &&
        point[1] >= (y - EDGE_EPSILON) &&
        point[1] <= (y + height + EDGE_EPSILON);
};

/**
 * For each region (based on render order), returns true if its center point is inside
 * any previously-rendered region. This marks likely visual overlap-with-lower-layer cases.
 */
export const computeLowerOverlapFlags = (regions: LayoutRegion[]): boolean[] => {
    const flags: boolean[] = new Array(regions.length).fill(false);
    for (let i = 0; i < regions.length; i++) {
        const current = regions[i];
        const center: PercentPoint = [
            current.bounds.x + (current.bounds.width / 2),
            current.bounds.y + (current.bounds.height / 2)
        ];

        for (let j = 0; j < i; j++) {
            if (isPointInsideRegion(regions[j], center)) {
                flags[i] = true;
                break;
            }
        }
    }
    return flags;
};

