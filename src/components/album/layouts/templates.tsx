/**
 * Unified Layout Templates
 * All templates use region-based format for consistency
 */

import { AdvancedTemplate, LayoutRegion } from '@/lib/advanced-layout-types';

// Helper to create a rectangular region
const rect = (id: string, x: number, y: number, width: number, height: number): LayoutRegion => ({
  id,
  shape: 'rect',
  bounds: { x, y, width, height }
});

/**
 * Standard Layout Templates (converted from Grid to Region-based)
 * Uses percentage-based positioning (0-100)
 */
const STATIC_LAYOUTS: AdvancedTemplate[] = [
  // 1 Photo - Full Page
  {
    id: '1-full',
    name: '1 Photo',
    category: 'grid',
    type: 'single',
    photoCount: 1,
    isCustom: false,
    is_system: true,
    createdBy: null,
    type_id: 1, // Single Page
    category_id: 1, // Grid
    regions: [
      rect('r1', 0, 0, 100, 100)
    ]
  },

  // 2 Photos - Left/Right Split
  {
    id: '2-horiz',
    name: '2 Photos',
    category: 'grid',
    type: 'single',
    photoCount: 2,
    isCustom: false,
    is_system: true,
    createdBy: null,
    type_id: 1,
    category_id: 1,
    regions: [
      rect('r1', 0, 0, 50, 100),
      rect('r2', 50, 0, 50, 100)
    ]
  },

  // 3 Photos - Large top + 2 small bottom
  {
    id: '3-horiz-lead',
    name: '3 Photos',
    category: 'grid',
    type: 'single',
    photoCount: 3,
    isCustom: false,
    is_system: true,
    createdBy: null,
    type_id: 1,
    category_id: 1,
    regions: [
      rect('r1', 0, 0, 100, 58.33),
      rect('r2', 0, 58.33, 50, 41.67),
      rect('r3', 50, 58.33, 50, 41.67)
    ]
  },

  // 4 Photos - Large left + 3 stacked right
  {
    id: '4-vert-lead',
    name: '4 Photos',
    category: 'grid',
    type: 'single',
    photoCount: 4,
    isCustom: false,
    is_system: true,
    createdBy: null,
    type_id: 1,
    category_id: 1,
    regions: [
      rect('r1', 0, 0, 58.33, 100),
      rect('r2', 58.33, 0, 41.67, 33.33),
      rect('r3', 58.33, 33.33, 41.67, 33.33),
      rect('r4', 58.33, 66.67, 41.67, 33.33)
    ]
  },

  // 4 Photos - Asymmetric Mosaic
  {
    id: '4-mosaic-1',
    name: '4 Photos Mosaic',
    category: 'grid',
    type: 'single',
    photoCount: 4,
    isCustom: false,
    is_system: true,
    createdBy: null,
    type_id: 1,
    category_id: 1,
    regions: [
      rect('r1', 0, 0, 66.67, 58.33),
      rect('r2', 66.67, 0, 33.33, 58.33),
      rect('r3', 0, 58.33, 50, 41.67),
      rect('r4', 50, 58.33, 50, 41.67)
    ]
  },

  // 6 Photos - Mosaic Grid
  {
    id: '6-mosaic-grid',
    name: 'Mosaic Grid',
    category: 'grid',
    type: 'single',
    photoCount: 6,
    isCustom: false,
    is_system: true,
    createdBy: null,
    type_id: 1,
    category_id: 1,
    regions: [
      rect('r1', 0, 0, 66.67, 66.67),         // Large Top-Left
      rect('r2', 66.67, 0, 33.33, 33.33),     // Small Top-Right
      rect('r3', 66.67, 33.33, 33.33, 33.33), // Small Mid-Right
      rect('r4', 0, 66.67, 33.33, 33.33),     // Small Bottom-Left
      rect('r5', 33.33, 66.67, 33.33, 33.33), // Small Bottom-Mid
      rect('r6', 66.67, 66.67, 33.33, 33.33)  // Small Bottom-Right
    ]
  }
];

// Export templates (Canva frames are now vector tools, not templates)
export const LAYOUT_TEMPLATES: AdvancedTemplate[] = [
  ...STATIC_LAYOUTS
];

// Cover templates share the same layouts
export const COVER_TEMPLATES = LAYOUT_TEMPLATES;

