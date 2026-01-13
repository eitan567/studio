import { AlbumEditorWrapper } from '@/components/album/album-editor-wrapper';

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="h-full">
      <AlbumEditorWrapper albumId={id} />
    </div>
  );
}
