import React, { useRef, useState, useEffect } from 'react';
import { AlbumPage, CoverText, AlbumConfig, PhotoPanAndZoom } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PageLayout } from '../page-layout';
import { COVER_TEMPLATES } from '../layout-templates';
import { AlbumCover } from '../album-cover';

interface CoverCanvasProps {
    page: AlbumPage;
    activeView: 'front' | 'back' | 'full';
    activeTextIds: string[];
    onSelectText: (target: string | string[] | null, isMulti?: boolean) => void;
    activeImageIds?: string[];
    onSelectImage?: (target: string | string[] | null, isMulti?: boolean) => void;
    onUpdatePage: (page: AlbumPage) => void;
    onDropPhoto: (pageId: string, targetPhotoId: string, droppedPhotoId: string) => void;
    onUpdatePhotoPanAndZoom?: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
    config?: AlbumConfig;
}

export const CoverCanvas = ({ page, activeView, activeTextIds, onSelectText, activeImageIds, onSelectImage, onUpdatePage, onDropPhoto, onUpdatePhotoPanAndZoom, config }: CoverCanvasProps) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    // --- 1. Define Logic Base Resolution ---
    // The user expects "Scale 1" to equal the "Standard View Size" (like the preview card).
    // We set the base page height to 450px, which represents `scale(1)`.
    // On larger editor screens (e.g. 1000px height), the scale will naturally be > 1.0 (Zoomed In).
    const BASE_PAGE_PX = 450;

    // --- 2. Parse Configuration ---
    let configW = 20;
    let configH = 20;
    if (config?.size) {
        const parts = config.size.split('x').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            configW = parts[0];
            configH = parts[1];
        }
    }

    // --- 3. Calculate Logical Container Dimensions ---
    // These are the exact pixels the div will occupy at scale(1).

    const spineWidth = page.spineWidth ?? 40;
    const isFullSpread = activeView === 'full';

    let logicalWidth: number;
    let logicalHeight: number;

    // Calculate Pixel Dimensions preserving Config Aspect Ratio
    const pxPerUnit = BASE_PAGE_PX / configH;
    const pageW_px = configW * pxPerUnit;
    const pageH_px = BASE_PAGE_PX;

    if (isFullSpread) {
        // [Page] [Spine] [Page]
        logicalWidth = (pageW_px * 2) + spineWidth;
        logicalHeight = pageH_px;
    } else {
        // [Page]
        logicalWidth = pageW_px;
        logicalHeight = pageH_px;
    }

    // --- 4. Auto-Scale to Fit Viewport ---
    useEffect(() => {
        if (!wrapperRef.current) return;

        const measure = () => {
            const wrapper = wrapperRef.current;
            if (!wrapper) return;
            const { width: availW, height: availH } = wrapper.getBoundingClientRect();

            if (availW === 0 || availH === 0) return;

            const scaleX = availW / logicalWidth;
            const scaleY = availH / logicalHeight;
            const fitScale = Math.min(scaleX, scaleY);

            setScale(fitScale * 0.95); // 5% padding
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(wrapperRef.current);

        return () => observer.disconnect();
    }, [logicalWidth, logicalHeight]);


    return (
        <div
            ref={wrapperRef}
            className="w-full h-full flex items-center justify-center bg-muted/20 overflow-hidden"
        >
            <div
                style={{
                    width: logicalWidth,
                    height: logicalHeight,
                    transform: `scale(${scale})`,
                    border: '1px solid #ccc',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
                }}
                className="relative bg-white"
            >
                <AlbumCover
                    page={page}
                    config={config}
                    mode="editor"
                    activeView={activeView}
                    activeTextIds={activeTextIds}
                    activeImageIds={activeImageIds}
                    onSelectText={onSelectText}
                    onSelectImage={onSelectImage}
                    onUpdatePage={onUpdatePage}
                    onDropPhoto={onDropPhoto}
                    onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom}
                />
            </div>
        </div>
    );
};
