import { LayoutRegion, Point, Segment } from "./advanced-layout-types";
import { v4 as uuidv4 } from "uuid";

// ----------------------------------------------------------------------
// TYPES & CONSTANTS
// ----------------------------------------------------------------------

export type Polygon = Point[];

// Geometric tolerances
const EPSILON = 0.01;        // General equality tolerance
const GRID_SNAP = 0.001;     // Normalization grid
const MERGE_RADIUS = 0.1;    // Pull nearby vertices together
const BORDER_SNAP = 2.5;     // Matches editor line boundary snap to prevent edge slivers

// ----------------------------------------------------------------------
// MAIN EXPORT
// ----------------------------------------------------------------------

export function processLayoutGeometry(
    rawStrokes: Segment[],
    gap: number = 0,
    width: number = 100,
    includePageBounds: boolean = true
): LayoutRegion[] {
    // 1. GRID NORMALIZE & BOUNDARY SNAP
    const strokes = rawStrokes.map(s => ({
        p1: snapToBoundary(gridPoint(s.p1), width),
        p2: snapToBoundary(gridPoint(s.p2), width)
    })).filter(s => distSq(s.p1, s.p2) > EPSILON * EPSILON);

    // 2. DEFINE PAGE BOUNDS
    const bounds: Segment[] = [
        { p1: [0, 0], p2: [width, 0] },
        { p1: [width, 0], p2: [width, 100] },
        { p1: [width, 100], p2: [0, 100] },
        { p1: [0, 100], p2: [0, 0] },
    ];

    // 3. SOUP OF SEGMENTS (Bounds + Strokes)
    const allSegments = includePageBounds ? [...bounds, ...strokes] : [...strokes];

    // 4. TOPOLOGICAL CLEANUP (Merging close vertices & splitting intersections)
    const atomicSegments = buildRobustPlanarGraph(allSegments);
    const snappedAtomicSegments = deduplicate(
        atomicSegments
            .map((s) => ({
                p1: snapToBoundary(gridPoint(s.p1), width),
                p2: snapToBoundary(gridPoint(s.p2), width),
            }))
            .filter((s) => distSq(s.p1, s.p2) > EPSILON * EPSILON)
    );

    // 5. EXTRACT INTERIOR FACES
    const rawPolygons = findFaces(snappedAtomicSegments);

    // 6. APPLY GAP OFFSET (Shrink from edges)
    const finalPolygons = gap > 0
        ? rawPolygons.map(poly => offsetPolygon(poly, gap / 2)).filter(p => p !== null) as Polygon[]
        : rawPolygons;

    // 7. CONVERT TO REGIONS
    return finalPolygons.map(poly => polygonToRegion(poly, width));
}

// ----------------------------------------------------------------------
// 1. TOPOLOGY ENGINE
// ----------------------------------------------------------------------

/**
 * Ensures all segments are split at intersections and grazing contact points,
 * and that close vertices are merged to avoid tiny gaps that break face tracing.
 */
function buildRobustPlanarGraph(segments: Segment[]): Segment[] {
    let currentSegments = [...segments];

    // PASS 1: Vertex-to-Vertex Merging (Aggressive)
    let vertices = collectUniqueVertices(currentSegments);
    vertices = mergeNearbyVertices(vertices);
    currentSegments = currentSegments.map(s => ({
        p1: findClosestPoint(s.p1, vertices),
        p2: findClosestPoint(s.p2, vertices)
    })).filter(s => distSq(s.p1, s.p2) > EPSILON * EPSILON);

    // PASS 2: Split Intersections & Grazing Contacts
    let intersectionsFound = true;
    let safety = 0;
    while (intersectionsFound && safety++ < 100) {
        intersectionsFound = false;
        const nextSegments: Segment[] = [];
        const currentVertices = collectUniqueVertices(currentSegments);

        for (let i = 0; i < currentSegments.length; i++) {
            const s = currentSegments[i];
            let splitPoints: Point[] = [];

            // Check for actual line-line intersections
            for (let j = 0; j < currentSegments.length; j++) {
                if (i === j) continue;
                const ix = getIntersection(s, currentSegments[j]);
                if (ix && !isPointEqual(ix, s.p1) && !isPointEqual(ix, s.p2)) {
                    splitPoints.push(gridPoint(ix));
                    intersectionsFound = true;
                }
            }

            // Check for grazing contacts (existing vertex on a segment)
            for (const v of currentVertices) {
                if (isPointEqual(v, s.p1) || isPointEqual(v, s.p2)) continue;
                if (isPointOnSegment(v, s, EPSILON)) {
                    if (!splitPoints.some(p => isPointEqual(p, v))) {
                        splitPoints.push(v);
                        intersectionsFound = true;
                    }
                }
            }

            if (splitPoints.length > 0) {
                splitPoints.sort((a, b) => distSq(s.p1, a) - distSq(s.p1, b));
                splitPoints = filterUnique(splitPoints);
                let prev = s.p1;
                for (const p of splitPoints) {
                    nextSegments.push({ p1: prev, p2: p });
                    prev = p;
                }
                nextSegments.push({ p1: prev, p2: s.p2 });
            } else {
                nextSegments.push(s);
            }
        }
        currentSegments = deduplicate(nextSegments);
    }

    return currentSegments;
}

/** 
 * Merges vertices that are within MERGE_RADIUS by averaging them 
 * or snapping to a single point in the cluster.
 */
function mergeNearbyVertices(vertices: Point[]): Point[] {
    const merged: Point[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < vertices.length; i++) {
        if (processed.has(i)) continue;

        // Find all points in the cluster
        const cluster = [vertices[i]];
        processed.add(i);

        for (let j = i + 1; j < vertices.length; j++) {
            if (processed.has(j)) continue;
            if (distSq(vertices[i], vertices[j]) < MERGE_RADIUS * MERGE_RADIUS) {
                cluster.push(vertices[j]);
                processed.add(j);
            }
        }

        // Average the cluster or pick first to maintain grid alignment
        const avgX = cluster.reduce((sum, p) => sum + p[0], 0) / cluster.length;
        const avgY = cluster.reduce((sum, p) => sum + p[1], 0) / cluster.length;
        merged.push(gridPoint([avgX, avgY]));
    }
    return merged;
}

/**
 * Standard Left-Wall Follower to find enclosed faces.
 * CCW in Y-down screen coords = interior region.
 */
function findFaces(segments: Segment[]): Polygon[] {
    const adjs = new Map<string, Point[]>();
    const addDir = (a: Point, b: Point) => {
        const k = ptKey(a);
        if (!adjs.has(k)) adjs.set(k, []);
        adjs.get(k)!.push(b);
    };
    segments.forEach(s => { addDir(s.p1, s.p2); addDir(s.p2, s.p1); });

    adjs.forEach((neighbors, key) => {
        const origin = keyToPt(key);
        neighbors.sort((a, b) => Math.atan2(a[1] - origin[1], a[0] - origin[0]) - Math.atan2(b[1] - origin[1], b[0] - origin[0]));
    });

    const visited = new Set<string>();
    const faces: Polygon[] = [];

    adjs.forEach((neighbors, startKey) => {
        const start = keyToPt(startKey);
        for (const nextNode of neighbors) {
            const edgeKey = `${ptKey(start)}|${ptKey(nextNode)}`;
            if (visited.has(edgeKey)) continue;

            const path: Point[] = [start];
            let curr = nextNode;
            let prev = start;
            const traceEdges = new Set<string>();
            traceEdges.add(edgeKey);

            let ok = true;
            while (!isPointEqual(curr, start)) {
                path.push(curr);
                const list = adjs.get(ptKey(curr));
                if (!list) { ok = false; break; }

                const idx = list.findIndex(p => isPointEqual(p, prev));
                if (idx === -1) { ok = false; break; }

                const next = list[(idx - 1 + list.length) % list.length];
                const ek = `${ptKey(curr)}|${ptKey(next)}`;
                if (traceEdges.has(ek)) { ok = false; break; }

                traceEdges.add(ek);
                prev = curr;
                curr = next;
                if (path.length > 2000) { ok = false; break; }
            }

            if (ok) {
                traceEdges.forEach(e => visited.add(e));
                const area = getSignedArea(path);
                // CW in Y-down = Interior (Positive Area).
                // Left-Wall Traversal roughly traces CW loops for inside faces.
                if (area > EPSILON) faces.push(path);
            }
        }
    });

    return faces;
}

// ----------------------------------------------------------------------
// GEOMETRY UTILS
// ----------------------------------------------------------------------

function getIntersection(s1: Segment, s2: Segment): Point | null {
    const x1 = s1.p1[0], y1 = s1.p1[1], x2 = s1.p2[0], y2 = s1.p2[1];
    const x3 = s2.p1[0], y3 = s2.p1[1], x4 = s2.p2[0], y4 = s2.p2[1];
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (Math.abs(denom) < 1e-10) return null;
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) return [x1 + ua * (x2 - x1), y1 + ua * (y2 - y1)];
    return null;
}

function isPointOnSegment(p: Point, s: Segment, tol: number): boolean {
    const x1 = s.p1[0], y1 = s.p1[1], x2 = s.p2[0], y2 = s.p2[1], px = p[0], py = p[1];
    if (px < Math.min(x1, x2) - tol || px > Math.max(x1, x2) + tol ||
        py < Math.min(y1, y2) - tol || py > Math.max(y1, y2) + tol) return false;
    const dx = x2 - x1, dy = y2 - y1;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-10) return false;
    const dist = Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / d;
    return dist < tol;
}

function getSignedArea(poly: Point[]): number {
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        area += poly[i][0] * poly[j][1];
        area -= poly[j][0] * poly[i][1];
    }
    return area / 2;
}

function offsetPolygon(poly: Polygon, delta: number): Polygon | null {
    if (delta === 0) return poly;
    const n = poly.length;
    const result: Point[] = [];
    for (let i = 0; i < n; i++) {
        const p1 = poly[(i - 1 + n) % n], p2 = poly[i], p3 = poly[(i + 1) % n];
        const v1 = normalize([p2[0] - p1[0], p2[1] - p1[1]]);
        const v2 = normalize([p3[0] - p2[0], p3[1] - p2[1]]);
        const n1 = [-v1[1], v1[0]], n2 = [-v2[1], v2[0]];
        const l1s = [p1[0] + n1[0] * delta, p1[1] + n1[1] * delta];
        const l1e = [p2[0] + n1[0] * delta, p2[1] + n1[1] * delta];
        const l2s = [p2[0] + n2[0] * delta, p2[1] + n2[1] * delta];
        const l2e = [p3[0] + n2[0] * delta, p3[1] + n2[1] * delta];
        const ix = getLineIX(l1s, l1e, l2s, l2e);
        result.push(ix ? ix : [p2[0] + n1[0] * delta, p2[1] + n1[1] * delta]);
    }
    const a1 = Math.abs(getSignedArea(poly)), a2 = Math.abs(getSignedArea(result));
    return (a2 < a1 * 0.1 || getSignedArea(poly) * getSignedArea(result) < 0) ? null : result;
}

function getLineIX(p1: number[], p2: number[], p3: number[], p4: number[]): Point | null {
    const x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1], x3 = p3[0], y3 = p3[1], x4 = p4[0], y4 = p4[1];
    const d = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (Math.abs(d) < 1e-10) return null;
    const u = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / d;
    return [x1 + u * (x2 - x1), y1 + u * (y2 - y1)];
}

// ----------------------------------------------------------------------
// BASIC UTILS
// ----------------------------------------------------------------------

function gridPoint(p: Point): Point { return [Math.round(p[0] / GRID_SNAP) * GRID_SNAP, Math.round(p[1] / GRID_SNAP) * GRID_SNAP]; }
function snapToBoundary(p: Point, w: number): Point {
    let x = p[0], y = p[1];
    if (Math.abs(x - 0) < BORDER_SNAP) x = 0;
    if (Math.abs(x - w) < BORDER_SNAP) x = w;
    if (Math.abs(y - 0) < BORDER_SNAP) y = 0;
    if (Math.abs(y - 100) < BORDER_SNAP) y = 100;
    return [x, y];
}
function ptKey(p: Point) { return `${p[0].toFixed(4)},${p[1].toFixed(4)}`; }
function keyToPt(k: string): Point { return k.split(',').map(Number) as Point; }
function isPointEqual(a: Point, b: Point) { return Math.abs(a[0] - b[0]) < EPSILON && Math.abs(a[1] - b[1]) < EPSILON; }
function distSq(a: Point, b: Point) { return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; }
function normalize(v: number[]) { const l = Math.sqrt(v[0] ** 2 + v[1] ** 2); return l < 1e-10 ? [0, 0] : [v[0] / l, v[1] / l]; }
function filterUnique(pts: Point[]) { const res: Point[] = []; pts.forEach(p => { if (!res.some(r => isPointEqual(r, p))) res.push(p); }); return res; }
function deduplicate(segs: Segment[]) {
    const res: Segment[] = [];
    const seen = new Set<string>();
    segs.forEach(s => {
        const k1 = ptKey(s.p1), k2 = ptKey(s.p2);
        const key = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
        if (!seen.has(key)) { res.push(s); seen.add(key); }
    });
    return res;
}
function collectUniqueVertices(segs: Segment[]) {
    const res: Point[] = [];
    segs.forEach(s => { [s.p1, s.p2].forEach(p => { if (!res.some(r => isPointEqual(r, p))) res.push(p); }); });
    return res;
}
function findClosestPoint(p: Point, pts: Point[]) {
    let best = p, min = Infinity;
    pts.forEach(pt => { const d = distSq(p, pt); if (d < min) { min = d; best = pt; } });
    return best;
}

function polygonToRegion(poly: Point[], w: number): LayoutRegion {
    let minX = 100, minY = 100, maxX = 0, maxY = 0;
    const pts = poly.map(p => {
        const x = (p[0] / w) * 100, y = p[1];
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        return [x, y] as Point;
    });
    return {
        id: uuidv4(), shape: 'polygon', points: pts,
        bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        rotation: 0, zIndex: 1, preserveAspectRatio: false
    };
}
