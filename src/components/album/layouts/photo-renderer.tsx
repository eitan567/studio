'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, memo, useState } from 'react';
import Image from 'next/image';
import supabaseLoader from '@/lib/supabase-image-loader';
import { EmptyPhotoSlot } from '../album-editor/empty-photo-slot';
import type { Photo, PhotoPanAndZoom } from '@/lib/types';
import { useAlbumEditor } from '../album-editor/context';

interface PhotoRendererProps {
  photo: Photo;
  onUpdate: (panAndZoom: PhotoPanAndZoom) => void;
  onInteractionChange?: (isInteracting: boolean) => void;
  useSimpleImage?: boolean;
  onRemove?: () => void;
  onReplace?: (e: React.MouseEvent, anchorElement?: HTMLElement) => void;
  // For CTRL+drag swapping between frames
  pageId?: string;
  photoId?: string;
  priority?: boolean;
  chronologicalIndex?: Record<string, number>;
  // When true, use object-fit: contain instead of cover (no cropping)
  preserveAspectRatio?: boolean;
  // Relative rotation between image content and frame viewport (degrees)
  fitRotationDeg?: number;
  // When true, compute fit viewport on rotated basis to avoid clipping in follow-frame mode.
  fitUseRotatedViewportBasis?: boolean;
  // Clip polygon points in local container percentages (0..100, 0..100)
  fitClipPolygon?: Array<[number, number]>;
  // Allow the image wrapper to overflow and rely on parent clipping
  clipOverflow?: boolean;
}

const WHEEL_ZOOM_SENSITIVITY = 0.0006;
const MAX_WHEEL_ZOOM_DELTA = 36;

// Using memo to prevent re-rendering of all photos when only one is being updated
export const PhotoRenderer = memo(function PhotoRenderer({
  photo,
  onUpdate,
  onInteractionChange,
  useSimpleImage,
  onRemove,
  onReplace,
  pageId,
  photoId,
  priority = false,
  chronologicalIndex,
  preserveAspectRatio = false,
  fitRotationDeg = 0,
  fitUseRotatedViewportBasis = false,
  fitClipPolygon,
  clipOverflow = true
}: PhotoRendererProps) {
  const { scrollToGallery } = useAlbumEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const isInteracting = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  // Track CTRL key state for drag-swap feature
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) setIsCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey) setIsCtrlPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Handle drag start for CTRL+drag swap
  const handleDragStart = (e: React.DragEvent) => {
    if (!isCtrlPressed || !pageId || !photoId) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('albumPhotoId', photoId);
    e.dataTransfer.setData('sourcePageId', pageId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // CRITICAL: Always create a LOCAL COPY of the panAndZoom state to avoid mutating props
  const currentValues = useRef<PhotoPanAndZoom>({
    scale: photo.panAndZoom?.scale ?? 1,
    x: photo.panAndZoom?.x ?? 50,
    y: photo.panAndZoom?.y ?? 50,
    flipHorizontal: photo.panAndZoom?.flipHorizontal ?? false
  });

  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getEffectiveViewportSize = (
    cWidth: number,
    cHeight: number
  ): { width: number; height: number } => {
    if (!fitClipPolygon || fitClipPolygon.length < 3) {
      return { width: cWidth, height: cHeight };
    }

    const pointsPx = fitClipPolygon.map(([px, py]) => ([
      (px / 100) * cWidth,
      (py / 100) * cHeight
    ] as [number, number]));

    // In follow-frame mode, compute the fit-basis directly by projecting polygon points
    // onto the rotated image-local axes. This avoids AABB over-estimation that makes
    // the image appear too zoomed.
    if (fitUseRotatedViewportBasis) {
      const angleRad = (fitRotationDeg * Math.PI) / 180;
      const ux: [number, number] = [Math.cos(angleRad), Math.sin(angleRad)];
      const uy: [number, number] = [-Math.sin(angleRad), Math.cos(angleRad)];

      let minU = Infinity;
      let maxU = -Infinity;
      let minV = Infinity;
      let maxV = -Infinity;

      for (const [x, y] of pointsPx) {
        const u = (x * ux[0]) + (y * ux[1]);
        const v = (x * uy[0]) + (y * uy[1]);
        minU = Math.min(minU, u);
        maxU = Math.max(maxU, u);
        minV = Math.min(minV, v);
        maxV = Math.max(maxV, v);
      }

      const width = Math.max(1, maxU - minU);
      const height = Math.max(1, maxV - minV);
      return { width, height };
    }

    // Default fit-basis is polygon AABB in local frame space.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of pointsPx) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    return {
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
  };
  const fitClipSignature = useMemo(() => {
    if (!fitClipPolygon || fitClipPolygon.length === 0) return '';
    return fitClipPolygon.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(';');
  }, [fitClipPolygon]);

  // Pure helper to calculate dimensions
  const getDimensions = (
    cWidth: number,
    cHeight: number,
    pWidth: number,
    pHeight: number,
    userScale: number
  ) => {
    const effectiveViewport = getEffectiveViewportSize(cWidth, cHeight);
    const scaleX = effectiveViewport.width / pWidth;
    const scaleY = effectiveViewport.height / pHeight;
    const coverScale = Math.max(scaleX, scaleY);
    const totalScale = coverScale * userScale;

    let wrapperWidth = pWidth * totalScale;
    let wrapperHeight = pHeight * totalScale;

    // Tiny seam bleed only against the effective viewport (not container AABB),
    // to avoid visible seams while keeping sizing accurate.
    const seamBleedPx = 0.25;
    const seamCoverFactor = Math.max(
      effectiveViewport.width > 0 ? ((effectiveViewport.width + seamBleedPx) / wrapperWidth) : 1,
      effectiveViewport.height > 0 ? ((effectiveViewport.height + seamBleedPx) / wrapperHeight) : 1,
      1
    );
    if (seamCoverFactor > 1) {
      wrapperWidth *= seamCoverFactor;
      wrapperHeight *= seamCoverFactor;
    }

    return {
      wrapperWidth,
      wrapperHeight,
      overflowX: Math.max(0, wrapperWidth - effectiveViewport.width),
      overflowY: Math.max(0, wrapperHeight - effectiveViewport.height)
    };
  };

  const applyTransform = (cWidth: number, cHeight: number) => {
    if (imageRef.current && cWidth && cHeight && photo.width && photo.height) {
      const { scale, x, y } = currentValues.current;
      const { wrapperWidth, wrapperHeight, overflowX, overflowY } = getDimensions(cWidth, cHeight, photo.width, photo.height, scale);

      imageRef.current.style.width = `${wrapperWidth}px`;
      imageRef.current.style.height = `${wrapperHeight}px`;

      // Anchor from center, not top-left.
      // This is critical for rotated/polygon frames where the effective viewport
      // can be smaller than the container AABB.
      const baseLeft = (cWidth - wrapperWidth) / 2;
      const baseTop = (cHeight - wrapperHeight) / 2;
      const left = baseLeft + (((50 - x) / 100) * overflowX);
      const top = baseTop + (((50 - y) / 100) * overflowY);

      imageRef.current.style.left = `${left}px`;
      imageRef.current.style.top = `${top}px`;
    }
  };

  // Sync with external changes (like AI enhancement or Undo)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
        // Immediate update on resize
        applyTransform(width, height);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [photo.src, fitRotationDeg, fitClipSignature]);

  // Initial Sync Measurement to prevent flash/jump
  useLayoutEffect(() => {
    if (containerRef.current && photo.src) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width && rect.height) {
        // Update style immediately
        applyTransform(rect.width, rect.height);
        // Sync state if needed (though ResizeObserver handles this mostly, this catches the very first frame)
        if (rect.width !== containerSize.width || rect.height !== containerSize.height) {
          setContainerSize({ width: rect.width, height: rect.height });
        }
      }
    }
  }, [photo.src, photo.width, photo.height, fitRotationDeg, fitClipSignature]); // Re-run if source photo or fit basis changes

  // Update when Pan/Zoom changes (e.g. from props)
  useLayoutEffect(() => {
    if (!isInteracting.current) {
      // ... (sync logic)
      currentValues.current = {
        scale: photo.panAndZoom?.scale ?? 1,
        x: photo.panAndZoom?.x ?? 50,
        y: photo.panAndZoom?.y ?? 50,
        flipHorizontal: photo.panAndZoom?.flipHorizontal ?? false
      };
      // Apply using current container size (state or measure?)
      // State might be 0 on first render, so measure again to be safe
      const width = containerSize.width || containerRef.current?.getBoundingClientRect().width || 0;
      const height = containerSize.height || containerRef.current?.getBoundingClientRect().height || 0;
      if (width && height) {
        applyTransform(width, height);
      }
    }
  }, [photo.panAndZoom, photo.src, containerSize.width, containerSize.height, fitRotationDeg, fitClipSignature]);

  const commitChanges = () => {
    // Pass a fresh copy to the parent
    onUpdate({ ...currentValues.current });
  };

  const updatePanBoundaries = () => {
    // We allow values to slightly exceed bounds during interaction for smooth feel,
    // but ultimately the check should be logic-driven:
    // With object-cover, we generally want to allow panning as long as the image still covers the container.
    // However, our x/y are percentages of the OVERFLOW.
    // 0 = Align Left/Top
    // 100 = Align Right/Bottom
    // So 0-100 is exactly the valid range to keep content covering the container.
    // If we go < 0, we show empty space on left. If > 100, empty space on right.
    // We should clamp STRICTLY to 0-100 to avoid whitespace.

    const { x, y } = currentValues.current;
    currentValues.current.x = Math.max(0, Math.min(100, x));
    currentValues.current.y = Math.max(0, Math.min(100, y));
  };

  const handleScaleChange = (deltaY: number) => {
    const boundedDelta = Math.sign(deltaY) * Math.min(Math.abs(deltaY), MAX_WHEEL_ZOOM_DELTA);
    const newScale = Math.max(
      1,
      Math.min(5, currentValues.current.scale - boundedDelta * WHEEL_ZOOM_SENSITIVITY)
    );

    currentValues.current.scale = newScale;
    updatePanBoundaries();
    const width = containerSize.width || containerRef.current?.getBoundingClientRect().width || 0;
    const height = containerSize.height || containerRef.current?.getBoundingClientRect().height || 0;
    if (width && height) applyTransform(width, height);

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(commitChanges, 200);
  };

  // Stable references for global mouse events to avoid registration bugs
  // Stable references for global mouse events to avoid registration bugs
  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (!isInteracting.current || !containerRef.current) return;

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = { x: e.clientX, y: e.clientY };

    const width = containerSize.width || containerRef.current.getBoundingClientRect().width;
    const height = containerSize.height || containerRef.current.getBoundingClientRect().height;

    // Safety check
    if (!width || !height || !photo.width || !photo.height) return;

    // השינוי המרכזי כאן - שימוש ב-getDimensions במקום הפונקציה החסרה
    const { overflowX, overflowY } = getDimensions(width, height, photo.width, photo.height, currentValues.current.scale);

    const angleRad = (fitRotationDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    // Convert pointer delta from world space to the rotated image-local space.
    const localDx = (dx * cos) + (dy * sin);
    const localDy = (-dx * sin) + (dy * cos);

    const dXPercent = overflowX > 0 ? (localDx / overflowX) * 100 : 0;
    const dYPercent = overflowY > 0 ? (localDy / overflowY) * 100 : 0;

    const newX = currentValues.current.x - dXPercent;
    const newY = currentValues.current.y - dYPercent;

    currentValues.current.x = newX;
    currentValues.current.y = newY;

    updatePanBoundaries();

    // שליחת מימדים מעודכנים לפונקציית העדכון
    requestAnimationFrame(() => applyTransform(width, height));
  };

  // Store values at the start of interaction to check for changes
  const initialValues = useRef<PhotoPanAndZoom | null>(null);

  const handleGlobalMouseUp = () => {
    if (!isInteracting.current) return;
    isInteracting.current = false;
    if (containerRef.current) containerRef.current.style.cursor = 'grab';
    onInteractionChange?.(false);

    // Only commit if values actually changed
    if (initialValues.current) {
      const { scale, x, y } = currentValues.current;
      const init = initialValues.current;
      if (scale !== init.scale || x !== init.x || y !== init.y) {
        commitChanges();
      }
    }
    initialValues.current = null;

    window.removeEventListener('mousemove', handleGlobalMouseMove);
    window.removeEventListener('mouseup', handleGlobalMouseUp);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isInteracting.current = true;
    // Capture initial values
    initialValues.current = { ...currentValues.current };

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
  }, [containerSize, photo.width, photo.height, photo.src, fitRotationDeg, fitClipSignature]);

  // Handle empty photo source - render placeholder instead of image
  // This check is AFTER all hooks to comply with Rules of Hooks
  if (!photo.src) {
    return (
      <EmptyPhotoSlot />
    );
  }

  if (useSimpleImage) {
    // Compute wrapper dimensions declaratively from state/props so that
    // React reconciliation never overrides the values (unlike the imperative
    // applyTransform path whose pixel values can be reset by React re-renders).
    const cWidth = containerSize.width;
    const cHeight = containerSize.height;
    const scale = photo.panAndZoom?.scale ?? 1;
    const panX = photo.panAndZoom?.x ?? 50;
    const panY = photo.panAndZoom?.y ?? 50;

    let wrapperStyle: React.CSSProperties = {
      transition: 'none',
      width: '100%',
      height: '100%',
    };

    if (cWidth && cHeight && photo.width && photo.height) {
      const { wrapperWidth, wrapperHeight, overflowX, overflowY } =
        getDimensions(cWidth, cHeight, photo.width, photo.height, scale);
      const baseLeft = (cWidth - wrapperWidth) / 2;
      const baseTop = (cHeight - wrapperHeight) / 2;
      const left = baseLeft + (((50 - panX) / 100) * overflowX);
      const top = baseTop + (((50 - panY) / 100) * overflowY);

      wrapperStyle = {
        transition: 'none',
        width: `${wrapperWidth}px`,
        height: `${wrapperHeight}px`,
        left: `${left}px`,
        top: `${top}px`,
      };
    }

    return (
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden"
        style={{ pointerEvents: 'none' }}
      >
        <div
          ref={imageRef}
          className="absolute"
          style={wrapperStyle}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.src}
            alt={photo.alt}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: photo.panAndZoom?.flipHorizontal ? 'scaleX(-1)' : undefined,
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
      className={`absolute inset-0 ${clipOverflow ? 'overflow-hidden' : 'overflow-visible'} touch-none group ${isCtrlPressed && pageId ? 'cursor-move' : 'cursor-grab'}`}
      draggable={isCtrlPressed && !!pageId}
      onDragStart={handleDragStart}
      onMouseDown={isCtrlPressed ? undefined : onMouseDown}
    >
      <div
        ref={imageRef}
        className="absolute"
        style={{
          transition: 'none',
          width: '100%',
          height: '100%',
          // Use sync measurement to update positions immediately
          // opacity: (containerSize.width > 0 && containerSize.height > 0) ? 1 : 0
        }}
      >
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          className="object-cover pointer-events-none"
          style={{
            transform: photo.panAndZoom?.flipHorizontal ? 'scaleX(-1)' : undefined,
          }}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          draggable={false}
          priority={priority}
          loader={supabaseLoader}
        />
      </div>

      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-2 right-2 p-1.5 bg-black/50 text-white/70 rounded-sm hover:text-destructive opacity-0 group-hover:opacity-100 transition-all z-50 pointer-events-auto"
          title="Remove Photo"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            <line x1="10" x2="10" y1="11" y2="17" />
            <line x1="14" x2="14" y1="11" y2="17" />
          </svg>
        </button>
      )}

      {onReplace && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onReplace(e, containerRef.current || undefined);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute top-2 left-2 p-1.5 bg-black/50 text-white/70 rounded-sm hover:text-primary opacity-0 group-hover:opacity-100 transition-all z-[200] pointer-events-auto"
          title="Replace Photo"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
      )}

      {chronologicalIndex?.[photo.originalId || photo.id] !== undefined && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            scrollToGallery(photo.originalId || photo.id);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute bottom-2 right-2 min-w-[20px] h-[20px] px-1.5 flex items-center justify-center bg-black/60 text-white text-[10px] font-bold rounded-full hover:bg-primary transition-all opacity-0 group-hover:opacity-100 z-[250] pointer-events-auto shadow-md border border-white/20"
          title={`Photo #${chronologicalIndex[photo.originalId || photo.id]} - Click to find in gallery`}
        >
          #{chronologicalIndex[photo.originalId || photo.id]}
        </button>
      )}
    </div>
  );
});
