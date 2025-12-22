import { AlbumEditor } from '@/components/album/album-editor';

export default function AlbumPage({ params }: { params: { id: string } }) {
  const isNew = params.id === 'new';
  const title = isNew ? 'New Album' : `Editing ${params.id}`; // In a real app, fetch album title

  return (
    <div className="container mx-auto py-8">
      <h1 className="font-headline text-3xl font-bold mb-6">{title}</h1>
      <AlbumEditor albumId={params.id} />
    </div>
  );
}
