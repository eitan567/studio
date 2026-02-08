
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
            createdBy: null,
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
        createdBy: null,
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
 * Smartly generates a justified layout that preserves photo aspect ratios.
 * 
 * Algorithm:
 * 1. Try different row configurations
 * 2. For each configuration, calculate scaled dimensions that fill width exactly
 * 3. Choose the configuration that best matches the container height
 * 4. All photos maintain their natural aspect ratios (no cropping)
 * 
 * @param photos List of photos to arrange
 * @param containerAspectRatio Width / Height of the target area (page)
 */
export function generateSmartJustifiedLayout(photos: Photo[], containerAspectRatio: number): AdvancedTemplate {
    console.log('[SmartLayout] Generating', { photoCount: photos.length, containerAspectRatio });

    if (photos.length === 0) {
        return generateJustifiedLayout(photos, 1);
    }

    // Calculate aspect ratios (assume 1.5 if missing dimensions)
    const aspectRatios = photos.map(p => (p.width && p.height) ? p.width / p.height : 1.5);

    console.log('[SmartLayout] Photo aspect ratios:', aspectRatios);

    // Try different number of rows and find the best fit
    const maxRows = Math.min(photos.length, 6); // Max 6 rows
    let bestLayout: { rows: number[][], totalHeight: number, error: number } | null = null;
    let bestRowHeights: number[] = [];

    for (let numRows = 1; numRows <= maxRows; numRows++) {
        const rowPartition = linearPartitionForAspectRatios(aspectRatios, numRows);

        let totalHeightPercent = 0;
        const currentHeightMap: number[] = [];

        for (const rowAspects of rowPartition) {
            const rowAspectSum = rowAspects.reduce((a, b) => a + b, 0);
            const rowHeightPercent = (containerAspectRatio / rowAspectSum) * 100;
            currentHeightMap.push(rowHeightPercent);
            totalHeightPercent += rowHeightPercent;
        }

        // Find configuration closest to 100%
        // We prefer slightly UNDER (positive error) so we can stretch the last row
        // rather than OVER (negative error) which forces shrinking everything
        const error = Math.abs(100 - totalHeightPercent);

        // Bonus: if it's slightly under (85-100%), it's ideal for stretching last row
        const isIdealUnderflow = totalHeightPercent > 85 && totalHeightPercent < 100;
        const weightedError = isIdealUnderflow ? error * 0.5 : error;

        console.log('[SmartLayout] Trying rows:', numRows, { totalHeightPercent, error, weightedError });

        if (!bestLayout || weightedError < bestLayout.error) {
            bestLayout = { rows: rowPartition, totalHeight: totalHeightPercent, error: weightedError };
            bestRowHeights = currentHeightMap;
        }
    }

    if (!bestLayout) {
        return generateJustifiedLayout(photos, 1);
    }

    console.log('[SmartLayout] Best layout:', {
        numRows: bestLayout.rows.length,
        totalHeight: bestLayout.totalHeight,
        error: bestLayout.error
    });

    // Generate the actual layout regions
    // FLEX FILL STRATEGY:
    // - If totalHeight < 100%: Strech LAST row to fill (only last row gets cropped)
    // - If totalHeight > 100%: Scale everything down uniformly (minimal crop on all)

    const regions: LayoutRegion[] = [];
    let currentY = 0;
    const isUnderflow = bestLayout.totalHeight < 100;
    const numRows = bestLayout.rows.length;

    for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
        const rowAspects = bestLayout.rows[rowIndex];
        const rowAspectSum = rowAspects.reduce((a, b) => a + b, 0);
        const isLastRow = rowIndex === numRows - 1;

        let rowHeight: number;

        if (isUnderflow && isLastRow) {
            // STRETCH last row to fill remaining space
            rowHeight = 100 - currentY;
            console.log('[SmartLayout] Stretching last row to fill:', rowHeight.toFixed(1) + '%');
        } else if (!isUnderflow) {
            // Scale all rows uniformly to fit 100%
            const scaleFactor = 100 / bestLayout.totalHeight;
            // Use optimal height calculated earlier
            rowHeight = bestRowHeights[rowIndex] * scaleFactor;
        } else {
            // Natural height for non-last rows in underflow case
            rowHeight = bestRowHeights[rowIndex];
        }

        let currentX = 0;

        for (const ar of rowAspects) {
            const widthPercent = (ar / rowAspectSum) * 100;

            regions.push({
                id: uuidv4(),
                shape: 'rect',
                bounds: {
                    x: currentX,
                    y: currentY,
                    width: widthPercent,
                    height: rowHeight
                },
                zIndex: 10
            });

            currentX += widthPercent;
        }

        currentY += rowHeight;
    }

    return {
        id: 'dynamic-justified-smart',
        name: 'Smart Justified',
        category: 'custom',
        photoCount: photos.length,
        createdBy: null,
        regions
    };
}

/**
 * Linear partition algorithm optimized for balanced aspect ratio sums.
 * Returns array of arrays, where each inner array contains the aspect ratios for that row.
 */
function linearPartitionForAspectRatios(aspectRatios: number[], k: number): number[][] {
    if (k <= 0) return [];
    if (k >= aspectRatios.length) return aspectRatios.map(ar => [ar]);
    if (k === 1) return [aspectRatios];

    const n = aspectRatios.length;
    const totalSum = aspectRatios.reduce((a, b) => a + b, 0);
    const targetPerRow = totalSum / k;

    // Greedy partition that tries to balance sums
    const partitions: number[][] = [];
    let currentPartition: number[] = [];
    let currentSum = 0;

    for (let i = 0; i < n; i++) {
        const ar = aspectRatios[i];

        // If this is the last partition, add everything remaining
        if (partitions.length === k - 1) {
            currentPartition.push(ar);
            continue;
        }

        // Decide whether to add to current partition or start new one
        const withoutThis = Math.abs(currentSum - targetPerRow);
        const withThis = Math.abs(currentSum + ar - targetPerRow);

        if (currentPartition.length > 0 && withoutThis < withThis && partitions.length < k - 1) {
            // Better to start a new partition
            partitions.push(currentPartition);
            currentPartition = [ar];
            currentSum = ar;
        } else {
            currentPartition.push(ar);
            currentSum += ar;
        }
    }

    if (currentPartition.length > 0) {
        partitions.push(currentPartition);
    }

    return partitions;
}

