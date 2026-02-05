import { RotationAngle } from './template-rotation';

/**
 * Robustly parses a layout ID into its base template ID and rotation.
 * Handles string IDs with _r90/180/270 suffixes and numeric IDs.
 * 
 * @param layoutId - The ID to parse (string, number, or null/undefined)
 * @returns An object containing the baseId and the rotation angle
 */
export function parseLayoutId(layoutId: string | number | null | undefined): { baseId: string | number; rotation: RotationAngle } {
    if (layoutId === null || layoutId === undefined) {
        return { baseId: '', rotation: 0 };
    }

    // Numbers never have rotation suffixes in this system
    if (typeof layoutId === 'number') {
        return { baseId: layoutId, rotation: 0 };
    }

    const layoutIdStr = String(layoutId);

    // Check for rotation suffix (_r90, _r180, _r270)
    const rotationMatch = layoutIdStr.match(/_r(90|180|270)$/);

    if (rotationMatch) {
        const rotation = parseInt(rotationMatch[1], 10) as RotationAngle;
        const baseIdStr = layoutIdStr.replace(/_r(90|180|270)$/, '');

        // Return string baseId for string inputs with rotation
        return { baseId: baseIdStr, rotation };
    }

    // If no rotation match, return the original layoutId
    return { baseId: layoutId, rotation: 0 };
}
