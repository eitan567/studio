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
  captureDate?: Date; // EXIF capture date for sorting
};

export type AlbumConfig = {
  size: '20x20' | '25x25' | '30x30';
  photoGap: number; // Gap between photos in pixels
  pageMargin: number; // Margin from page edge in pixels
  backgroundColor: string; // Background color for pages
  backgroundImage?: string; // Default background image URL for pages
  cornerRadius?: number; // Corner radius for photo frames in pixels (default 0)
};

// New Interface for Cover Text Objects
export interface CoverText {
  id: string;
  groupId?: string;
  text: string;
  x: number; // percentage
  y: number; // percentage
  style: {
    fontFamily: string;
    fontSize: number;
    color: string;
    fontWeight?: string;
    fontStyle?: string;
    textShadow?: string;
    textAlign?: 'left' | 'center' | 'right';
  };
}

export interface CoverImage {
  id: string;
  url: string;
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  aspectRatio: number; // width / height
  rotation: number;
  opacity: number;
  zIndex?: number;
}

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
  spineWidth?: number;
  spineColor?: string;
  spineTextColor?: string;
  spineFontSize?: number;
  spineFontFamily?: string;
  spineFontWeight?: string;
  spineFontStyle?: string;
  spineTextAlign?: 'left' | 'center' | 'right';
  spineTextRotated?: boolean;

  backgroundColor?: string; // Override background color for this specific page

  // Granular Cover Settings
  photoGap?: number;
  pageMargin?: number;
  cornerRadius?: number;

  // Cover Objects
  coverTexts?: CoverText[];
  coverImages?: CoverImage[];

  // Legacy Cover Title Props (Keep for migration if needed, or deprecate)
  titleText?: string;
  titleColor?: string;
  titleFontSize?: number;
  titleFontFamily?: string;
  titlePosition?: { x: number; y: number }; // Percentage 0-100

  coverType?: 'split' | 'full'; // Defaults to 'split'

  // Spread Settings for regular pages
  spreadMode?: 'full' | 'split';
  spreadLayouts?: {
    left: string;
    right: string;
  };
};
