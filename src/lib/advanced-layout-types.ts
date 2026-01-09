/**
 * Advanced Layout Types
 * Supports shapes beyond rectangles: circles, polygons, paths
 */

// Shape types for photo regions
export type ShapeType = 'rect' | 'circle' | 'ellipse' | 'polygon' | 'path';

// Bounds as percentages (0-100)
export interface RegionBounds {
    x: number;      // Left position (%)
    y: number;      // Top position (%)
    width: number;  // Width (%)
    height: number; // Height (%)
}

// Radius for circles/ellipses as percentages
export interface RadiusConfig {
    rx: number; // Horizontal radius (%)
    ry: number; // Vertical radius (%)
}

// A single photo region within a layout
export interface LayoutRegion {
    id: string;
    shape: ShapeType;

    // Position and size as percentages (0-100)
    bounds: RegionBounds;

    // For circles: rx = ry = radius
    // For ellipses: rx and ry can differ
    radius?: RadiusConfig;

    // For polygons: array of [x, y] points as percentages
    // Points are relative to the page, not the bounds
    points?: [number, number][];

    // For complex paths: SVG path data string (d attribute)
    // Coordinates should be in percentages (0-100)
    path?: string;

    // Z-index for overlapping regions (higher = on top)
    zIndex?: number;

    // Optional rotation in degrees
    rotation?: number;

    // Optional label for the region (e.g., "Main Photo", "Accent")
    label?: string;
}

// Template categories
export type TemplateCategory = 'grid' | 'geometric' | 'artistic' | 'diagonal' | 'custom';

// Complete advanced template definition
export interface AdvancedTemplate {
    id: string;
    name: string;
    category: TemplateCategory;

    // Photo regions in this template
    regions: LayoutRegion[];

    // Number of photos this template supports
    photoCount: number;

    // Whether this is a user-created template
    isCustom?: boolean;

    // Who created this template
    createdBy?: 'system' | 'user' | 'ai';

    // Optional thumbnail preview (data URL or path)
    thumbnail?: string;

    // Optional description
    description?: string;
}

// Helper type for creating clip-path CSS
export type ClipPathValue = string;

/**
 * Compute an inset (shrunk) polygon by moving each edge inward perpendicular to itself.
 * Handles aspect ratio by converting to pixels, and skips inset for edges on the container boundary.
 */
/**
 * Compute an inset (shrunk) polygon by moving each edge inward perpendicular to itself
 * This creates uniform visual gaps along all edges regardless of angle
 */
export function insetPolygon(points: [number, number][], insetAmount: number): [number, number][] {
    if (points.length < 3 || insetAmount <= 0) return points;

    const n = points.length;
    const result: [number, number][] = [];

    for (let i = 0; i < n; i++) {
        // Get current point and its neighbors
        const prev = points[(i - 1 + n) % n];
        const curr = points[i];
        const next = points[(i + 1) % n];

        // Edge vectors
        const edge1 = [curr[0] - prev[0], curr[1] - prev[1]]; // from prev to curr
        const edge2 = [next[0] - curr[0], next[1] - curr[1]]; // from curr to next

        // Perpendicular normals (pointing inward - assuming clockwise winding)
        const len1 = Math.sqrt(edge1[0] * edge1[0] + edge1[1] * edge1[1]) || 1;
        const len2 = Math.sqrt(edge2[0] * edge2[0] + edge2[1] * edge2[1]) || 1;

        const normal1: [number, number] = [-edge1[1] / len1, edge1[0] / len1];
        const normal2: [number, number] = [-edge2[1] / len2, edge2[0] / len2];

        // Average of the two normals (bisector)
        let avgNormalX = (normal1[0] + normal2[0]) / 2;
        let avgNormalY = (normal1[1] + normal2[1]) / 2;

        // Normalize the average
        const avgLen = Math.sqrt(avgNormalX * avgNormalX + avgNormalY * avgNormalY) || 1;
        avgNormalX /= avgLen;
        avgNormalY /= avgLen;

        // Scale factor to maintain edge distance (miter join compensation)
        const dot = normal1[0] * avgNormalX + normal1[1] * avgNormalY;
        const scale = dot > 0.1 ? 1 / dot : 1;

        // Move vertex inward
        const newX = curr[0] + avgNormalX * insetAmount * Math.min(scale, 3);
        const newY = curr[1] + avgNormalY * insetAmount * Math.min(scale, 3);

        result.push([newX, newY]);
    }

    return result;
}

/**
 * Generates CSS clip-path value from a LayoutRegion
 * Note: For clip-path to work properly inside the element,
 * we need to convert absolute page coordinates to relative coordinates within the element
 */
export function regionToClipPath(region: LayoutRegion): ClipPathValue {
    switch (region.shape) {
        case 'circle': {
            // For circles, use 50% centered within the element
            return `circle(50% at 50% 50%)`;
        }

        case 'ellipse': {
            return `ellipse(50% 50% at 50% 50%)`;
        }

        case 'polygon': {
            if (!region.points || region.points.length < 3) {
                // Fallback to full rectangle
                return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)`;
            }
            // Convert absolute points to relative within bounds
            const { x, y, width, height } = region.bounds;
            const relativePoints = region.points.map(([px, py]) => {
                const relX = ((px - x) / width) * 100;
                const relY = ((py - y) / height) * 100;
                return `${relX}% ${relY}%`;
            });
            return `polygon(${relativePoints.join(', ')})`;
        }

        case 'path': {
            if (!region.path) {
                return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)`;
            }
            return `path('${region.path}')`;
        }

        case 'rect':
        default: {
            return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)`;
        }
    }
}

/**
 * Generates SVG polygon points for preview rendering
 */
export function regionToSvgPoints(region: LayoutRegion, viewBoxSize: number = 100): string {
    switch (region.shape) {
        case 'polygon': {
            if (!region.points || region.points.length < 3) {
                const { x, y, width, height } = region.bounds;
                return `${x},${y} ${x + width},${y} ${x + width},${y + height} ${x},${y + height}`;
            }
            return region.points.map(([px, py]) => `${px},${py}`).join(' ');
        }
        case 'rect':
        default: {
            const { x, y, width, height } = region.bounds;
            return `${x},${y} ${x + width},${y} ${x + width},${y + height} ${x},${y + height}`;
        }
    }
}

// ==========================================
// PREDEFINED ADVANCED TEMPLATES
// Designed to match user-provided examples
// ==========================================

export const ADVANCED_TEMPLATES: AdvancedTemplate[] = [
    // ========== GRID WITH CIRCLES ==========

    // Center circle with 4 corners (symmetric)
    {
        id: 'center-circle-4',
        name: 'Center Circle',
        category: 'geometric',
        photoCount: 5,
        createdBy: 'system',
        regions: [
            { id: 'tl', shape: 'rect', bounds: { x: 0, y: 0, width: 50, height: 50 }, zIndex: 0 },
            { id: 'tr', shape: 'rect', bounds: { x: 50, y: 0, width: 50, height: 50 }, zIndex: 0 },
            { id: 'bl', shape: 'rect', bounds: { x: 0, y: 50, width: 50, height: 50 }, zIndex: 0 },
            { id: 'br', shape: 'rect', bounds: { x: 50, y: 50, width: 50, height: 50 }, zIndex: 0 },
            { id: 'center', shape: 'circle', bounds: { x: 25, y: 25, width: 50, height: 50 }, zIndex: 1 },
        ],
    },



    // ========== MOSAIC GRIDS ==========

    // Large left + 3 small right (very common pattern)
    {
        id: 'big-left-3',
        name: 'Feature Left',
        category: 'grid',
        photoCount: 4,
        createdBy: 'system',
        regions: [
            { id: 'main', shape: 'rect', bounds: { x: 0, y: 0, width: 60, height: 100 }, zIndex: 0 },
            { id: 'r1', shape: 'rect', bounds: { x: 60, y: 0, width: 40, height: 33.33 }, zIndex: 0 },
            { id: 'r2', shape: 'rect', bounds: { x: 60, y: 33.33, width: 40, height: 33.34 }, zIndex: 0 },
            { id: 'r3', shape: 'rect', bounds: { x: 60, y: 66.67, width: 40, height: 33.33 }, zIndex: 0 },
        ],
    },

    // L-shape with small squares (like user example)
    {
        id: 'l-shape-mosaic',
        name: 'L-Shape Mosaic',
        category: 'grid',
        photoCount: 5,
        createdBy: 'system',
        regions: [
            { id: 'big', shape: 'rect', bounds: { x: 0, y: 0, width: 60, height: 60 }, zIndex: 0 },
            { id: 'tr1', shape: 'rect', bounds: { x: 60, y: 0, width: 40, height: 30 }, zIndex: 0 },
            { id: 'tr2', shape: 'rect', bounds: { x: 60, y: 30, width: 40, height: 30 }, zIndex: 0 },
            { id: 'bl', shape: 'rect', bounds: { x: 0, y: 60, width: 40, height: 40 }, zIndex: 0 },
            { id: 'br', shape: 'rect', bounds: { x: 40, y: 60, width: 60, height: 40 }, zIndex: 0 },
        ],
    },

    // Classic 6-grid (2 rows, 3 columns)
    {
        id: 'grid-6',
        name: '6 Grid',
        category: 'grid',
        photoCount: 6,
        createdBy: 'system',
        regions: [
            { id: 'g1', shape: 'rect', bounds: { x: 0, y: 0, width: 33.33, height: 50 }, zIndex: 0 },
            { id: 'g2', shape: 'rect', bounds: { x: 33.33, y: 0, width: 33.34, height: 50 }, zIndex: 0 },
            { id: 'g3', shape: 'rect', bounds: { x: 66.67, y: 0, width: 33.33, height: 50 }, zIndex: 0 },
            { id: 'g4', shape: 'rect', bounds: { x: 0, y: 50, width: 33.33, height: 50 }, zIndex: 0 },
            { id: 'g5', shape: 'rect', bounds: { x: 33.33, y: 50, width: 33.34, height: 50 }, zIndex: 0 },
            { id: 'g6', shape: 'rect', bounds: { x: 66.67, y: 50, width: 33.33, height: 50 }, zIndex: 0 },
        ],
    },

    // ========== DIAGONAL LAYOUTS ==========

    // 4 diagonal strips (like user example image 2)
    {
        id: 'diagonal-4',
        name: 'Diagonal Strips',
        category: 'diagonal',
        photoCount: 4,
        createdBy: 'system',
        regions: [
            {
                id: 'd1', shape: 'polygon', bounds: { x: 0, y: 0, width: 30, height: 100 },
                points: [[0, 0], [25, 0], [15, 100], [0, 100]], zIndex: 0
            },
            {
                id: 'd2', shape: 'polygon', bounds: { x: 15, y: 0, width: 35, height: 100 },
                points: [[25, 0], [50, 0], [40, 100], [15, 100]], zIndex: 0
            },
            {
                id: 'd3', shape: 'polygon', bounds: { x: 40, y: 0, width: 35, height: 100 },
                points: [[50, 0], [75, 0], [65, 100], [40, 100]], zIndex: 0
            },
            {
                id: 'd4', shape: 'polygon', bounds: { x: 65, y: 0, width: 35, height: 100 },
                points: [[75, 0], [100, 0], [100, 100], [65, 100]], zIndex: 0
            },
        ],
    },

    // Angular shards (3 pieces, like broken glass)
    {
        id: 'angular-3',
        name: 'Angular Shards',
        category: 'diagonal',
        photoCount: 3,
        createdBy: 'system',
        regions: [
            {
                id: 's1', shape: 'polygon', bounds: { x: 0, y: 0, width: 50, height: 100 },
                points: [[0, 0], [45, 0], [30, 60], [0, 50]], zIndex: 0
            },
            {
                id: 's2', shape: 'polygon', bounds: { x: 30, y: 0, width: 70, height: 70 },
                points: [[45, 0], [100, 0], [100, 45], [60, 70], [30, 60]], zIndex: 0
            },
            {
                id: 's3', shape: 'polygon', bounds: { x: 0, y: 45, width: 100, height: 55 },
                points: [[0, 50], [30, 60], [60, 70], [100, 45], [100, 100], [0, 100]], zIndex: 0
            },
        ],
    },

    // ========== ASYMMETRIC ARTISTIC ==========

    // Big + 4 small (like user example image 4)
    {
        id: 'feature-4-small',
        name: 'Feature + 4',
        category: 'artistic',
        photoCount: 5,
        createdBy: 'system',
        regions: [
            { id: 'main', shape: 'rect', bounds: { x: 0, y: 0, width: 50, height: 60 }, zIndex: 0 },
            { id: 'tr1', shape: 'rect', bounds: { x: 50, y: 0, width: 50, height: 30 }, zIndex: 0 },
            { id: 'tr2', shape: 'rect', bounds: { x: 50, y: 30, width: 50, height: 30 }, zIndex: 0 },
            { id: 'bl', shape: 'rect', bounds: { x: 0, y: 60, width: 50, height: 40 }, zIndex: 0 },
            { id: 'br', shape: 'rect', bounds: { x: 50, y: 60, width: 50, height: 40 }, zIndex: 0 },
        ],
    },

    // ========== MOOD BOARD STYLE ==========



    // Mosaic grid (asymmetric, mood board style)
    {
        id: 'mosaic-9',
        name: 'Mosaic Grid',
        category: 'grid',
        photoCount: 9,
        createdBy: 'system',
        regions: [
            { id: 'm1', shape: 'rect', bounds: { x: 0, y: 0, width: 40, height: 33 }, zIndex: 0 },
            { id: 'm2', shape: 'rect', bounds: { x: 40, y: 0, width: 30, height: 33 }, zIndex: 0 },
            { id: 'm3', shape: 'rect', bounds: { x: 70, y: 0, width: 30, height: 50 }, zIndex: 0 },
            { id: 'm4', shape: 'rect', bounds: { x: 0, y: 33, width: 25, height: 34 }, zIndex: 0 },
            { id: 'm5', shape: 'rect', bounds: { x: 25, y: 33, width: 45, height: 34 }, zIndex: 0 },
            { id: 'm6', shape: 'rect', bounds: { x: 70, y: 50, width: 30, height: 50 }, zIndex: 0 },
            { id: 'm7', shape: 'rect', bounds: { x: 0, y: 67, width: 35, height: 33 }, zIndex: 0 },
            { id: 'm8', shape: 'rect', bounds: { x: 35, y: 67, width: 35, height: 33 }, zIndex: 0 },
        ],
    },







    // Vertical strips (3 columns)
    {
        id: 'v-strips-3',
        name: 'V Strips',
        category: 'grid',
        photoCount: 3,
        createdBy: 'system',
        regions: [
            { id: 'v1', shape: 'rect', bounds: { x: 0, y: 0, width: 33, height: 100 }, zIndex: 0 },
            { id: 'v2', shape: 'rect', bounds: { x: 33, y: 0, width: 34, height: 100 }, zIndex: 0 },
            { id: 'v3', shape: 'rect', bounds: { x: 67, y: 0, width: 33, height: 100 }, zIndex: 0 },
        ],
    },

    // Mixed sizes (magazine style)
    {
        id: 'magazine-mix',
        name: 'Magazine Mix',
        category: 'artistic',
        photoCount: 7,
        createdBy: 'system',
        regions: [
            { id: 'big', shape: 'rect', bounds: { x: 0, y: 0, width: 60, height: 70 }, zIndex: 0 },
            { id: 'r1', shape: 'rect', bounds: { x: 60, y: 0, width: 40, height: 35 }, zIndex: 0 },
            { id: 'r2', shape: 'rect', bounds: { x: 60, y: 35, width: 40, height: 35 }, zIndex: 0 },
            { id: 'b1', shape: 'rect', bounds: { x: 0, y: 70, width: 25, height: 30 }, zIndex: 0 },
            { id: 'b2', shape: 'rect', bounds: { x: 25, y: 70, width: 25, height: 30 }, zIndex: 0 },
            { id: 'b3', shape: 'rect', bounds: { x: 50, y: 70, width: 25, height: 30 }, zIndex: 0 },
            { id: 'b4', shape: 'rect', bounds: { x: 75, y: 70, width: 25, height: 30 }, zIndex: 0 },
        ],
    },
];
