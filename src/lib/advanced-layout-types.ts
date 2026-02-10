// Basic types for geometry
export type Point = [number, number]; // [x, y] in 0-100+ logical coordinates
export type Segment = { p1: Point; p2: Point };

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

    // Localized viewBox for the path (minX minY width height)
    viewBox?: string;

    // Z-index for overlapping regions (higher = on top)
    zIndex?: number;

    // Optional rotation in degrees
    rotation?: number;
    // Optional "ground" orientation used for image placement logic.
    // Unlike `rotation`, this does not imply visual frame transform.
    imageGroundRotation?: number;
    // Marks a background-like frame region. Background regions always keep image horizontal.
    isBackground?: boolean;

    // Styling properties
    stroke?: string;
    strokeWidth?: number;
    fill?: string;
    opacity?: number;

    // Optional label for the region (e.g., "Main Photo", "Accent")
    label?: string;

    // When true, the photo should use object-fit: contain instead of cover
    // This preserves the photo's natural aspect ratio without cropping
    preserveAspectRatio?: boolean;
}

// Complete vector object definition for the editor
export interface VectorObject {
    id: string;
    name?: string;
    type: 'rect' | 'circle' | 'polygon' | 'line' | 'freehand' | 'path';
    segments: Segment[]; // The atomic lines
    points?: Point[];    // The original points if applicable (e.g. for rect/circle)
    path?: string;       // For complex SVG paths
    viewBox?: string;    // ViewBox for path objects
    stroke: string;
    strokeWidth: number;
    fill?: string;
    opacity?: number;
    zIndex: number;
    rotation: number;
    // Mirror property (if this object was created as a mirror or has a partner)
    mirrorPartnerId?: string;
    isMirror?: boolean;
}

// Template categories
export type TemplateCategory = 'grid' | 'geometric' | 'artistic' | 'diagonal' | 'custom';
export type TemplateImageRotationMode = 'follow-frame' | 'keep-horizontal';

// Complete advanced template definition
// Complete advanced template definition aligned with DB
export interface AdvancedTemplate {
    // Core Identity
    id: string | number;
    name: string;

    // DB Foreign Keys & Classifications
    type_id?: number | null;
    category_id?: number | null;
    classification_type_id?: number | null;

    // Derived/Mapped fields for UI (kept for compatibility)
    category: TemplateCategory;
    type?: 'single' | 'spread' | 'both';

    // Photo regions in this template
    regions: LayoutRegion[];

    // Number of photos this template supports
    photoCount: number;

    // Ownership & System Status
    isCustom?: boolean;
    is_system?: boolean | null;
    is_active?: boolean | null;

    // UUID of creator (or null for system/public templates)
    createdBy: string | null;

    // Metadata
    description?: string | null;
    thumbnail?: string | null;
    sort_order?: number | null;

    // Timestamps
    created_at?: string | null;
    updated_at?: string | null;

    // Page settings for custom templates (used when template was created)
    _pageMargin?: number;
    _photoGap?: number;

    // Editor snapshot metadata (used to restore exact editable objects)
    _editorVersion?: number;
    _editorSpreadMode?: 'full' | 'split';
    _editorObjects?: VectorObject[];
    // Controls how photos are oriented inside rotated regions for this template
    _imageRotationMode?: TemplateImageRotationMode;
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
            // For circles, use 50% of the closest side to ensure it remains a circle
            // even if the container is not square.
            return `circle(closest-side)`;
        }

        case 'ellipse': {
            // Similarly for ellipses if we want them to remain circular or 
            // at least be centered and contained.
            return `ellipse(closest-side closest-side at 50% 50%)`;
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

// NO HARDCODED TEMPLATES HERE - ALL TEMPLATES COME FROM DB OR TEMPLATES-CACHE.TS
