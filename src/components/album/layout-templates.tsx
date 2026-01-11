export const LAYOUT_TEMPLATES = [
  {
    id: '1-full',
    name: '1 Photo',
    photoCount: 1,
    grid: ['col-span-12 row-span-12'],
  },
  {
    id: '2-horiz',
    name: '2 Photos',
    photoCount: 2,
    grid: ['col-span-6 row-span-12', 'col-span-6 row-span-12'],
  },
  {
    id: '2-vert',
    name: '2 Photos',
    photoCount: 2,
    grid: ['col-span-12 row-span-6', 'col-span-12 row-span-6'],
  },
  {
    id: '3-vert-lead',
    name: '3 Photos',
    photoCount: 3,
    grid: [
      'col-start-1 col-end-8 row-span-12',
      'col-start-8 col-end-13 row-start-1 row-end-7',
      'col-start-8 col-end-13 row-start-7 row-end-13',
    ],
  },
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
  // 4 Photos - Based on 3-vert-lead (large left + 3 small stacked right)
  {
    id: '4-vert-lead',
    name: '4 Photos',
    photoCount: 4,
    grid: [
      'col-start-1 col-end-8 row-span-12',            // Same large frame as 3-vert-lead
      'col-start-8 col-end-13 row-start-1 row-end-5', // 3 equal small frames (rows 1-5, 5-9, 9-13)
      'col-start-8 col-end-13 row-start-5 row-end-9',
      'col-start-8 col-end-13 row-start-9 row-end-13',
    ],
  },
  // 4 Photos - Based on 3-horiz-lead (large top + 3 small columns bottom)
  {
    id: '4-horiz-lead',
    name: '4 Photos',
    photoCount: 4,
    grid: [
      'col-span-12 row-start-1 row-end-8',            // Same large frame as 3-horiz-lead
      'col-start-1 col-end-5 row-start-8 row-end-13', // 3 equal small frames (columns 1-5, 5-9, 9-13)
      'col-start-5 col-end-9 row-start-8 row-end-13',
      'col-start-9 col-end-13 row-start-8 row-end-13',
    ],
  },
  {
    id: '4-grid',
    name: '4 Photos',
    photoCount: 4,
    grid: [
      'col-span-6 row-span-6',
      'col-span-6 row-span-6',
      'col-span-6 row-span-6',
      'col-span-6 row-span-6',
    ],
  },
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
  {
    id: '6-grid',
    name: '6 Photos',
    photoCount: 6,
    grid: [
      'col-span-4 row-span-6',
      'col-span-4 row-span-6',
      'col-span-4 row-span-6',
      'col-span-4 row-span-6',
      'col-span-4 row-span-6',
      'col-span-4 row-span-6',
    ],
  },
];

// For now, cover templates share the same layouts, but this allows for future custom cover-only layouts
export const COVER_TEMPLATES = LAYOUT_TEMPLATES;
