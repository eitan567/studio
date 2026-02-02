import { LayoutRegion } from "./advanced-layout-types";
import { v4 as uuidv4 } from "uuid";

// ----------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------

export type Point = [number, number]; // [x, y] in 0-100 coordinates
export type Segment = { p1: Point; p2: Point };
export type Polygon = Point[];

/**
 * Using EPSILON for floating point comparisons to avoid sensitivity issues.
 * Reduced for high-density geometry (smooth circles).
 */
const EPSILON = 0.001;

// ----------------------------------------------------------------------
// MAIN EXPORT
// ----------------------------------------------------------------------

/**
 * Takes a set of drawing strokes (lines, rects, etc.) and the page bounds,
 * and returns a list of NON-OVERLAPPING layout regions (faces).
 * 
 * @param strokes - Array of line segments (0-100 coords) defined by user drawing
 * @param gap - Gap size in relative % (or 0) for shrinking
 */
export function processLayoutGeometry(
    strokes: Segment[],
    gap: number = 0,
    width: number = 100 // Default to square if not specified
): LayoutRegion[] {
    // 1. BOUNDING BOX: Base it on the provided width (logical units)
    //    Height is always 100 in our logical system.
    const bounds: Segment[] = [
        { p1: [0, 0], p2: [width, 0] },
        { p1: [width, 0], p2: [width, 100] },
        { p1: [width, 100], p2: [0, 100] },
        { p1: [0, 100], p2: [0, 0] },
    ];

    // 2. SOUP OF SEGMENTS: Combine bounds + user strokes
    const allSegments = [...bounds, ...strokes];

    // 3. FLATTEN INTERSECTIONS: 
    //    Find all intersection points where lines cross.
    //    Split long segments into smaller ones at every intersection.
    const atomicSegments = computePlanarGraph(allSegments);

    // 4. FIND FACES: 
    //    Run "Turn Left" traversal algorithm on the graph to find all closed cycles (minimal polygons).
    const rawPolygons = findFaces(atomicSegments);

    // 5. SHRINK (OFFSET): 
    //    Apply gap padding by offsetting polygon edges inwards.
    const finalPolygons = gap > 0
        ? rawPolygons.map(poly => offsetPolygon(poly, -gap / 2)).filter(p => p !== null) as Polygon[]
        : rawPolygons;

    // 6. CONVERT TO REGIONS
    // Pass the logical width so regions can be normalized back to 0-100%
    return finalPolygons.map(poly => polygonToRegion(poly, width));
}

// ----------------------------------------------------------------------
// 1. COMPUTATIONAL GEOMETRY HELPERS
// ----------------------------------------------------------------------

/** 
 * Returns unique set of vertices and atomic non-intersecting edges.
 */
function computePlanarGraph(segments: Segment[]): Segment[] {
    let currentSegments = [...segments];
    let intersectionsFound = true;

    // Iteratively split segments until no more intersections exist
    // (Naive approach OK for N < 100 edges, but we need more for smooth circles)
    let safety = 0;
    while (intersectionsFound && safety++ < 1000) {
        intersectionsFound = false;
        const nextSegments: Segment[] = [];

        for (let i = 0; i < currentSegments.length; i++) {
            let s1 = currentSegments[i];
            let splitPoints: Point[] = [];

            for (let j = 0; j < currentSegments.length; j++) {
                if (i === j) continue;
                const s2 = currentSegments[j];
                const ix = getIntersection(s1, s2);
                if (ix) {
                    // Only care if intersection is strictly INSIDE the segment (not at endpoints)
                    if (!isPointEqual(ix, s1.p1) && !isPointEqual(ix, s1.p2)) {
                        splitPoints.push(ix);
                        intersectionsFound = true; // We found a split, so we must re-run to be safe
                    }
                }
            }

            if (splitPoints.length > 0) {
                // Sort points along the segment (distance from p1)
                splitPoints.sort((a, b) => distSq(s1.p1, a) - distSq(s1.p1, b));

                // Perform unique filter (dedupe identical intersection points)
                splitPoints = filterUniquePoints(splitPoints);

                // Create sub-segments
                let start = s1.p1;
                for (const p of splitPoints) {
                    nextSegments.push({ p1: start, p2: p });
                    start = p;
                }
                nextSegments.push({ p1: start, p2: s1.p2 });
            } else {
                nextSegments.push(s1);
            }
        }
        currentSegments = nextSegments;
        if (!intersectionsFound) break; // Optimization
    }

    return removeInvalidSegments(currentSegments);
}

/** 
 * Builds an adjacency list where edges are sorted CCW by angle 
 * allowing for "Left Wall Following" (Right-hand rule for outer, Left for inner faces).
 */
function findFaces(segments: Segment[]): Polygon[] {
    // 1. Build Graph: Map<PointID, Point[]> (Adjacency List)
    // Using string key "x,y" for point identity
    const graph = new Map<string, Point[]>();

    // Helper to add directed edges
    const addEdge = (p1: Point, p2: Point) => {
        const k = ptKey(p1);
        if (!graph.has(k)) graph.set(k, []);
        graph.get(k)!.push(p2);
    };

    segments.forEach(s => {
        // Add doubly linked edges (undirected graph viewed as two directed half-edges)
        addEdge(s.p1, s.p2);
        addEdge(s.p2, s.p1);
    });

    // 2. Sort neighbors by angle (atan2)
    graph.forEach((neighbors, originOffset) => {
        const origin = keyToPt(originOffset);
        neighbors.sort((a, b) => getAngle(origin, a) - getAngle(origin, b));
    });

    // 3. Traverse Helper: "Best Left Turn"
    // Since neighbors are sorted by angle, "Left" is just the (index - 1) neighbor in the cyclic list.
    const visitedEdges = new Set<string>(); // Key: "p1_x,p1_y|p2_x,p2_y"
    const faces: Polygon[] = [];

    // Iterate over EVERY directed half-edge in the graph
    for (const [startKey, neighbors] of graph.entries()) {
        const startNode = keyToPt(startKey);

        for (const nextNode of neighbors) {
            const edgeKey = `${ptKey(startNode)}|${ptKey(nextNode)}`;

            if (visitedEdges.has(edgeKey)) continue;

            // Start tracing a face
            const path: Point[] = [startNode];
            let curr = nextNode;
            let prev = startNode;

            const cycleEdges = new Set<string>();
            cycleEdges.add(edgeKey);

            let stuck = false;
            while (!isPointEqual(curr, startNode)) {
                path.push(curr);

                // FIND NEXT: The "Leftmost" turn relative to (prev -> curr)
                // In our sorted list, this is the neighbor immediately *before* 'prev' in 'curr's adjacency list.
                // (Because 'prev' is where we came from).
                const currAdjacency = graph.get(ptKey(curr))!;
                if (!currAdjacency || currAdjacency.length === 0) { stuck = true; break; }

                // Find index of 'prev' in 'curr's neighbors
                // Note: using loose comparison due to float variations
                const entryIndex = currAdjacency.findIndex(p => isPointEqual(p, prev));
                if (entryIndex === -1) { stuck = true; break; } // Should not happen

                // Next node is (index - 1) modulo length for CLOCKWISE sorted, 
                // BUT standard atan2 sort is usually -PI to PI.
                // Let's assume standard sort. 
                // To turn "Left" (into the face), we want the NEXT node in CCW order or PREV in CW?
                // Let's stick to standard Planar Graph logic:
                // If sorted CCW (increasing angle), the "next face edge" is (entryIndex - 1).

                let nextIndex = (entryIndex - 1 + currAdjacency.length) % currAdjacency.length;
                const next = currAdjacency[nextIndex];

                const nextEdgeKey = `${ptKey(curr)}|${ptKey(next)}`;

                // Cycle safety check
                if (cycleEdges.has(nextEdgeKey)) { stuck = true; break; }
                cycleEdges.add(nextEdgeKey);

                prev = curr;
                curr = next;

                // Infinite loop guard - bumped for high-density paths
                if (path.length > 1000) { stuck = true; break; }
            }

            if (!stuck) {
                // Mark all edges in this cycle as visited
                cycleEdges.forEach(k => visitedEdges.add(k));

                // Filter out the external face (usually the bounds itself, wound opposite way).
                // Or just filter by "Is Inside 0-100".
                // Simple heuristic: Signed Area.
                // Positive area = Counter-Clockwise (Inner Face).
                // Negative area = Clockwise (Outer Face / Hole).
                // Normal logic: getSignedArea < 0 for CCW in Screen Coords (Y-down)
                // When turning "Left", we trace the faces in a counter-clockwise direction.
                // In a Y-down system, CCW has a NEGATIVE signed area.
                const area = getSignedArea(path);
                if (area < -EPSILON) {
                    faces.push(path);
                }
            }
        }
    }

    return faces;
}

/**
 * Offsets a polygon by `delta` (negative = shrink/inset).
 * Uses a simple miter offset logic.
 */
function offsetPolygon(poly: Polygon, delta: number): Polygon | null {
    if (delta === 0) return poly;
    if (poly.length < 3) return null;

    const n = poly.length;
    const newPoly: Point[] = [];

    for (let i = 0; i < n; i++) {
        // Prev, Curr, Next vertices
        const p0 = poly[(i - 1 + n) % n];
        const p1 = poly[i];
        const p2 = poly[(i + 1) % n];

        // Edge vectors
        const v1 = normalize(sub(p1, p0));
        const v2 = normalize(sub(p2, p1));

        // Normals (Perpendicular 90deg)
        // Normal of v (dx, dy) -> (-dy, dx) assuming CCW winding? 
        // Need to test direction.
        const n1 = [-v1[1], v1[0]]; // Normal to edge p0->p1
        const n2 = [-v2[1], v2[0]]; // Normal to edge p1->p2

        // Determine Miter Point
        // Parallel lines shifted by 'delta' along normal
        // If angle is too sharp, this blows up. We clamp or trim.

        // Simple vector math: P' = P + delta * bisector / sin(alpha/2)
        // ... Implementing robust offset is hard. 
        // fallback: Simple Inset.

        // Let's use the 'Line Intersection' method for offset lines.
        // Line 1: passes through p0+n1*delta, direction v1
        // Line 2: passes through p1+n2*delta, direction v2
        const l1_start = add(p0, mul(n1, delta));
        const l1_end = add(p1, mul(n1, delta));

        const l2_start = add(p1, mul(n2, delta));
        const l2_end = add(p2, mul(n2, delta));

        const ix = getLineIntersectionLine(l1_start, l1_end, l2_start, l2_end);

        if (ix) {
            newPoly.push(ix as Point);
        } else {
            // Collinear or issues
            newPoly.push(add(p1, mul(n1, delta)) as Point);
        }
    }

    // Validation: If area becomes too small or flips, it means it's collapsed.
    // In SVG (Y down), CW is positive. If we offset and it reverses, it's gone.
    const originalArea = getSignedArea(poly);
    const resultArea = getSignedArea(newPoly);

    if (Math.abs(resultArea) < 1 || (originalArea * resultArea < 0)) return null;

    return newPoly;
}

// ----------------------------------------------------------------------
// UTILS
// ----------------------------------------------------------------------

function polygonToRegion(poly: Point[], canvasWidth: number): LayoutRegion {
    // 1. Calculate Bounds in Normalized 0-100% space
    let minX = 100, minY = 100, maxX = 0, maxY = 0;

    // We must normalize coordinates back to 0-100% relative to the total logical canvas
    const normalizedPoly = poly.map(p => {
        const nx = (p[0] / canvasWidth) * 100;
        const ny = p[1]; // Y is already 0-100

        minX = Math.min(minX, nx);
        minY = Math.min(minY, ny);
        maxX = Math.max(maxX, nx);
        maxY = Math.max(maxY, ny);

        return [nx, ny] as Point;
    });

    return {
        id: uuidv4(),
        shape: 'polygon',
        points: normalizedPoly, // The detailed normalized polygon
        bounds: {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        },
        rotation: 0,
        zIndex: 1,
        preserveAspectRatio: false
    };
}

function getIntersection(s1: Segment, s2: Segment): Point | null {
    // Standard AB = CD intersection
    const x1 = s1.p1[0], y1 = s1.p1[1], x2 = s1.p2[0], y2 = s1.p2[1];
    const x3 = s2.p1[0], y3 = s2.p1[1], x4 = s2.p2[0], y4 = s2.p2[1];

    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    const denomX = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    const denomY = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (Math.abs(denomX) < 1e-12) return null; // Increased precision parallel check

    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denomX;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denomX;

    // Be more forgiving at the edges (allow EPSILON overlap)
    if (ua >= -0.01 && ua <= 1.01 && ub >= -0.01 && ub <= 1.01) {
        return [
            x1 + ua * (x2 - x1),
            y1 + ua * (y2 - y1)
        ];
    }
    return null;
}

function getLineIntersectionLine(p1: Point | number[], p2: Point | number[], p3: Point | number[], p4: Point | number[]): Point | null {
    // Similar to above but for infinite lines mostly
    const x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1];
    const x3 = p3[0], y3 = p3[1], x4 = p4[0], y4 = p4[1];

    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (Math.abs(denom) < EPSILON) return null;

    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    // We don't check 0-1 bounds here if we want infinite line intersection
    // BUT for offset, we usually want near vertex.
    return [
        x1 + ua * (x2 - x1),
        y1 + ua * (y2 - y1)
    ];
}

function distSq(p1: Point, p2: Point) {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    return dx * dx + dy * dy;
}

function ptKey(p: Point) { return `${p[0].toFixed(3)},${p[1].toFixed(3)}`; }
function keyToPt(k: string): Point { const [x, y] = k.split(',').map(Number); return [x, y]; }

function isPointEqual(p1: Point, p2: Point) {
    return Math.abs(p1[0] - p2[0]) < EPSILON && Math.abs(p1[1] - p2[1]) < EPSILON;
}

function filterUniquePoints(points: Point[]) {
    const unique: Point[] = [];
    let last: Point | null = null;
    points.forEach(p => {
        if (!last || !isPointEqual(p, last)) {
            unique.push(p);
            last = p;
        }
    });
    return unique;
}

function removeInvalidSegments(segments: Segment[]) {
    return segments.filter(s => !isPointEqual(s.p1, s.p2));
}

function getAngle(center: Point, p: Point) {
    return Math.atan2(p[1] - center[1], p[0] - center[0]);
}

function getSignedArea(loop: Point[]) {
    let area = 0;
    for (let i = 0; i < loop.length; i++) {
        const j = (i + 1) % loop.length;
        area += loop[i][0] * loop[j][1];
        area -= loop[j][0] * loop[i][1];
    }
    return area / 2.0;
}

// Vector math
function add(a: Point | number[], b: Point | number[]) { return [a[0] + b[0], a[1] + b[1]]; }
function sub(a: Point | number[], b: Point | number[]) { return [a[0] - b[0], a[1] - b[1]]; }
function mul(a: Point | number[], s: number) { return [a[0] * s, a[1] * s]; }
function normalize(a: Point | number[]) {
    const len = Math.sqrt(a[0] * a[0] + a[1] * a[1]);
    return len === 0 ? [0, 0] : [a[0] / len, a[1] / len];
}
