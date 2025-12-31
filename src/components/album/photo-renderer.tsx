'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import type { Photo, PhotoPanAndZoom } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PhotoRendererProps {
  photo: Photo;
  onUpdate: (panAndZoom: PhotoPanAndZoom) => void;
  onInteractionChange?: (isInteracting: boolean) => void;
}

export function PhotoRenderer({ photo, onUpdate, onInteractionChange }: PhotoRendererProps) {
  const [panAndZoom, setPanAndZoom] = useState<PhotoPanAndZoom>(
    photo.panAndZoom || { scale: 1, x: 50, y: 50 }
  );

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastPanAndZoom = useRef(panAndZoom);

  // Keep lastPanAndZoom ref in sync for event handlers
  useEffect(() => {
    lastPanAndZoom.current = panAndZoom;
  }, [panAndZoom]);

  useEffect(() => {
    // Update internal state if the prop changes from outside
    setPanAndZoom(photo.panAndZoom || { scale: 1, x: 50, y: 50 });
  }, [photo.panAndZoom]);
  
  const handleScaleChange = (deltaY: number) => {
    const prev = lastPanAndZoom.current;
    const newScale = Math.max(1, Math.min(3, prev.scale - deltaY * 0.005));
    const newState = { ...prev, scale: newScale };
    
    setPanAndZoom(newState);
    onUpdate(newState);
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    if (imageContainerRef.current) {
      imageContainerRef.current.style.cursor = 'grabbing';
    }
    onInteractionChange?.(true);
  };

  const onMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!isDragging.current) return;
    isDragging.current = false;
    if (imageContainerRef.current) {
      imageContainerRef.current.style.cursor = 'grab';
    }
    onUpdate(panAndZoom);
    onInteractionChange?.(false);
  };

  const onMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging.current) {
        onMouseUp(e);
    }
    onInteractionChange?.(false);
  };
  
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!isDragging.current || !imageContainerRef.current) return;

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = { x: e.clientX, y: e.clientY };

    const containerRect = imageContainerRef.current.getBoundingClientRect();
    
    // Convert pixel movement to percentage of container
    const dXPercent = (dx / containerRect.width) * 100;
    const dYPercent = (dy / containerRect.height) * 100;

    const prev = lastPanAndZoom.current;
    
    // Calculate boundaries to prevent panning out of view
    const overscanX = (prev.scale - 1) * 50 / prev.scale;
    const overscanY = (prev.scale - 1) * 50 / prev.scale;
    
    const xBounds = { min: 50 - overscanX, max: 50 + overscanX };
    const yBounds = { min: 50 - overscanY, max: 50 + overscanY };
    
    const newX = Math.max(xBounds.min, Math.min(xBounds.max, prev.x + dXPercent));
    const newY = Math.max(yBounds.min, Math.min(yBounds.max, prev.y + dYPercent));
    
    setPanAndZoom({ ...prev, x: newX, y: newY });
  };

  useEffect(() => {
    const el = imageContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleScaleChange(e.deltaY);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div
        className="absolute inset-0 cursor-grab"
        ref={imageContainerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
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
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            draggable={false}
        />
    </div>
  );
}
