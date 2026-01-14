'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Loader2, Settings2, Pencil, BookImage } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Album } from '@/lib/types';


interface CreateAlbumDialogProps {
    children?: React.ReactNode;
    albumToEdit?: Album;
    onAlbumUpdated?: () => void;
    onAlbumCreated?: () => void;
}

export function CreateAlbumDialog({ children, albumToEdit, onAlbumUpdated, onAlbumCreated }: CreateAlbumDialogProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const router = useRouter();
    const { toast } = useToast();

    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Pre-fill form if editing
    useEffect(() => {
        if (open && albumToEdit) {
            setName(albumToEdit.name);
            setDescription(albumToEdit.config?.description || '');
            setPreviewUrl(albumToEdit.thumbnail_url || null);
        } else if (open && !albumToEdit) {
            setName('');
            setDescription('');
            setThumbnailFile(null);
            setPreviewUrl(null);
        }
    }, [open, albumToEdit]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setThumbnailFile(file);
            const objectUrl = URL.createObjectURL(file);
            setPreviewUrl(objectUrl);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            let thumbnailUrl = albumToEdit?.thumbnail_url;
            console.log('[CreateAlbumDialog] Starting submit, initial thumbnailUrl:', thumbnailUrl);
            console.log('[CreateAlbumDialog] thumbnailFile:', thumbnailFile ? thumbnailFile.name : 'none');

            // Upload thumbnail if selected
            if (thumbnailFile) {
                console.log('[CreateAlbumDialog] Uploading thumbnail file...');
                const formData = new FormData();
                formData.append('file', thumbnailFile);

                const uploadResponse = await fetch('/api/photos/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (!uploadResponse.ok) {
                    console.error('[CreateAlbumDialog] Thumbnail upload failed:', uploadResponse.status);
                    throw new Error('Failed to upload thumbnail');
                }

                const uploadData = await uploadResponse.json();
                console.log('[CreateAlbumDialog] Upload response:', uploadData);
                thumbnailUrl = uploadData.url;
                console.log('[CreateAlbumDialog] New thumbnailUrl:', thumbnailUrl);
            }

            const url = albumToEdit ? `/api/albums/${albumToEdit.id}` : '/api/albums';
            const method = albumToEdit ? 'PUT' : 'POST';

            const payload = {
                name: name || 'Untitled Album',
                config: {
                    ...(albumToEdit?.config || {}),
                    description,
                },
                thumbnail_url: thumbnailUrl,
            };
            console.log('[CreateAlbumDialog] Sending payload:', JSON.stringify(payload, null, 2));

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(albumToEdit ? 'Failed to update album' : 'Failed to create album');
            }

            const data = await response.json();

            toast({
                title: albumToEdit ? 'Album Updated' : 'Album Created',
                description: albumToEdit ? 'Changes saved successfully.' : 'Your new album is ready!',
            });

            if (albumToEdit) {
                setOpen(false);
                if (onAlbumUpdated) onAlbumUpdated();
                router.refresh();
                setIsLoading(false);
            } else {
                // Don't close the dialog or stop loading, just navigate
                // This prevents the "flash" of the dashboard
                router.push(`/album/${data.album.id}`);

                // Cleanup state only after navigation starts (or use useEffect to cleanup on unmount)
                // But since we are navigating away, local state doesn't matter much
                setName('');
                setDescription('');
                setThumbnailFile(null);
                setPreviewUrl(null);
            }
        } catch (error) {
            setIsLoading(false);
            console.error(error);
            toast({
                title: 'Error',
                description: `Failed to ${albumToEdit ? 'update' : 'create'} album. Please try again.`,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create New Album
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{albumToEdit ? 'Edit Album' : 'Create New Album'}</DialogTitle>
                        <DialogDescription>
                            {albumToEdit ? 'Update your album details.' : 'Start your new masterpiece. Give it a name and some details.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="flex items-center gap-4">
                            <div className="relative w-24 h-24 rounded-lg overflow-hidden border bg-muted flex items-center justify-center group cursor-pointer">
                                {previewUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <BookImage className="w-8 h-8 text-muted-foreground" />
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10">
                                    <Pencil className="w-6 h-6 text-white" />
                                </div>
                                <Input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 file:cursor-pointer"
                                    onChange={handleFileChange}
                                />
                            </div>
                            <div className="flex-1">
                                <Label htmlFor="name">Album Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Summer Vacation 2024"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="mt-2"
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Textarea
                                id="description"
                                placeholder="A brief story about this album..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="settings">
                                <AccordionTrigger className="text-sm text-muted-foreground hover:no-underline">
                                    <div className="flex items-center gap-2">
                                        <Settings2 className="h-4 w-4" />
                                        Advanced Settings
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="p-4 border rounded-md bg-muted/20 text-sm text-muted-foreground text-center">
                                        More customization options like page size, print quality, and themes will be available here soon.
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {albumToEdit ? 'Save Changes' : 'Create Album'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
