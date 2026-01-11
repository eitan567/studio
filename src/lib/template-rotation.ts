/**
 * Template Rotation Utilities
 * Provides functions to rotate templates by 90°, 180°, or 270°
 */

import { AdvancedTemplate, LayoutRegion, RegionBounds } from './advanced-layout-types';

export type RotationAngle = 0 | 90 | 180 | 270;

/**
 * Rotate a point (x, y) around the center (50, 50) by the given angle
 * All coordinates are percentages (0-100)
 */
function rotatePoint(x: number, y: number, angle: RotationAngle): [number, number] {
    switch (angle) {
        case 0:
            return [x, y];
        case 90:
            // 90° clockwise: (x, y) → (y, 100 - x)
            return [y, 100 - x];
        case 180:
            // 180°: (x, y) → (100 - x, 100 - y)
            return [100 - x, 100 - y];
        case 270:
            // 270° clockwise (or 90° counter-clockwise): (x, y) → (100 - y, x)
            return [100 - y, x];
        default:
            return [x, y];
    }
}

/**
 * Rotate a bounding box by the given angle
 * Returns new bounds with adjusted position and swapped dimensions for 90°/270°
 */
function rotateBounds(bounds: RegionBounds, angle: RotationAngle): RegionBounds {
    const { x, y, width, height } = bounds;

    // Get corner positions
    const topLeft: [number, number] = [x, y];
    const topRight: [number, number] = [x + width, y];
    const bottomLeft: [number, number] = [x, y + height];
    const bottomRight: [number, number] = [x + width, y + height];

    // Rotate all corners
    const corners = [topLeft, topRight, bottomLeft, bottomRight].map(([px, py]) =>
        rotatePoint(px, py, angle)
    );

    // Find new bounding box
    const xs = corners.map(c => c[0]);
    const ys = corners.map(c => c[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

/**
 * Rotate a region (handles all shape types)
 */
function rotateRegion(region: LayoutRegion, angle: RotationAngle): LayoutRegion {
    if (angle === 0) return region;

    const newBounds = rotateBounds(region.bounds, angle);

    // For polygons, also rotate all points
    let newPoints: [number, number][] | undefined;
    if (region.shape === 'polygon' && region.points) {
        newPoints = region.points.map(([px, py]) => rotatePoint(px, py, angle));
    }

    return {
        ...region,
        bounds: newBounds,
        points: newPoints
    };
}

/**
 * Rotate an advanced template by the given angle
 * Returns a new template with rotated regions
 */
export function rotateAdvancedTemplate(
    template: AdvancedTemplate,
    angle: RotationAngle
): AdvancedTemplate {
    if (angle === 0) return template;

    return {
        ...template,
        id: `${template.id}_r${angle}`,  // Create unique ID for rotated version
        regions: template.regions.map(region => rotateRegion(region, angle))
    };
}

/**
 * Parse a Tailwind grid class and extract span/start/end values
 */
function parseGridClass(cls: string): {
    colSpan?: number;
    colStart?: number;
    colEnd?: number;
    rowSpan?: number;
    rowStart?: number;
    rowEnd?: number;
} {
    const result: ReturnType<typeof parseGridClass> = {};

    // col-span-N
    const colSpan = cls.match(/col-span-(\d+)/);
    if (colSpan) result.colSpan = parseInt(colSpan[1]);

    // col-start-N
    const colStart = cls.match(/col-start-(\d+)/);
    if (colStart) result.colStart = parseInt(colStart[1]);

    // col-end-N
    const colEnd = cls.match(/col-end-(\d+)/);
    if (colEnd) result.colEnd = parseInt(colEnd[1]);

    // row-span-N
    const rowSpan = cls.match(/row-span-(\d+)/);
    if (rowSpan) result.rowSpan = parseInt(rowSpan[1]);

    // row-start-N
    const rowStart = cls.match(/row-start-(\d+)/);
    if (rowStart) result.rowStart = parseInt(rowStart[1]);

    // row-end-N
    const rowEnd = cls.match(/row-end-(\d+)/);
    if (rowEnd) result.rowEnd = parseInt(rowEnd[1]);

    return result;
}

/**
 * Rotate a single grid class by 90° clockwise
 * 
 * 90° CW rotation on a 12x12 grid:
 * - Columns become rows (mirrored)
 * - Rows become columns
 * 
 * For a cell at (col, row), after 90° CW rotation it ends up at (row, 12 - col)
 * 
 * Examples:
 * - col-span-6 row-span-12 → col-span-12 row-span-6
 * - col-start-1 col-end-8 row-span-12 → col-span-12 row-start-5 row-end-13
 */
function rotateGridClass90CW(cls: string): string {
    const parsed = parseGridClass(cls);
    const parts: string[] = [];

    // Grid is 12x12, positions go from 1 to 13 (end is exclusive)

    // Determine column range
    let colStart = parsed.colStart;
    let colEnd = parsed.colEnd;
    if (parsed.colSpan !== undefined && colStart === undefined && colEnd === undefined) {
        // col-span-N without explicit start/end means we need to preserve span behavior
        // This happens in simple templates like "col-span-6 row-span-12"
        // For span-only classes, we just swap col↔row spans
    }
    if (colStart !== undefined && colEnd === undefined && parsed.colSpan !== undefined) {
        colEnd = colStart + parsed.colSpan;
    }

    // Determine row range
    let rowStart = parsed.rowStart;
    let rowEnd = parsed.rowEnd;
    if (parsed.rowSpan !== undefined && rowStart === undefined && rowEnd === undefined) {
        // row-span-N without explicit start/end
    }
    if (rowStart !== undefined && rowEnd === undefined && parsed.rowSpan !== undefined) {
        rowEnd = rowStart + parsed.rowSpan;
    }

    // For span-only templates (no start/end), just swap col-span ↔ row-span
    const hasExplicitColPosition = parsed.colStart !== undefined || parsed.colEnd !== undefined;
    const hasExplicitRowPosition = parsed.rowStart !== undefined || parsed.rowEnd !== undefined;

    if (!hasExplicitColPosition && !hasExplicitRowPosition) {
        // Simple case: just swap col-span and row-span
        if (parsed.colSpan !== undefined) {
            parts.push(`row-span-${parsed.colSpan}`);
        }
        if (parsed.rowSpan !== undefined) {
            parts.push(`col-span-${parsed.rowSpan}`);
        }
        return parts.join(' ');
    }

    // Complex case: we have explicit positions
    // 90° CW: old columns → new rows (mirrored), old rows → new columns

    // Calculate new column position from old row position
    if (rowStart !== undefined && rowEnd !== undefined) {
        parts.push(`col-start-${rowStart}`);
        parts.push(`col-end-${rowEnd}`);
    } else if (rowStart !== undefined) {
        parts.push(`col-start-${rowStart}`);
        if (parsed.rowSpan !== undefined) {
            parts.push(`col-end-${rowStart + parsed.rowSpan}`);
        }
    } else if (rowEnd !== undefined) {
        parts.push(`col-end-${rowEnd}`);
    } else if (parsed.rowSpan !== undefined) {
        parts.push(`col-span-${parsed.rowSpan}`);
    }

    // Calculate new row position from old column position (mirrored)
    if (colStart !== undefined && colEnd !== undefined) {
        // Mirror: new row starts at (13 - colEnd), ends at (13 - colStart)
        parts.push(`row-start-${13 - colEnd}`);
        parts.push(`row-end-${13 - colStart}`);
    } else if (colStart !== undefined && colEnd === undefined) {
        if (parsed.colSpan !== undefined) {
            const impliedEnd = colStart + parsed.colSpan;
            parts.push(`row-start-${13 - impliedEnd}`);
            parts.push(`row-end-${13 - colStart}`);
        } else {
            parts.push(`row-end-${13 - colStart}`);
        }
    } else if (colEnd !== undefined) {
        parts.push(`row-start-${13 - colEnd}`);
    } else if (parsed.colSpan !== undefined) {
        parts.push(`row-span-${parsed.colSpan}`);
    }

    return parts.join(' ');
}

/**
 * Rotate grid template classes by the given angle
 */
export function rotateGridTemplate(grid: string[], angle: RotationAngle): string[] {
    if (angle === 0) return grid;

    // Apply rotation incrementally
    let result = [...grid];
    const rotations = angle / 90;

    for (let i = 0; i < rotations; i++) {
        result = result.map(rotateGridClass90CW);
    }

    return result;
}

/**
 * Get the next rotation angle (cycles through 0 → 90 → 180 → 270 → 0)
 */
export function getNextRotation(current: RotationAngle): RotationAngle {
    const rotations: RotationAngle[] = [0, 90, 180, 270];
    const currentIndex = rotations.indexOf(current);
    return rotations[(currentIndex + 1) % 4];
}
