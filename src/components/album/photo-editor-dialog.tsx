'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import type { Photo, PhotoPanAndZoom } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PhotoEditorDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  photo?: Photo;
  pageId?: string;
  onSave: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
}

export function PhotoEditorDialog({
  isOpen,
  setIsOpen,
  photo,
  pageId,
  onSave,
}: PhotoEditorDialogProps) {
  const [panAndZoom, setPanAndZoom] = useState<PhotoPanAndZoom>({
    scale: 1,
    x: 50,
    y: 50,
  });

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (photo?.panAndZoom) {
      setPanAndZoom(photo.panAndZoom);
    } else {
      setPanAndZoom({ scale: 1, x: 50, y: 50 });
    }
  }, [photo]);

  if (!photo || !pageId) return null;

  const handleSave = () => {
    onSave(pageId, photo.id, panAndZoom);
    setIsOpen(false);
  };
  
  const handleScaleChange = (value: number[]) => {
    setPanAndZoom(prev => ({ ...prev, scale: value[0] }));
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const onMouseUp = () => {
    isDragging.current = false;
  };

  const onMouseLeave = () => {
    isDragging.current = false;
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !imageContainerRef.current) return;

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = { x: e.clientX, y: e.clientY };

    const containerRect = imageContainerRef.current.getBoundingClientRect();
    
    // Convert pixel movement to percentage of container
    const dXPercent = (dx / containerRect.width) * 100;
    const dYPercent = (dy / containerRect.height) * 100;

    setPanAndZoom(prev => {
        const newX = Math.max(0, Math.min(100, prev.x + dXPercent));
        const newY = Math.max(0, Math.min(100, prev.y + dYPercent));
        return { ...prev, x: newX, y: newY };
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px]" onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}>
        <DialogHeader>
          <DialogTitle>Edit Photo Position</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
            <div className="relative w-full h-96 overflow-hidden rounded-md bg-muted" ref={imageContainerRef}>
                <div
                    className="absolute inset-0 cursor-grab active:cursor-grabbing"
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                 >
                    <Image
                        src={photo.src}
                        alt={photo.alt}
                        fill
                        className="object-cover pointer-events-none"
                        style={{
                            transform: `scale(${panAndZoom.scale}) translate(${panAndZoom.x - 50}%, ${panAndZoom.y - 50}%)`,
                            transition: isDragging.current ? 'none' : 'transform 0.1s ease-out'
                        }}
                    />
                </div>
            </div>
            
            <div className="grid gap-2">
                <Label htmlFor="zoom">Zoom</Label>
                <Slider
                    id="zoom"
                    min={1}
                    max={3}
                    step={0.05}
                    value={[panAndZoom.scale]}
                    onValueChange={handleScaleChange}
                />
            </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
