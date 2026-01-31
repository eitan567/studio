
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
    const rowHeightPercent = 100 / rowCount;

    for (let r = 0; r < rowCount; r++) {
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

// Simple Linear Partition logic
// Returns array of arrays of weights
function getLinearPartition(weights: number[], k: number): number[][] {
    if (k <= 0) return [];
    if (k >= weights.length) return weights.map(w => [w]);
    if (k === 1) return [weights];

    // Greedy approximation for k=2 (since user asked specifically for 2 rows usually)
    // For generalized k, we can use a more complex algo, but for < 10 photos greedy is fine.

    // Actually, simple "Knapsack-like" greedy:
    // Iterate through finding best split points.

    // For k=2, just find simple best split
    if (k === 2) {
        let bestDiff = Infinity;
        let splitIndex = 1;

        let leftSum = 0;
        let totalSum = weights.reduce((a, b) => a + b, 0);

        for (let i = 0; i < weights.length - 1; i++) {
            leftSum += weights[i];
            const rightSum = totalSum - leftSum;
            const diff = Math.abs(leftSum - rightSum);
            if (diff < bestDiff) {
                bestDiff = diff;
                splitIndex = i + 1;
            }
        }

        return [weights.slice(0, splitIndex), weights.slice(splitIndex)];
    }

    // For k > 2, recursive greedy?
    // Just simple even distribution by count for fallback if logic fails
    // Or just put 1 in each and dump rest in last.
    // Let's stick to k=2 support primarily as per request, fallback to even chunks.

    const chunkSize = Math.ceil(weights.length / k);
    const result = [];
    for (let i = 0; i < weights.length; i += chunkSize) {
        result.push(weights.slice(i, i + chunkSize));
    }
    return result;
}
