import { LayoutRegion } from './advanced-layout-types';

const EPS = 1e-6;

const normalizeSignedDeg = (deg: number): number => {
    let d = ((deg % 360) + 360) % 360;
    if (d > 180) d -= 360;
    if (Math.abs(d) < 0.0001) return 0;
    return d;
};

/**
 * Returns the visual frame rotation in degrees.
 * - If region.rotation exists, it is authoritative.
 * - For polygon regions that were baked to points (rotation=0), estimate from the bottom edge
 *   ("ground") so image orientation remains intuitive in follow-frame mode.
 */
export const getRegionVisualRotationDeg = (region: LayoutRegion): number => {
    const explicitGroundRotation =
        typeof region.imageGroundRotation === 'number' && Number.isFinite(region.imageGroundRotation)
            ? region.imageGroundRotation
            : undefined;
    if (explicitGroundRotation !== undefined) return normalizeSignedDeg(explicitGroundRotation);

    const explicitRotation = typeof region.rotation === 'number' ? region.rotation : 0;
    if (Math.abs(explicitRotation) > 0.0001) return explicitRotation;

    if (region.shape !== 'polygon' || !region.points || region.points.length < 2) {
        return explicitRotation;
    }

    let points = region.points;
    if (points.length === 4) {
        // Some saved polygons can arrive with non-perimeter point order.
        // Reorder by polar angle around centroid to stabilize edge-based orientation.
        const cx = points.reduce((acc, p) => acc + p[0], 0) / 4;
        const cy = points.reduce((acc, p) => acc + p[1], 0) / 4;
        points = [...points].sort((a, b) => {
            const aa = Math.atan2(a[1] - cy, a[0] - cx);
            const bb = Math.atan2(b[1] - cy, b[0] - cx);
            return aa - bb;
        });
    }
    let bestIndex = -1;
    let bestMidY = -Infinity;
    let bestLenSq = -1;

    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const lenSq = (dx * dx) + (dy * dy);
        if (lenSq < EPS) continue;

        const midY = (a[1] + b[1]) / 2;
        if (
            midY > bestMidY + EPS ||
            (Math.abs(midY - bestMidY) <= EPS && lenSq > bestLenSq + EPS)
        ) {
            bestIndex = i;
            bestMidY = midY;
            bestLenSq = lenSq;
        }
    }

    if (bestIndex < 0 || bestLenSq < EPS) return explicitRotation;

    const a = points[bestIndex];
    const b = points[(bestIndex + 1) % points.length];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];

    // Keep direction left->right so 0deg and 180deg don't randomly flip.
    if (dx < 0) {
        dx = -dx;
        dy = -dy;
    }

    const bestDeg = Math.atan2(dy, dx) * (180 / Math.PI);
    return normalizeSignedDeg(bestDeg);
};
