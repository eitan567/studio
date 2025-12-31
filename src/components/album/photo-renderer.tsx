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
      return { x: 1, y: 1 };
    }
    
    const containerAspect = containerSize.width / containerSize.height;
    const photoAspect = photo.width / photo.height;
    
    // If photo is wider than container (landscape-ish relative to container)
    if (photoAspect > containerAspect) {
      return {
        x: photoAspect / containerAspect,
        y: 1
      };
    } 
    // If photo is taller than container (portrait-ish relative to container)
    else {
      return {
        x: 1,
        y: containerAspect / photoAspect
      };
    }
  };

  const applyTransform = () => {
    if (imageRef.current) {
      const { scale, x, y } = currentValues.current;
      const base = getBaseScale();
      
      // We apply the base scale from aspect ratio mismatch + the user's manual scale
      const finalScaleX = base.x * scale;
      const finalScaleY = base.y * scale;
      
      // translate3d uses percentages of the element's own size. 
      // Since the element is 'fill' (100% of container), translate(x-50%) moves it relative to container.
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
   const base = getBaseScale();
    
    // Total scale including aspect ratio correction
    const totalScaleX = base.x * scale;
    const totalScaleY = base.y * scale;
    
    // How much can we move? 
    // If totalScale is 1.5, we can move 0.5/1.5 * 50% in each direction
    const overscanX = totalScaleX > 1 ? (totalScaleX - 1) * 50 / totalScaleX : 0;
    const overscanY = totalScaleY > 1 ? (totalScaleY - 1) * 50 / totalScaleY : 0;
    
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

    const rect = containerRef.current.getBoundingClientRect();
     
    // We need to adjust sensitivity based on the ACTUAL visible scale
    const base = getBaseScale();
    const totalScaleX = base.x * currentValues.current.scale;
    const totalScaleY = base.y * currentValues.current.scale;
    // The movement needs to be relative to the scaled image size
    const dXPercent = (dx / rect.width) * 100 / totalScaleX;
    const dYPercent = (dy / rect.height) * 100 / totalScaleY;


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
  }, [containerSize]); 

  return (
    <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab overflow-hidden touch-none"
        onMouseDown={onMouseDown}
    >
        <div
            ref={imageRef}
            className="relative h-full w-full style={{ transition: 'none' }}"
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
