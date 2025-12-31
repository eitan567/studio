export type PhotoPanAndZoom = {
  scale: number;
  x: number;
  y: number;
};

export type Photo = {
  id: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
  panAndZoom?: PhotoPanAndZoom;
};

export type AlbumConfig = {
  size: '20x20' | '25x25' | '30x30';
};

export type AlbumPage = {
  id: string; // Unique ID for each page
  type: 'single' | 'spread';
  photos: Photo[];
  layout: string; // e.g., '1', '2', '4', '6'
  isCover?: boolean;
};
