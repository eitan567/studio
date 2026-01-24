import { PageEditorWrapper } from '@/components/album/page-editor-wrapper';

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="h-full">
      <PageEditorWrapper albumId={id} />
    </div>
  );
}
