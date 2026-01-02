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
  photoGap: number; // Gap between photos in pixels
  pageMargin: number; // Margin from page edge in pixels
  backgroundColor: string; // Background color for pages
  backgroundImage?: string; // Default background image URL for pages
};

export type AlbumPage = {
  id: string; // Unique ID for each page
  type: 'single' | 'spread';
  photos: Photo[];
  layout: string; // e.g., '1', '2', '4', '6'
  isCover?: boolean;
  backgroundImage?: string; // Override background image for this specific page
  coverLayouts?: {
    front: string;
    back: string;
  };
  spineText?: string;
  coverType?: 'split' | 'full'; // Defaults to 'split'
};
