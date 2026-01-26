
import { createServerClient } from '@/lib/supabase';
import { TestGalleryContent } from './test-content';

export const dynamic = 'force-dynamic';

export default async function TestGalleryPage() {
    const supabase = createServerClient();

    // Fetch latest 20 photos
    const { data: photos, error } = await supabase
        .from('photos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        return <div className="p-8 text-red-500">Error fetching photos: {error.message}</div>;
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4 text-center">Gallery Math Debug Page</h1>
            <TestGalleryContent initialPhotos={photos || []} />
        </div>
    );
}
