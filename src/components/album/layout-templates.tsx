export const LAYOUT_TEMPLATES = [
  {
    id: '1-full',
    name: '1 Photo',
    photoCount: 1,
    grid: ['col-span-12 row-span-12'],
  },
  // 2 Photos - left/right split (rotate for top/bottom)
  {
    id: '2-horiz',
    name: '2 Photos',
    photoCount: 2,
    grid: ['col-span-6 row-span-12', 'col-span-6 row-span-12'],
  },
  // 3 Photos - large top + 2 small bottom (rotate for other variations)
  {
    id: '3-horiz-lead',
    name: '3 Photos',
    photoCount: 3,
    grid: [
      'col-span-12 row-start-1 row-end-8',
      'col-start-1 col-end-7 row-start-8 row-end-13',
      'col-start-7 col-end-13 row-start-8 row-end-13',
    ],
  },
  // 4 Photos - large left + 3 small stacked right (rotate for other variations)
  {
    id: '4-vert-lead',
    name: '4 Photos',
    photoCount: 4,
    grid: [
      'col-start-1 col-end-8 row-span-12',            // Large frame
      'col-start-8 col-end-13 row-start-1 row-end-5', // 3 equal small frames
      'col-start-8 col-end-13 row-start-5 row-end-9',
      'col-start-8 col-end-13 row-start-9 row-end-13',
    ],
  },
  // 4 Photos - asymmetric mosaic
  {
    id: '4-mosaic-1',
    name: '4 Photos',
    photoCount: 4,
    grid: [
      'col-start-1 col-end-9 row-start-1 row-end-8',
      'col-start-9 col-end-13 row-start-1 row-end-8',
      'col-start-1 col-end-7 row-start-8 row-end-13',
      'col-start-7 col-end-13 row-start-8 row-end-13',
    ],
  },
  // 6 Photos - Mosaic Grid
  {
    id: '6-mosaic-grid',
    name: 'Mosaic Grid',
    photoCount: 6,
    grid: [
      'col-start-1 col-end-9 row-start-1 row-end-9',   // Large Top-Left
      'col-start-9 col-end-13 row-start-1 row-end-5',  // Small Top-Right
      'col-start-9 col-end-13 row-start-5 row-end-9',  // Small Mid-Right
      'col-start-1 col-end-5 row-start-9 row-end-13',  // Small Bottom-Left
      'col-start-5 col-end-9 row-start-9 row-end-13',  // Small Bottom-Mid
      'col-start-9 col-end-13 row-start-9 row-end-13', // Small Bottom-Right
    ],
  },
];

// For now, cover templates share the same layouts, but this allows for future custom cover-only layouts
export const COVER_TEMPLATES = LAYOUT_TEMPLATES;
