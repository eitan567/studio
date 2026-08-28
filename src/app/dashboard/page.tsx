'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Trash2,
  PlusCircle,
  Loader2,
  BookImage,
  Pencil,
  Settings,
  Shield,
  PackageOpen,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { SettingsDialog } from '@/components/settings-dialog';
import { CreateAlbumDialog } from '@/components/dashboard/create-album-dialog';
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

import { Album } from '@/lib/types';
import { restoreFullAlbumFromZip } from '@/lib/album-full-backup';

import { AdminSettingsDialog } from '@/components/admin/admin-settings-dialog';

export default function DashboardPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [isFullRestoring, setIsFullRestoring] = useState(false);
  const [fullRestoreProgressLabel, setFullRestoreProgressLabel] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const fullRestoreInputRef = useRef<HTMLInputElement>(null);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const fetchAlbums = async () => {
    try {
      const response = await fetch('/api/albums');
      if (response.ok) {
        const data = await response.json();
        // Ensure data matches expected type (handle missing optional fields if any)
        setAlbums(data.albums || []);
      }
    } catch (error) {
      logger.error('Failed to fetch albums:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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

  const handleFullRestoreFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setIsFullRestoring(true);
    setFullRestoreProgressLabel('Reading ZIP file...');

    try {
      const result = await restoreFullAlbumFromZip(selectedFile, (progress) => {
        setFullRestoreProgressLabel(progress.label || 'Processing...');
      });

      toast({
        title: 'Full Restore Complete!',
        description: `Album "${result.albumName}" created with ${result.photosUploaded} photos and ${result.pagesCount} pages. Redirecting...`,
      });

      await fetchAlbums();

      // Navigate to the newly created album
      router.push(`/album/${result.albumId}`);
    } catch (error) {
      console.error('[FullRestore] Error restoring album from ZIP:', error);
      const message = error instanceof Error ? error.message : 'Failed to restore album from ZIP.';
      toast({
        title: 'Full Restore Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      event.target.value = '';
      setIsFullRestoring(false);
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
    <>
      {/* Full-screen loading overlay during deletion */}
      {deletingId && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground animate-pulse">Deleting album...</p>
        </div>
      )}

      {/* Full-screen loading overlay during full restore */}
      {isFullRestoring && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-foreground font-medium text-lg">{fullRestoreProgressLabel || 'Restoring full album...'}</p>
          <p className="mt-1 text-sm text-muted-foreground animate-pulse">Uploading photos & creating new album...</p>
        </div>
      )}

      <input
        ref={fullRestoreInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={handleFullRestoreFile}
      />

      {/* Full-screen grid background — fills entire main area */}
      <div
        className="h-full flex flex-col bg-muted/30 dark:bg-muted/10"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--foreground) / 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--foreground) / 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}
      >
        {/* Pinned header — never scrolls */}
        <div className="flex-none px-4 md:px-8 pt-8 pb-4 max-w-7xl w-full mx-auto">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h1 className="heading-lg">Your Albums</h1>
              <p className="text-muted-foreground text-sm">
                {user?.email ? `Welcome back, ${user.email}` : 'Manage your photo collections.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Admin Button - Only visible to admins */}
              {user && isAdmin && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                    title="Admin Panel"
                    onClick={() => setAdminOpen(true)}
                  >
                    <Shield className="h-5 w-5" />
                  </Button>
                  <AdminSettingsDialog open={adminOpen} onOpenChange={setAdminOpen} />
                </>
              )}
              <Button
                variant="outline"
                size="icon"
                title="Settings"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                title="Restore Full Album from ZIP"
                onClick={() => fullRestoreInputRef.current?.click()}
                disabled={isFullRestoring}
              >
                {isFullRestoring ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PackageOpen className="h-4 w-4 text-primary" />
                )}
                <span className="hidden sm:inline">
                  {isFullRestoring ? 'Restoring...' : 'Full Restore'}
                </span>
              </Button>
              <CreateAlbumDialog onAlbumCreated={fetchAlbums} />
            </div>
          </div>
        </div>

        {/* Scrollable cards area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
          <div className="max-w-7xl mx-auto">
            {isLoading ? (
              <div className="mt-20 flex flex-col items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground animate-pulse">Loading your masterpieces...</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {/* Create New Card */}
                <CreateAlbumDialog onAlbumCreated={fetchAlbums}>
                  <Card className="group flex h-full min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 transition-all hover:border-primary hover:bg-primary/5">
                    <div className="flex flex-col items-center text-center p-4 space-y-3 transition-transform group-hover:scale-105">
                      <div className="p-3 rounded-full bg-background shadow-sm group-hover:shadow-md transition-shadow">
                        <PlusCircle className="h-7 w-7 text-primary" />
                      </div>
                      <div>
                        <span className="block heading-sm text-foreground">Create New Album</span>
                        <span className="text-sm text-muted-foreground">Start a fresh project</span>
                      </div>
                    </div>
                  </Card>
                </CreateAlbumDialog>

                {/* Album Cards */}
                {albums.map((album, index) => (
                  <div
                    key={album.id}
                    className="group relative"
                  >
                    <div
                      className="cursor-pointer h-full"
                      onClick={() => {
                        setNavigatingId(album.id);
                        router.push(`/album/${album.id}`);
                      }}
                    >
                      <Card className="h-full overflow-hidden rounded-xl border-none shadow-md transition-[box-shadow,transform] duration-200 hover:shadow-xl hover:-translate-y-1 ring-1 ring-border/50 hover:ring-primary/20 bg-card">
                        <div className="aspect-[3/4] overflow-hidden relative">
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 duration-300" />

                          {/* Loading Overlay */}
                          {navigatingId === album.id && (
                            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-30 flex items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                          )}

                          {album.thumbnail_url ? (
                            <Image
                              src={album.thumbnail_url}
                              alt={album.name}
                              width={400}
                              height={533}
                              priority={index < 4}
                              className="h-full w-full object-cover transition-transform duration-300 will-change-transform group-hover:scale-105"
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-primary/10 to-muted flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                              <BookImage className="h-12 w-12 text-primary/40" />
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3 space-y-1">
                          <CardTitle className="heading-sm line-clamp-1 group-hover:text-primary transition-colors">
                            {album.name}
                          </CardTitle>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{album.pages_count ?? 0} pages</span>
                            <span>•</span>
                            <span>{album.photos_count ?? 0} photos</span>
                          </div>
                          <CardDescription className="flex items-center text-xs">
                            {(() => {
                              const totalSlots = album.total_slots ?? 0;
                              const filledSlots = album.filled_slots ?? 0;
                              const isComplete = totalSlots > 0 && filledSlots >= totalSlots;
                              return (
                                <>
                                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${isComplete ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                                  {isComplete ? 'Complete' : `${filledSlots}/${totalSlots} slots filled`}
                                </>
                              );
                            })()}
                          </CardDescription>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Delete button wrapper */}
                    <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                      <CreateAlbumDialog albumToEdit={album} onAlbumUpdated={fetchAlbums}>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-9 w-9 shadow-lg translate-x-2 group-hover:translate-x-0 transition-transform"
                          title="Edit Album"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </CreateAlbumDialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-9 w-9 shadow-lg translate-x-2 group-hover:translate-x-0 transition-transform"
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Settings Modal - Only render when open to avoid background hook execution loops */}
      {settingsOpen && (
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      )}
    </>
  );
}
