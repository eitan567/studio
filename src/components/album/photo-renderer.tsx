'use client';

import React, { useEffect, useRef, memo, useState } from 'react';
import Image from 'next/image';
import { EmptyPhotoSlot } from './empty-photo-slot';
import type { Photo, PhotoPanAndZoom } from '@/lib/types';

interface PhotoRendererProps {
  photo: Photo;
  onUpdate: (panAndZoom: PhotoPanAndZoom) => void;
  onInteractionChange?: (isInteracting: boolean) => void;
  useSimpleImage?: boolean;
}

// Using memo to prevent re-rendering of all photos when only one is being updated
export const PhotoRenderer = memo(function PhotoRenderer({ photo, onUpdate, onInteractionChange, useSimpleImage }: PhotoRendererProps) {
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

  // Calculate wrapper dimensions that cover the container while maintaining photo aspect ratio
  const getWrapperDimensions = (userScale: number = 1) => {
    if (!containerSize.width || !containerSize.height || !photo.width || !photo.height) {
      return {
        wrapperWidth: containerSize.width || 100,
        wrapperHeight: containerSize.height || 100,
        overflowX: 0,
        overflowY: 0
      };
    }

    // Calculate scale to cover the container (like object-cover)
    const scaleX = containerSize.width / photo.width;
    const scaleY = containerSize.height / photo.height;
    const coverScale = Math.max(scaleX, scaleY);

    // Apply user zoom
    const totalScale = coverScale * userScale;

    // Wrapper dimensions (the actual size the photo will be displayed at)
    const wrapperWidth = photo.width * totalScale;
    const wrapperHeight = photo.height * totalScale;

    return {
      wrapperWidth,
      wrapperHeight,
      overflowX: Math.max(0, wrapperWidth - containerSize.width),
      overflowY: Math.max(0, wrapperHeight - containerSize.height)
    };
  };

  const applyTransform = () => {
    if (imageRef.current && containerSize.width && containerSize.height && photo.width && photo.height) {
      const { scale, x, y } = currentValues.current;
      const { wrapperWidth, wrapperHeight, overflowX, overflowY } = getWrapperDimensions(scale);

      // Set wrapper size to the actual photo display size
      imageRef.current.style.width = `${wrapperWidth}px`;
      imageRef.current.style.height = `${wrapperHeight}px`;

      // Calculate position: x=50 means centered
      // At x=0: show left edge, left=0
      // At x=100: show right edge, left=-overflowX
      // At x=50: centered, left=-overflowX/2
      const left = -((x / 100) * overflowX);
      const top = -((y / 100) * overflowY);

      imageRef.current.style.left = `${left}px`;
      imageRef.current.style.top = `${top}px`;
    }
  };

  // Sync with external changes (like AI enhancement or Undo)
  // Re-run when photo.src changes because the container ref only exists when rendering actual image
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
  }, [photo.src]);

  useEffect(() => {
    if (photo.src) {
      applyTransform();
    }
  }, [containerSize, photo.width, photo.height, photo.src]);

  useEffect(() => {
    if (!isInteracting.current) {
      currentValues.current = {
        scale: photo.panAndZoom?.scale ?? 1,
        x: photo.panAndZoom?.x ?? 50,
        y: photo.panAndZoom?.y ?? 50
      };
      if (photo.src) {
        applyTransform();
      }
    }
  }, [photo.panAndZoom, photo.src]);

  const commitChanges = () => {
    // Pass a fresh copy to the parent
    onUpdate({ ...currentValues.current });
  };

  const updatePanBoundaries = () => {
    const { x, y } = currentValues.current;
    // Simply clamp x and y to 0-100 range
    currentValues.current.x = Math.max(0, Math.min(100, x));
    currentValues.current.y = Math.max(0, Math.min(100, y));
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

    const { overflowX, overflowY } = getWrapperDimensions(currentValues.current.scale);

    // Convert pixel drag to percentage change
    // Moving by overflowX pixels should change x by 100
    const dXPercent = overflowX > 0 ? (dx / overflowX) * 100 : 0;
    const dYPercent = overflowY > 0 ? (dy / overflowY) * 100 : 0;

    // Subtract because dragging right (positive dx) should decrease x (show more of right side)
    currentValues.current.x -= dXPercent;
    currentValues.current.y -= dYPercent;

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
    if (!container || !photo.src) return;

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
  }, [containerSize, photo.width, photo.height, photo.src]);

  // Handle empty photo source - render placeholder instead of image
  // This check is AFTER all hooks to comply with Rules of Hooks
  if (!photo.src) {
    return (
      <EmptyPhotoSlot />
    );
  }

  if (useSimpleImage) {
    return (
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden"
        style={{ pointerEvents: 'none' }}
      >
        <div
          ref={imageRef}
          className="absolute"
          style={{ transition: 'none', width: '100%', height: '100%' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.src}
            alt={photo.alt}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              pointerEvents: 'none'
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-grab overflow-hidden touch-none"
      onMouseDown={onMouseDown}
    >
      <div
        ref={imageRef}
        className="absolute"
        style={{ transition: 'none', width: '100%', height: '100%' }}
      >
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          className="object-cover pointer-events-none"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          draggable={false}
          priority
          unoptimized
        />
      </div>
    </div>
  );
});
