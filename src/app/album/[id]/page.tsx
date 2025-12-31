import { AlbumEditor } from '@/components/album/album-editor';

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === 'new';
  const title = isNew ? 'New Album' : `Editing ${id}`; // In a real app, fetch album title

  return (
    <div className="px-4 md:px-6 mx-auto py-8">
      <h1 className="font-headline text-3xl font-bold mb-6">{title}</h1>
      <AlbumEditor albumId={id} />
    </div>
  );
}
