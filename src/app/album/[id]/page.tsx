import { AlbumEditor } from '@/components/album/album-editor';

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === 'new';
  const title = isNew ? 'New Album' : `Editing ${id}`; // In a real app, fetch album title

  return (
    <div className="h-full">
      <AlbumEditor albumId={id} />
    </div>
  );
}
