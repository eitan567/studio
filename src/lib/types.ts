export type Photo = {
  id: string;
  src: string;
  alt: string;
};

export type AlbumConfig = {
  photosPerSpread: 2 | 4 | 6;
  size: '20x20' | '25x25' | '30x30';
};

export type AlbumPage = {
  type: 'single' | 'spread';
  photos: Photo[];
};
