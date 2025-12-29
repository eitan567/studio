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
  