'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import type { Photo, PhotoPanAndZoom } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PhotoRendererProps {
  photo: Photo;
  onUpdate: (panAndZoom: PhotoPanAndZoom) => void;
}

export function PhotoRenderer({ photo, onUpdate }: PhotoRendererProps) {
  const [panAndZoom, setPanAndZoom] = useState<PhotoPanAndZoom>(
    photo.panAndZoom || { scale: 1, x: 50, y: 50 }
  );

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    // Update internal state if the prop changes from outside
    setPanAndZoom(photo.panAndZoom || { scale: 1, x: 50, y: 50 });
  }, [photo.panAndZoom]);
  
  const handleDebouncedUpdate = (newState: PhotoPanAndZoom) => {
    if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
    }
    animationFrameId.current = requestAnimationFrame(() => {
        onUpdate(newState);
    });
  }

  const handleScaleChange = (deltaY: number) => {
    setPanAndZoom(prev => {
        const newScale = Math.max(1, Math.min(3, prev.scale - deltaY * 0.005));
        const finalState = { ...prev, scale: newScale };
        onUpdate(finalState); // Directly call onUpdate for smoother experience
        return finalState;
    });
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    if (imageContainerRef.current) {
      imageContainerRef.current.style.cursor = 'grabbing';
    }
  };

  const onMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (imageContainerRef.current) {
      imageContainerRef.current.style.cursor = 'grab';
    }
    onUpdate(panAndZoom);
  };

  const onMouseLeave = () => {
    if (isDragging.current) {
        onMouseUp();
    }
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
      // Calculate boundaries to prevent panning out of view
      const overscanX = (panAndZoom.scale - 1) * 50 / panAndZoom.scale;
      const overscanY = (panAndZoom.scale - 1) * 50 / panAndZoom.scale;
      
      const xBounds = { min: 50 - overscanX, max: 50 + overscanX };
      const yBounds = { min: 50 - overscanY, max: 50 + overscanY };
      
      const newX = Math.max(xBounds.min, Math.min(xBounds.max, prev.x + dXPercent));
      const newY = Math.max(yBounds.min, Math.min(yBounds.max, prev.y + dYPercent));
      return { ...prev, x: newX, y: newY };
    });
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleScaleChange(e.deltaY);
  }

  return (
    <div
        className="absolute inset-0 cursor-grab"
        ref={imageContainerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onWheel={onWheel}
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
