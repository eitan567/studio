'use client';

import Link from 'next/link';
import Image from 'next/image';
import { PlusCircle, Loader2, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Album {
  id: string;
  name: string;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export default function DashboardPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchAlbums() {
      try {
        const response = await fetch('/api/albums');
        if (response.ok) {
          const data = await response.json();
          setAlbums(data.albums || []);
        }
      } catch (error) {
        console.error('Failed to fetch albums:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAlbums();
  }, []);

  const handleDelete = async (albumId: string) => {
    setDeletingId(albumId);
    try {
      const response = await fetch(`/api/albums/${albumId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAlbums(prev => prev.filter(a => a.id !== albumId));
        toast({
          title: 'Album Deleted',
          description: 'The album has been permanently deleted.',
        });
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: 'Could not delete the album. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="px-4 md:px-6 py-10">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-headline text-3xl font-bold">Your Albums</h1>
          <p className="text-muted-foreground">
            {user?.email ? `Welcome, ${user.email}` : 'Create a new album or continue editing an existing one.'}
          </p>
        </div>
        <Button asChild>
          <Link href="/album/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Album
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-16 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading your albums...</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {albums.map((album) => (
            <div key={album.id} className="group relative">
              <Link href={`/album/${album.id}`}>
                <Card className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
                  <CardHeader className="p-0">
                    {album.thumbnail_url ? (
                      <Image
                        src={album.thumbnail_url}
                        alt={album.name}
                        width={300}
                        height={400}
                        className="aspect-[3/4] w-full object-cover"
                      />
                    ) : (
                      <div className="aspect-[3/4] w-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <span className="text-4xl">📚</span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="p-4">
                    <CardTitle className="font-headline text-xl">
                      {album.name}
                    </CardTitle>
                    <CardDescription>{formatDate(album.updated_at)}</CardDescription>
                  </CardContent>
                </Card>
              </Link>

              {/* Delete button overlay */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {deletingId === album.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Album</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{album.name}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(album.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}

          <Link href="/album/new">
            <Card className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/50 bg-card transition-colors hover:border-primary hover:bg-accent/50">
              <div className="flex flex-col items-center text-center text-muted-foreground">
                <PlusCircle className="h-12 w-12" />
                <span className="mt-2 font-semibold">Create a New Album</span>
              </div>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
}
