'use client';

import React, { useEffect, useRef, memo, useState } from 'react';
import Image from 'next/image';
import type { Photo, PhotoPanAndZoom } from '@/lib/types';

interface PhotoRendererProps {
  photo: Photo;
  onUpdate: (panAndZoom: PhotoPanAndZoom) => void;
  onInteractionChange?: (isInteracting: boolean) => void;
}

// Using memo to prevent re-rendering of all photos when only one is being updated
export const PhotoRenderer = memo(function PhotoRenderer({ photo, onUpdate, onInteractionChange }: PhotoRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const isInteracting = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // CRITICAL: Always create a LOCAL COPY of the panAndZoom state to avoid mutating props
  const currentValues = useRef<PhotoPanAndZoom>({
    scale: photo.panAndZoom?.scale ?? 1,
    x: photo.panAndZoom?.x ?? 50,
    y: photo.panAndZoom?.y ?? 50
  });

  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate base scale to cover container while maintaining aspect ratio
  const getBaseScale = () => {
    if (!containerSize.width || !containerSize.height || !photo.width || !photo.height) {
      return { scaleX: 1, scaleY: 1 };
    }
  
    const containerAspect = containerSize.width / containerSize.height;
    const photoAspect = photo.width / photo.height;
  
    if (photoAspect > containerAspect) {
      // Photo is wider than container, so fit to height and let width overflow
      return {
        scaleX: (containerSize.height * photoAspect) / containerSize.width,
        scaleY: 1
      };
    } else {
      // Photo is taller than container, so fit to width and let height overflow
      return {
        scaleX: 1,
        scaleY: containerSize.width / photoAspect / containerSize.height
      };
    }
  };

  const applyTransform = () => {
    if (imageRef.current) {
        const { scale, x, y } = currentValues.current;
        const { scaleX: baseScaleX, scaleY: baseScaleY } = getBaseScale();

        const finalScaleX = baseScaleX * scale;
        const finalScaleY = baseScaleY * scale;

        imageRef.current.style.transform = `scale(${finalScaleX}, ${finalScaleY}) translate3d(${x - 50}%, ${y - 50}%, 0)`;
    }
  };

  // Sync with external changes (like AI enhancement or Undo)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    applyTransform();
  }, [containerSize, photo.width, photo.height]);

  useEffect(() => {
    if (!isInteracting.current) {
        currentValues.current = {
            scale: photo.panAndZoom?.scale ?? 1,
            x: photo.panAndZoom?.x ?? 50,
            y: photo.panAndZoom?.y ?? 50
        };
        applyTransform();
    }
  }, [photo.panAndZoom]);

  const commitChanges = () => {
    // Pass a fresh copy to the parent
    onUpdate({ ...currentValues.current });
  };

  const updatePanBoundaries = () => {
    const { scale, x, y } = currentValues.current;
    
    const { scaleX: baseScaleX, scaleY: baseScaleY } = getBaseScale();
    const totalScaleX = baseScaleX * scale;
    const totalScaleY = baseScaleY * scale;

    const overscanX = Math.max(0, (totalScaleX - 1) / (2 * totalScaleX)) * 100;
    const overscanY = Math.max(0, (totalScaleY - 1) / (2 * totalScaleY)) * 100;

    currentValues.current.x = Math.max(50 - overscanX, Math.min(50 + overscanX, x));
    currentValues.current.y = Math.max(50 - overscanY, Math.min(50 + overscanY, y));
  };

  const handleScaleChange = (deltaY: number) => {
    const scrollSensitivity = 0.0015;
    const newScale = Math.max(1, Math.min(5, currentValues.current.scale - deltaY * scrollSensitivity));
    
    currentValues.current.scale = newScale;
    updatePanBoundaries();
    applyTransform();

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(commitChanges, 200);
  };

  // Stable references for global mouse events to avoid registration bugs
  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (!isInteracting.current || !containerRef.current) return;

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = { x: e.clientX, y: e.clientY };
   
    const { scaleX: baseScaleX, scaleY: baseScaleY } = getBaseScale();
    const totalScaleX = baseScaleX * currentValues.current.scale;
    const totalScaleY = baseScaleY * currentValues.current.scale;

    const dXPercent = (dx / (containerSize.width * totalScaleX)) * 100;
    const dYPercent = (dy / (containerSize.height * totalScaleY)) * 100;

    currentValues.current.x += dXPercent;
    currentValues.current.y += dYPercent;
    
    updatePanBoundaries();
    requestAnimationFrame(applyTransform);
  };

  const handleGlobalMouseUp = () => {
    if (!isInteracting.current) return;
    isInteracting.current = false;
    if (containerRef.current) containerRef.current.style.cursor = 'grab';
    onInteractionChange?.(false);
    commitChanges();

    window.removeEventListener('mousemove', handleGlobalMouseMove);
    window.removeEventListener('mouseup', handleGlobalMouseUp);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isInteracting.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
    onInteractionChange?.(true);

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleScaleChange(e.deltaY);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [containerSize, photo.width, photo.height]); 

  return (
    <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab overflow-hidden touch-none"
        onMouseDown={onMouseDown}
    >
        <div
            ref={imageRef}
            className="relative h-full w-full"
            style={{ transition: 'none' }}
        >
            <Image
                src={photo.src}
                alt={photo.alt}
                fill
                className="object-cover pointer-events-none"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                draggable={false}
                priority
            />
        </div>
    </div>
  );
});
