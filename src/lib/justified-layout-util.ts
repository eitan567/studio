
import { Photo } from '@/lib/types';
import { AdvancedTemplate, LayoutRegion } from '@/lib/advanced-layout-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates an AdvancedTemplate with a justified layout for the given photos.
 * It attempts to partition photos into `rowCount` rows and fill the container.
 * 
 * Strategy:
 * 1. Split photos into `rowCount` rows such that the sum of aspect ratios in each row is balanced.
 * 2. Assign each row a fixed height percentage (e.g. 50% for 2 rows).
 * 3. In each row, assign photo widths proportional to their aspect ratio to fill 100% width.
 *    This ensures no gaps, but implies photos will be cropped (object-cover) if their native AR 
 *    doesn't match the slot AR.
 */
export function generateJustifiedLayout(photos: Photo[], rowCount: number = 2): AdvancedTemplate {
    if (photos.length === 0) {
        return {
            id: 'empty',
            name: 'Empty',
            category: 'custom',
            photoCount: 0,
            regions: []
        };
    }

    // 1. Calculate Aspect Ratios
    // If width/height missing, assume square or 3:2
    const weights = photos.map(p => (p.width && p.height) ? p.width / p.height : 1.5);

    // 2. Partition into rows
    // We want to minimize variance in sums of ARs (weights)
    const partitionIndices = getLinearPartition(weights, rowCount);

    const regions: LayoutRegion[] = [];
    let photoIndex = 0;
    // Use the actual number of partitions returned (might be <= rowCount)
    const activeRows = partitionIndices.length;
    // Recalculate row height based on actual rows if we want to fill usage?
    // If we asked for 3 rows but got 2, should we use 50% or 33% height?
    // Standard justified layout usually fills height. So 100 / activeRows.
    const rowHeightPercent = 100 / activeRows;

    for (let r = 0; r < activeRows; r++) {
        // Determine photos in this row
        // partitionIndices gives the ending indices (exclusive? or inclusive?)
        // Standard linear partition returns lists. Let's assume we implement a simple one helper.
        // Or actually, let's implement the loop based on the count in each row.

        const countInRow = partitionIndices[r] ? partitionIndices[r].length : 0;
        const rowWeights = partitionIndices[r] || [];

        let currentX = 0;
        const totalWeight = rowWeights.reduce((a, b) => a + b, 0);

        for (let i = 0; i < countInRow; i++) {
            const weight = rowWeights[i];
            const widthPercent = (weight / totalWeight) * 100;

            regions.push({
                id: uuidv4(),
                shape: 'rect',
                bounds: {
                    x: currentX,
                    y: r * rowHeightPercent,
                    width: widthPercent,
                    height: rowHeightPercent
                },
                zIndex: 10
            });

            currentX += widthPercent;
            photoIndex++; // This tracks which photo corresponds to this slot implicitly
        }
    }

    // Ensure we used all photos? The linear partition should handle it.
    // However, advanced template usually maps regions index-to-photo index. 
    // So region[0] -> photos[0]. Order matters.

    return {
        id: 'dynamic-justified',
        name: 'Justified Layout',
        category: 'custom',
        photoCount: photos.length,
        regions
    };
}

// Greedy Linear Partition logic for any k
// Returns array of arrays of weights
function getLinearPartition(weights: number[], k: number): number[][] {
    // console.log('[getLinearPartition] Called with', { weightsCount: weights.length, k });
    if (k <= 0) return [];
    if (k >= weights.length) return weights.map(w => [w]);
    if (k === 1) return [weights];

    // Explicit robust logic for k=2 (Standard Justified Layout uses this)
    if (k === 2) {
        let bestDiff = Infinity;
        let splitIndex = 1;
        let leftSum = 0;
        const totalSum = weights.reduce((a, b) => a + b, 0);

        for (let i = 0; i < weights.length - 1; i++) {
            leftSum += weights[i];
            const rightSum = totalSum - leftSum;
            const diff = Math.abs(leftSum - rightSum);

            // Strictly better or equal?
            if (diff < bestDiff) {
                bestDiff = diff;
                splitIndex = i + 1;
            }
        }
        return [weights.slice(0, splitIndex), weights.slice(splitIndex)];
    }

    // Heuristic for k > 2 (Smart Layout)
    // Simple even chunking is safer than buggy greedy for now, 
    // unless we implement full DP or careful greedy.
    // Let's try to improve "Chunking" by weight-balance rather than count-balance.

    // Target per row
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const target = totalWeight / k;

    const partitions: number[][] = [];
    let currentPartition: number[] = [];
    let currentSum = 0;

    for (let i = 0; i < weights.length; i++) {
        const w = weights[i];

        // If we are on the last row allowed, dump rest
        if (partitions.length === k - 1) {
            currentPartition.push(w);
            continue;
        }

        // Check if adding w exceeds target significantly
        // If currentSum is already decent, and adding w explodes it...

        if (currentSum + w > target && currentPartition.length > 0) {
            // Check deviations
            const diffKeep = Math.abs((currentSum + w) - target);
            const diffSplit = Math.abs(currentSum - target);

            if (diffKeep > diffSplit) {
                // Better to split now
                partitions.push(currentPartition);
                currentPartition = [w];
                currentSum = w;
                continue;
            }
        }

        currentPartition.push(w);
        currentSum += w;
    }

    if (currentPartition.length > 0) {
        partitions.push(currentPartition);
    }

    return partitions;
}

/**
 * Smartly generates a justified layout that attempts to fill the container's aspect ratio.
 * It calculates the optimal number of rows (k) such that the resulting block aspect ratio matches the container.
 * 
 * @param photos List of photos to arrange
 * @param containerAspectRatio Width / Height of the target area (page)
 */
export function generateSmartJustifiedLayout(photos: Photo[], containerAspectRatio: number): AdvancedTemplate {
    console.log('[SmartLayout] Generating', { photoCount: photos.length, containerAspectRatio });

    if (photos.length === 0) {
        return generateJustifiedLayout(photos, 1);
    }

    // 1. Calculate Total Aspect Ratio based on photos
    // Assume average AR of 1.5 if missing dims
    const totalPhotoAspectRatio = photos.reduce((sum, p) => {
        const ar = (p.width && p.height) ? p.width / p.height : 1.5;
        return sum + ar;
    }, 0);

    // 2. Determine Optimal Row Count
    // Use the approximation k = sqrt(totalPhotoAspectRatio / containerAspectRatio)
    // This assumes rows will have roughly balanced aspect ratios.
    // If we assume balanced rows, RowAR_i ≈ totalPhotoAspectRatio / k.
    // Resulting Layout Aspect Ratio = RowAR_i / k ≈ totalPhotoAspectRatio / k^2.
    // We want LayoutAR ≈ containerAspectRatio.
    // => totalPhotoAspectRatio / k^2 ≈ containerAspectRatio
    // => k^2 ≈ totalPhotoAspectRatio / containerAspectRatio
    // => k ≈ sqrt(totalPhotoAspectRatio / containerAspectRatio)

    let optimalRows = Math.round(Math.sqrt(totalPhotoAspectRatio / containerAspectRatio));

    console.log('[SmartLayout] Calculation', { totalPhotoAspectRatio, optimalRowsRaw: Math.sqrt(totalPhotoAspectRatio / containerAspectRatio), rounded: optimalRows });

    // Clamp rows
    // Min 1. Max equal to photo count (1 photo per row).
    optimalRows = Math.max(1, Math.min(photos.length, optimalRows));

    console.log('[SmartLayout] Using Rows:', optimalRows);

    // 3. Generate layout with this row count
    // Reuse the base logic but update the ID/Name
    const baseLayout = generateJustifiedLayout(photos, optimalRows);

    return {
        ...baseLayout,
        id: 'dynamic-justified-smart',
        name: 'Smart Justified'
    };
}
