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
// Tailwind Safelist Maps - Essential for dynamic classes to be detected by scanner
const GRID_CLASSES = {
    colStart: {
        1: 'col-start-1', 2: 'col-start-2', 3: 'col-start-3', 4: 'col-start-4',
        5: 'col-start-5', 6: 'col-start-6', 7: 'col-start-7', 8: 'col-start-8',
        9: 'col-start-9', 10: 'col-start-10', 11: 'col-start-11', 12: 'col-start-12', 13: 'col-start-13'
    },
    colEnd: {
        1: 'col-end-1', 2: 'col-end-2', 3: 'col-end-3', 4: 'col-end-4',
        5: 'col-end-5', 6: 'col-end-6', 7: 'col-end-7', 8: 'col-end-8',
        9: 'col-end-9', 10: 'col-end-10', 11: 'col-end-11', 12: 'col-end-12', 13: 'col-end-13'
    },
    colSpan: {
        1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4',
        5: 'col-span-5', 6: 'col-span-6', 7: 'col-span-7', 8: 'col-span-8',
        9: 'col-span-9', 10: 'col-span-10', 11: 'col-span-11', 12: 'col-span-12'
    },
    rowStart: {
        1: 'row-start-1', 2: 'row-start-2', 3: 'row-start-3', 4: 'row-start-4',
        5: 'row-start-5', 6: 'row-start-6', 7: 'row-start-7', 8: 'row-start-8',
        9: 'row-start-9', 10: 'row-start-10', 11: 'row-start-11', 12: 'row-start-12', 13: 'row-start-13'
    },
    rowEnd: {
        1: 'row-end-1', 2: 'row-end-2', 3: 'row-end-3', 4: 'row-end-4',
        5: 'row-end-5', 6: 'row-end-6', 7: 'row-end-7', 8: 'row-end-8',
        9: 'row-end-9', 10: 'row-end-10', 11: 'row-end-11', 12: 'row-end-12', 13: 'row-end-13'
    },
    rowSpan: {
        1: 'row-span-1', 2: 'row-span-2', 3: 'row-span-3', 4: 'row-span-4',
        5: 'row-span-5', 6: 'row-span-6', 7: 'row-span-7', 8: 'row-span-8',
        9: 'row-span-9', 10: 'row-span-10', 11: 'row-span-11', 12: 'row-span-12'
    }
};

function rotateGridClass90CW(cls: string): string {
    const parsed = parseGridClass(cls);
    const parts: string[] = [];

    // Grid is 12x12, positions go from 1 to 13 (end is exclusive)

    // Determine column range
    let colStart = parsed.colStart;
    let colEnd = parsed.colEnd;
    if (parsed.colSpan !== undefined && colStart === undefined && colEnd === undefined) {
        // col-span-N without explicit start/end means we need to preserve span behavior
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
            parts.push(GRID_CLASSES.rowSpan[parsed.colSpan as keyof typeof GRID_CLASSES.rowSpan]);
        }
        if (parsed.rowSpan !== undefined) {
            parts.push(GRID_CLASSES.colSpan[parsed.rowSpan as keyof typeof GRID_CLASSES.colSpan]);
        }
        return parts.join(' ');
    }

    // Complex case: we have explicit positions
    // 90° CW: Match Advanced template formula (y, 100-x) → (row, 14-col)
    // old rows → new columns (Direct), old columns → new rows (Mirrored)

    // Calculate new column from old row (Direct for 90° CW)
    if (rowStart !== undefined && rowEnd !== undefined) {
        parts.push(GRID_CLASSES.colStart[rowStart as keyof typeof GRID_CLASSES.colStart]);
        parts.push(GRID_CLASSES.colEnd[rowEnd as keyof typeof GRID_CLASSES.colEnd]);
    } else if (rowStart !== undefined) {
        parts.push(GRID_CLASSES.colStart[rowStart as keyof typeof GRID_CLASSES.colStart]);
    } else if (rowEnd !== undefined) {
        parts.push(GRID_CLASSES.colEnd[rowEnd as keyof typeof GRID_CLASSES.colEnd]);
    } else if (parsed.rowSpan !== undefined) {
        parts.push(GRID_CLASSES.colSpan[parsed.rowSpan as keyof typeof GRID_CLASSES.colSpan]);
    }

    // Calculate new row from old column (Mirrored for 90° CW)
    // Grid positions are 1-based (1-13), so we use 14 - value to mirror
    if (colStart !== undefined && colEnd !== undefined) {
        parts.push(GRID_CLASSES.rowStart[(14 - colEnd) as keyof typeof GRID_CLASSES.rowStart]);
        parts.push(GRID_CLASSES.rowEnd[(14 - colStart) as keyof typeof GRID_CLASSES.rowEnd]);
    } else if (colStart !== undefined) {
        parts.push(GRID_CLASSES.rowEnd[(14 - colStart) as keyof typeof GRID_CLASSES.rowEnd]);
        if (parsed.colSpan !== undefined) {
            const start = 14 - colStart - parsed.colSpan;
            parts.push(GRID_CLASSES.rowStart[start as keyof typeof GRID_CLASSES.rowStart]);
        }
    } else if (colEnd !== undefined) {
        parts.push(GRID_CLASSES.rowStart[(14 - colEnd) as keyof typeof GRID_CLASSES.rowStart]);
    } else if (parsed.colSpan !== undefined) {
        parts.push(GRID_CLASSES.rowSpan[parsed.colSpan as keyof typeof GRID_CLASSES.rowSpan]);
    }

    // Filter out potential undefineds if lookups failed (shouldn't happen within range)
    return parts.filter(Boolean).join(' ');
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

    console.log('[rotateGridTemplate] Input:', grid, 'Angle:', angle, 'Output:', result);
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
