import Link from 'next/link';
import Image from 'next/image';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { placeholderImages } from '@/lib/placeholder-images.json';

const mockAlbums = [
  {
    id: 'travel-2023',
    title: 'Summer in Italy',
    date: 'August 2023',
    coverImageId: 'album-cover-1',
  },
  {
    id: 'family-gathering',
    title: 'Family Reunion',
    date: 'December 2023',
    coverImageId: 'album-cover-2',
  },
  {
    id: 'wedding-album',
    title: 'Our Wedding Day',
    date: 'June 2022',
    coverImageId: 'album-cover-3',
  },
];

export default function DashboardPage() {
  return (
    <div className="px-4 md:px-6 py-10">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-headline text-3xl font-bold">Your Albums</h1>
          <p className="text-muted-foreground">
            Create a new album or continue editing an existing one.
          </p>
        </div>
        <Button asChild>
          <Link href="/album/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Album
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {mockAlbums.map((album) => {
          const coverImage = placeholderImages.find(
            (img) => img.id === album.coverImageId
          );
          return (
            <Link key={album.id} href={`/album/${album.id}`}>
              <Card className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
                <CardHeader className="p-0">
                  {coverImage && (
                    <Image
                      src={coverImage.imageUrl}
                      alt={album.title}
                      width={300}
                      height={400}
                      className="aspect-[3/4] w-full object-cover"
                      data-ai-hint={coverImage.imageHint}
                    />
                  )}
                </CardHeader>
                <CardContent className="p-4">
                  <CardTitle className="font-headline text-xl">
                    {album.title}
                  </CardTitle>
                  <CardDescription>{album.date}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
         <Link href="/album/new">
            <Card className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/50 bg-card transition-colors hover:border-primary hover:bg-accent/50">
                <div className="flex flex-col items-center text-center text-muted-foreground">
                    <PlusCircle className="h-12 w-12" />
                    <span className="mt-2 font-semibold">Create a New Album</span>
                </div>
            </Card>
        </Link>
      </div>
    </div>
  );
}
