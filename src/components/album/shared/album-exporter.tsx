import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { toBlob } from 'html-to-image';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { flushSync } from 'react-dom';
import { AlbumPage, AlbumConfig } from '@/lib/types';
import type { AdvancedTemplate } from '@/lib/advanced-layout-types';
import { PageLayout } from '../layouts/page-layout';
import { AlbumCover, StaticCoverText, StaticCoverImage } from '../book-view/album-cover';
import { getPhotoCount, useTemplates } from '@/hooks/useTemplates';
import { useSettings } from '@/hooks/use-settings';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AlbumExporterProps {
    pages: AlbumPage[];
    config: AlbumConfig;
    albumName?: string;
    extraTemplates?: AdvancedTemplate[];
    onExportStart?: () => void;
    onExportProgress?: (current: number, total: number) => void;
    onExportComplete?: () => void;
    onExportError?: (error: any) => void;
}

export type ExportDpi = 150 | 200 | 300;

export interface ExportWhiteMarginsMm {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
}

interface NormalizedWhiteMarginsMm {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface ExportRenderOptions {
    dpi?: ExportDpi;
    whiteMarginMm?: number;
    coverWhiteMarginMm?: number;
    coverWhiteMarginsMm?: ExportWhiteMarginsMm;
}

interface NormalizedExportRenderOptions {
    dpi: ExportDpi;
    whiteMarginMm: number;
    coverWhiteMarginMm: number;
    coverWhiteMarginsMm: NormalizedWhiteMarginsMm;
    pixelRatioFallback: number;
}

export interface AlbumExporterRef {
    exportAlbum: (
        pageRange?: 'cover' | 'singles' | { from: number; to: number },
        options?: ExportRenderOptions
    ) => Promise<void>;
    exportPage: (pageId: string, options?: ExportRenderOptions) => Promise<void>;
    exportToPdf: (
        pageRange?: 'cover' | 'singles' | { from: number; to: number },
        options?: ExportRenderOptions
    ) => Promise<void>;
}

export const AlbumExporter = forwardRef<AlbumExporterRef, AlbumExporterProps>(({
    pages,
    config,
    albumName,
    extraTemplates = [],
    onExportStart,
    onExportProgress,
    onExportComplete,
    onExportError
}, ref) => {
    const { settings } = useSettings();
    const { rawGridTemplates, rawCoverTemplates } = useTemplates();
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [isRendering, setIsRendering] = useState(false);
    const [duplicateWarningOpen, setDuplicateWarningOpen] = useState(false);
    const duplicateWarningResolverRef = React.useRef<((proceed: boolean) => void) | null>(null);
    const BASE_SINGLE_WIDTH_PX = 500;
    const BASE_SPREAD_WIDTH_PX = 1000;
    const CM_PER_INCH = 2.54;
    const MM_PER_INCH = 25.4;
    const MIN_PIXEL_RATIO = 1;
    const MAX_PIXEL_RATIO = 8;
    const MIN_WHITE_MARGIN_MM = 0;
    const MAX_WHITE_MARGIN_MM = 50;
    const IMAGES_PIXEL_RATIO_FALLBACK = 4;
    const SINGLE_PAGE_PIXEL_RATIO_FALLBACK = 4;
    const PDF_PIXEL_RATIO_FALLBACK = 2;
    const DEFAULT_IMAGES_DPI: ExportDpi = 300;
    const DEFAULT_SINGLE_PAGE_DPI: ExportDpi = 300;
    const DEFAULT_PDF_DPI: ExportDpi = 200;
    const ASSET_WAIT_TIMEOUT_MS = 8000;
    const [activeRenderOptions, setActiveRenderOptions] = useState<NormalizedExportRenderOptions | null>(null);
    const mergedPageTemplates = React.useMemo(() => {
        const templateMap = new Map<string, AdvancedTemplate>();
        [...rawGridTemplates, ...rawCoverTemplates, ...extraTemplates].forEach((template) => {
            templateMap.set(String(template.id), template);
        });
        return Array.from(templateMap.values());
    }, [extraTemplates, rawCoverTemplates, rawGridTemplates]);

    const createUniformWhiteMargins = React.useCallback((value: number): NormalizedWhiteMarginsMm => ({
        top: value,
        right: value,
        bottom: value,
        left: value,
    }), []);

    const sanitizeExportFileName = React.useCallback((value: string | undefined) => {
        const fallbackName = 'album';
        const normalized = String(value || fallbackName)
            .trim()
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
            .replace(/\s+/g, ' ')
            .replace(/\.+$/g, '')
            .trim();
        return normalized || fallbackName;
    }, []);

    const getExportBaseName = React.useCallback(() => {
        const dateStamp = new Date().toISOString().slice(0, 10);
        return `${sanitizeExportFileName(albumName)}-album-export-${dateStamp}`;
    }, [albumName, sanitizeExportFileName]);

    const getExportImageFileName = React.useCallback((label: string) => {
        return `${sanitizeExportFileName(albumName)}-${label}.png`;
    }, [albumName, sanitizeExportFileName]);

    const parseAlbumSizeCm = React.useCallback(() => {
        const [rawW, rawH] = String(config.size || '').split('x');
        const widthCm = Number(rawW);
        const heightCm = Number(rawH);
        if (Number.isNaN(widthCm) || Number.isNaN(heightCm) || widthCm <= 0 || heightCm <= 0) {
            return null;
        }
        return { widthCm, heightCm };
    }, [config.size]);

    const getPixelRatioForDpi = React.useCallback((
        dpi: ExportDpi,
        isSpread: boolean,
        fallbackPixelRatio: number
    ) => {
        const sizeCm = parseAlbumSizeCm();
        if (!sizeCm) return fallbackPixelRatio;

        const pageWidthPxAtDpi = (sizeCm.widthCm / CM_PER_INCH) * dpi;
        const targetWidthPx = isSpread ? pageWidthPxAtDpi * 2 : pageWidthPxAtDpi;
        const baseWidthPx = isSpread ? BASE_SPREAD_WIDTH_PX : BASE_SINGLE_WIDTH_PX;
        const rawRatio = targetWidthPx / baseWidthPx;

        if (!Number.isFinite(rawRatio) || rawRatio <= 0) {
            return fallbackPixelRatio;
        }

        return Math.max(MIN_PIXEL_RATIO, Math.min(MAX_PIXEL_RATIO, rawRatio));
    }, [parseAlbumSizeCm]);

    const clampWhiteMarginMm = React.useCallback((value: number | undefined) => {
        const numericValue = typeof value === 'number' ? value : Number.NaN;
        if (!Number.isFinite(numericValue)) return 0;
        return Math.max(MIN_WHITE_MARGIN_MM, Math.min(MAX_WHITE_MARGIN_MM, numericValue));
    }, []);

    const normalizeEdgeWhiteMarginsMm = React.useCallback((
        value: ExportWhiteMarginsMm | undefined,
        fallbackMarginMm: number
    ): NormalizedWhiteMarginsMm => ({
        top: clampWhiteMarginMm(value?.top ?? fallbackMarginMm),
        right: clampWhiteMarginMm(value?.right ?? fallbackMarginMm),
        bottom: clampWhiteMarginMm(value?.bottom ?? fallbackMarginMm),
        left: clampWhiteMarginMm(value?.left ?? fallbackMarginMm),
    }), [clampWhiteMarginMm]);

    const normalizeRenderOptions = React.useCallback((
        options: ExportRenderOptions | undefined,
        defaultDpi: ExportDpi,
        pixelRatioFallback: number
    ): NormalizedExportRenderOptions => {
        const whiteMarginMm = clampWhiteMarginMm(options?.whiteMarginMm);
        const coverMarginSource = options?.coverWhiteMarginMm ?? options?.whiteMarginMm;
        return {
            dpi: options?.dpi ?? defaultDpi,
            whiteMarginMm,
            coverWhiteMarginMm: clampWhiteMarginMm(coverMarginSource),
            coverWhiteMarginsMm: normalizeEdgeWhiteMarginsMm(
                options?.coverWhiteMarginsMm,
                clampWhiteMarginMm(coverMarginSource)
            ),
            pixelRatioFallback,
        };
    }, [clampWhiteMarginMm, normalizeEdgeWhiteMarginsMm]);

    const getRenderWhiteMarginPx = React.useCallback((
        marginMm: number,
        dpi: ExportDpi,
        isSpread: boolean,
        pixelRatioFallback: number
    ) => {
        if (marginMm <= 0) return 0;
        const targetPixelMargin = (marginMm / MM_PER_INCH) * dpi;
        const pixelRatio = getPixelRatioForDpi(dpi, isSpread, pixelRatioFallback);
        if (!Number.isFinite(pixelRatio) || pixelRatio <= 0) return 0;
        return targetPixelMargin / pixelRatio;
    }, [getPixelRatioForDpi]);

    const getRenderWhiteMarginsPx = React.useCallback((
        marginsMm: NormalizedWhiteMarginsMm,
        dpi: ExportDpi,
        isSpread: boolean,
        pixelRatioFallback: number
    ): NormalizedWhiteMarginsMm => ({
        top: getRenderWhiteMarginPx(marginsMm.top, dpi, isSpread, pixelRatioFallback),
        right: getRenderWhiteMarginPx(marginsMm.right, dpi, isSpread, pixelRatioFallback),
        bottom: getRenderWhiteMarginPx(marginsMm.bottom, dpi, isSpread, pixelRatioFallback),
        left: getRenderWhiteMarginPx(marginsMm.left, dpi, isSpread, pixelRatioFallback),
    }), [getRenderWhiteMarginPx]);

    const extractBackgroundImageUrls = React.useCallback((backgroundImageValue: string | undefined) => {
        if (!backgroundImageValue || backgroundImageValue === 'none') return [];

        const urls: string[] = [];
        const pattern = /url\((['"]?)(.*?)\1\)/g;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(backgroundImageValue)) !== null) {
            const url = match[2]?.trim();
            if (url) {
                urls.push(url);
            }
        }

        return urls;
    }, []);

    const preloadImageUrl = React.useCallback((url: string) => {
        return new Promise<void>((resolve) => {
            const image = new Image();
            let resolved = false;
            const timeoutId = window.setTimeout(() => {
                if (resolved) return;
                resolved = true;
                resolve();
            }, ASSET_WAIT_TIMEOUT_MS);

            const finish = () => {
                if (resolved) return;
                resolved = true;
                window.clearTimeout(timeoutId);
                resolve();
            };

            image.decoding = 'async';
            image.onload = finish;
            image.onerror = finish;
            image.src = url;

            if (image.complete) {
                finish();
            }
        });
    }, [ASSET_WAIT_TIMEOUT_MS]);

    const waitForImageElement = React.useCallback((image: HTMLImageElement) => {
        return new Promise<void>((resolve) => {
            if (!image) {
                resolve();
                return;
            }

            try {
                image.loading = 'eager';
                (image as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'high';
            } catch {
                // Ignore browsers that do not allow overriding these hints.
            }

            if (image.complete) {
                resolve();
                return;
            }

            let resolved = false;
            const timeoutId = window.setTimeout(() => {
                if (resolved) return;
                resolved = true;
                resolve();
            }, ASSET_WAIT_TIMEOUT_MS);

            const finish = () => {
                if (resolved) return;
                resolved = true;
                window.clearTimeout(timeoutId);
                resolve();
            };

            image.addEventListener('load', finish, { once: true });
            image.addEventListener('error', finish, { once: true });

            if (typeof image.decode === 'function') {
                image.decode().then(finish).catch(() => undefined);
            }
        });
    }, [ASSET_WAIT_TIMEOUT_MS]);

    const waitForElementAssets = React.useCallback(async (root: HTMLElement | null) => {
        if (!root) return;

        if (typeof document !== 'undefined' && 'fonts' in document) {
            try {
                await document.fonts.ready;
            } catch {
                // Ignore font readiness failures and continue export.
            }
        }

        const htmlImages = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
        await Promise.allSettled(htmlImages.map(waitForImageElement));

        const backgroundUrls = Array.from(new Set(
            [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
                .flatMap((element) => extractBackgroundImageUrls(element.style.backgroundImage))
        ));
        await Promise.allSettled(backgroundUrls.map((url) => preloadImageUrl(url)));
        await Promise.resolve();
    }, [extractBackgroundImageUrls, preloadImageUrl, waitForImageElement]);

    const prepareRenderTree = React.useCallback(async (
        renderOptions: NormalizedExportRenderOptions
    ) => {
        flushSync(() => {
            setActiveRenderOptions(renderOptions);
            setIsRendering(true);
        });

        if (!containerRef.current) {
            return null;
        }

        await waitForElementAssets(containerRef.current);
        return containerRef.current;
    }, [waitForElementAssets]);

    const filterPageElementsByRange = React.useCallback((
        allPageElements: HTMLElement[],
        pageRange?: 'cover' | 'singles' | { from: number; to: number }
    ) => {
        if (pageRange === 'cover') {
            return allPageElements.filter((element) => element.dataset.isCover === 'true');
        }

        if (pageRange === 'singles') {
            return allPageElements.filter((element) =>
                element.dataset.isSpread !== 'true' && element.dataset.isCover !== 'true'
            );
        }

        if (pageRange) {
            return allPageElements.filter((_, index) => {
                const pageNumber = index + 1;
                return pageNumber >= pageRange.from && pageNumber <= pageRange.to;
            });
        }

        return allPageElements;
    }, []);

    const resetRenderState = React.useCallback(() => {
        setIsRendering(false);
        setActiveRenderOptions(null);
    }, []);

    const requestDuplicateExportConfirmation = () => {
        return new Promise<boolean>((resolve) => {
            duplicateWarningResolverRef.current = resolve;
            setDuplicateWarningOpen(true);
        });
    };

    const resolveDuplicateExportConfirmation = (proceed: boolean) => {
        setDuplicateWarningOpen(false);
        if (duplicateWarningResolverRef.current) {
            duplicateWarningResolverRef.current(proceed);
            duplicateWarningResolverRef.current = null;
        }
    };

    useImperativeHandle(ref, () => ({
        exportAlbum: async (
            pageRange?: 'cover' | 'singles' | { from: number; to: number },
            options?: ExportRenderOptions
        ) => {
            const renderOptions = normalizeRenderOptions(
                options,
                DEFAULT_IMAGES_DPI,
                IMAGES_PIXEL_RATIO_FALLBACK
            );
            try {
                // Check for duplicates if enabled
                if (settings.exportWarnDuplicates) {
                    const seenPhotoIds = new Set<string>();
                    let hasDuplicates = false;

                    for (const page of pages) {
                        if (page.isCover) continue; // Skip cover
                        for (const photo of page.photos) {
                            // Check using originalId (gallery ID) or src as fallback
                            const photoId = photo.originalId || photo.src;
                            if (!photoId || photoId === '') continue; // Skip placeholders/empty

                            if (seenPhotoIds.has(photoId)) {
                                hasDuplicates = true;
                                break;
                            }
                            seenPhotoIds.add(photoId);
                        }
                        if (hasDuplicates) break;
                    }

                    if (hasDuplicates) {
                        const proceed = await requestDuplicateExportConfirmation();
                        if (!proceed) {
                            resetRenderState();
                            return;
                        }
                    }
                }

                flushSync(() => {
                    onExportStart?.();
                });

                const exportContainer = await prepareRenderTree(renderOptions);
                if (!exportContainer) {
                    console.error("Export container not found");
                    resetRenderState();
                    return;
                }

                const zip = new JSZip();

                const allPageElements = Array.from(exportContainer.children) as HTMLElement[];
                const pageElements = filterPageElementsByRange(allPageElements, pageRange);
                const total = pageElements.length;
                if (total === 0) {
                    throw new Error('No pages matched the selected export range.');
                }

                for (let i = 0; i < total; i++) {
                    const element = pageElements[i];
                    const pageId = element.dataset.pageId;
                    const isSpread = element.dataset.isSpread === 'true';
                    const isCover = element.dataset.isCover === 'true';

                    onExportProgress?.(i + 1, total);

                    // Capture
                    const pixelRatio = getPixelRatioForDpi(
                        renderOptions.dpi,
                        isSpread,
                        renderOptions.pixelRatioFallback
                    );
                    const blob = await toBlob(element, {
                        quality: 0.95,
                        pixelRatio,
                        skipAutoScale: true, // We want to capture exactly what is rendered
                        fontEmbedCSS: '', // Disable font embedding to avoid CORS issues
                        cacheBust: false, // Disable cache bust to see if it fixes duplication
                    });

                    if (blob) {
                        let filename = getExportImageFileName(`page-${String(i + 1).padStart(3, '0')}`);
                        if (isCover) filename = getExportImageFileName('cover');
                        else if (isSpread) filename = getExportImageFileName(`spread-${String(i + 1).padStart(3, '0')}`);

                        zip.file(filename, blob);
                    }
                }

                // Generate ZIP
                const content = await zip.generateAsync({ type: 'blob' });
                saveAs(content, `${getExportBaseName()}.zip`);

                onExportComplete?.();
                resetRenderState();
            } catch (err) {
                console.error("Export failed:", err);
                onExportError?.(err);
                resetRenderState();
            }
        },
        exportPage: async (pageId: string, options?: ExportRenderOptions) => {
            const renderOptions = normalizeRenderOptions(
                options,
                DEFAULT_SINGLE_PAGE_DPI,
                SINGLE_PAGE_PIXEL_RATIO_FALLBACK
            );
            try {
                const exportContainer = await prepareRenderTree(renderOptions);
                if (!exportContainer) {
                    console.error("Export container not found");
                    resetRenderState();
                    return;
                }

                const pageElement = Array.from(exportContainer.children).find(
                    (el) => (el as HTMLElement).dataset.pageId === pageId
                ) as HTMLElement;

                if (!pageElement) {
                    console.error(`Page element with ID ${pageId} not found`);
                    resetRenderState();
                    return;
                }

                const isSpread = pageElement.dataset.isSpread === 'true';
                const isCover = pageElement.dataset.isCover === 'true';

                const pixelRatio = getPixelRatioForDpi(
                    renderOptions.dpi,
                    isSpread,
                    renderOptions.pixelRatioFallback
                );
                const blob = await toBlob(pageElement, {
                    quality: 0.95,
                    pixelRatio,
                    skipAutoScale: true,
                    fontEmbedCSS: '',
                    cacheBust: false,
                });

                if (blob) {
                    let filename = getExportImageFileName(`page-${pageId.slice(0, 8)}`);
                    if (isCover) filename = getExportImageFileName('cover');
                    else if (isSpread) filename = getExportImageFileName(`spread-${pageId.slice(0, 8)}`);

                    saveAs(blob, filename);
                }

                resetRenderState();
            } catch (err) {
                console.error("Single page export failed:", err);
                onExportError?.(err);
                resetRenderState();
            }
        },
        exportToPdf: async (
            pageRange?: 'cover' | 'singles' | { from: number; to: number },
            options?: ExportRenderOptions
        ) => {
            const renderOptions = normalizeRenderOptions(
                options,
                DEFAULT_PDF_DPI,
                PDF_PIXEL_RATIO_FALLBACK
            );
            try {
                flushSync(() => {
                    onExportStart?.();
                });

                const exportContainer = await prepareRenderTree(renderOptions);
                if (!exportContainer) {
                    console.error("Export container not found");
                    resetRenderState();
                    return;
                }

                const allPageElements = Array.from(exportContainer.children) as HTMLElement[];
                const pageElements = filterPageElementsByRange(allPageElements, pageRange);
                const total = pageElements.length;
                if (total === 0) {
                    throw new Error('No pages matched the selected export range.');
                }

                // Initialize PDF
                // We'll determine orientation based on the first page, but typically albums are landscape-ish or square.
                // A4 is 210x297mm. 
                // We will create a PDF where each page matches the image dimensions.
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'px',
                    hotfixes: ['px_scaling']
                });

                // Clear initial page if we want to set specific dimensions per page
                pdf.deletePage(1);

                for (let i = 0; i < total; i++) {
                    const element = pageElements[i];
                    const isSpread = element.dataset.isSpread === 'true';
                    onExportProgress?.(i + 1, total);

                    const pixelRatio = getPixelRatioForDpi(
                        renderOptions.dpi,
                        isSpread,
                        renderOptions.pixelRatioFallback
                    );
                    const blob = await toBlob(element, {
                        quality: 0.95,
                        pixelRatio,
                        skipAutoScale: true,
                        fontEmbedCSS: '',
                        cacheBust: false,
                    });

                    if (blob) {
                        // Create a URL for the blob
                        const imgData = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });

                        const imgProps = pdf.getImageProperties(imgData);
                        const pdfWidth = imgProps.width;
                        const pdfHeight = imgProps.height;

                        // Add new page with the dimensions of the image
                        pdf.addPage([pdfWidth, pdfHeight], pdfWidth > pdfHeight ? 'landscape' : 'portrait');
                        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                    }
                }

                pdf.save(`${getExportBaseName()}.pdf`);
                onExportComplete?.();
                resetRenderState();
            } catch (err) {
                console.error("PDF Export failed:", err);
                onExportError?.(err);
                resetRenderState();
            }
        }
    }));

    const renderOptionsForCapture: NormalizedExportRenderOptions = activeRenderOptions ?? {
        dpi: DEFAULT_IMAGES_DPI,
        whiteMarginMm: 0,
        coverWhiteMarginMm: 0,
        coverWhiteMarginsMm: createUniformWhiteMargins(0),
        pixelRatioFallback: IMAGES_PIXEL_RATIO_FALLBACK,
    };

    // Render all pages in a hidden container
    // We use fixed width to ensure consistency regardless of screen size
    // Single: 500px (approx editor preview), Spread: 1000px
    return (
        <>
            <AlertDialog
                open={duplicateWarningOpen}
                onOpenChange={(open) => {
                    if (!open) resolveDuplicateExportConfirmation(false);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Duplicate Photos Detected</AlertDialogTitle>
                        <AlertDialogDescription>
                            Warning: Your album contains duplicate photos (excluding the cover). Do you want to continue with the export?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => resolveDuplicateExportConfirmation(false)}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={() => resolveDuplicateExportConfirmation(true)}>
                            Continue Export
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div
                ref={containerRef}
                style={{
                    position: 'fixed',
                    top: '-10000px',
                    left: '-10000px',
                    width: 'auto', // Allow children to define width
                    height: 'auto',
                    overflow: 'hidden',
                    pointerEvents: 'none',
                    display: 'flex', // stack them horizontally or vertically, doesn't matter much as long as they don't overlap in a way that breaks capture
                    flexDirection: 'column',
                }}
            >
                {isRendering && pages.map((page) => {
                    const isCover = page.isCover === true;
                    const isSpread = page.type === 'spread' || isCover;
                    // Match the editor render ratio exactly (ScaledCoverPreview inner surface):
                    // width * 0.97, height * 0.95. Without this, cover exports can shift/crop
                    // compared to what the user sees in the editor.
                    const EXPORT_BASE_PX = 450;
                    const sizeStr = config?.size || '800x600';
                    const [cfgWStr, cfgHStr] = sizeStr.split('x');
                    const cfgW = Number(cfgWStr) || 800;
                    const cfgH = Number(cfgHStr) || 600;
                    const pxPerUnit = EXPORT_BASE_PX / cfgH;
                    const singlePageLogicalW = cfgW * pxPerUnit;
                    const coverSpineWidth = isCover ? (page.spineWidth !== undefined ? page.spineWidth : 40) : 0;
                    const logicalWidth = isSpread
                        ? (singlePageLogicalW * 2) + coverSpineWidth
                        : singlePageLogicalW;
                    const logicalHeight = EXPORT_BASE_PX;
                    const pageWidth = Math.max(1, Math.round(logicalWidth * 0.97));
                    const pageHeight = Math.max(1, Math.round(logicalHeight * 0.95));
                    const exportPageBackground = page.backgroundColor || config.backgroundColor || '#ffffff';
                    const exportCornerRadius = (typeof page.cornerRadius === 'number' && page.cornerRadius > 0)
                        ? page.cornerRadius
                        : (config.cornerRadius ?? 0);
                    const exportDynamicPhotoGapSource = config.photoGap ?? page.photoGap ?? 0;
                    const exportDynamicFrameGapRaw = Number(exportDynamicPhotoGapSource);
                    const exportDynamicFrameGap = Number.isFinite(exportDynamicFrameGapRaw)
                        ? Math.max(0, exportDynamicFrameGapRaw)
                        : 0;
                    const exportDynamicFrameGapColor = '#ffffff';
                    const pageWhiteMarginsPx = isCover
                        ? getRenderWhiteMarginsPx(
                            renderOptionsForCapture.coverWhiteMarginsMm,
                            renderOptionsForCapture.dpi,
                            isSpread,
                            renderOptionsForCapture.pixelRatioFallback
                        )
                        : createUniformWhiteMargins(getRenderWhiteMarginPx(
                            renderOptionsForCapture.whiteMarginMm,
                            renderOptionsForCapture.dpi,
                            isSpread,
                            renderOptionsForCapture.pixelRatioFallback
                        ));
                    const roundedWhiteMarginsPx = {
                        top: Math.max(0, Math.round(pageWhiteMarginsPx.top)),
                        right: Math.max(0, Math.round(pageWhiteMarginsPx.right)),
                        bottom: Math.max(0, Math.round(pageWhiteMarginsPx.bottom)),
                        left: Math.max(0, Math.round(pageWhiteMarginsPx.left)),
                    };
                    const exportWidth = Math.max(1, Math.round(pageWidth + roundedWhiteMarginsPx.left + roundedWhiteMarginsPx.right));
                    const exportHeight = Math.max(1, Math.round(pageHeight + roundedWhiteMarginsPx.top + roundedWhiteMarginsPx.bottom));

                    return (
                        <div
                            key={page.id}
                            data-page-id={page.id}
                            data-is-spread={isSpread}
                            data-is-cover={isCover}
                            style={{
                                width: `${exportWidth}px`,
                                height: `${exportHeight}px`,
                                marginBottom: '20px', // spacing to avoid bleed during capture if careless
                                position: 'relative',
                                backgroundColor: '#ffffff',
                                boxSizing: 'border-box',
                                paddingTop: `${roundedWhiteMarginsPx.top}px`,
                                paddingRight: `${roundedWhiteMarginsPx.right}px`,
                                paddingBottom: `${roundedWhiteMarginsPx.bottom}px`,
                                paddingLeft: `${roundedWhiteMarginsPx.left}px`,
                            }}
                        >
                            <div style={{
                                position: 'relative',
                                width: `${pageWidth}px`,
                                height: `${pageHeight}px`,
                                backgroundColor: exportPageBackground,
                                overflow: 'hidden',
                            }}>
                                {/* Background Image Layer */}
                                {(page.backgroundImage || config.backgroundImage) && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            backgroundImage: `url(${page.backgroundImage || config.backgroundImage})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            zIndex: 0
                                        }}
                                    />
                                )}

                                <div style={{
                                    position: 'relative',
                                    width: '100%',
                                    height: '100%',
                                    zIndex: 1,
                                    padding: isCover ? 0 : `${page.pageMargin ?? config.pageMargin}px`,
                                    boxSizing: 'border-box'
                                }}>
                                    {isCover ? (
                                        <div className="relative h-full w-full">
                                            <AlbumCover
                                                page={page}
                                                config={config}
                                                mode="preview"
                                                activeView="full"
                                                onUpdateTitleSettings={() => { }}
                                                onDropPhoto={() => { }}
                                                onUpdatePhotoPanAndZoom={() => { }}
                                                useSimpleImage={true}
                                                extraTemplates={extraTemplates}
                                            />
                                            {/* Title Overlay for Cover */}
                                            {page.titleText && (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${page.titlePosition?.x || 50}%`,
                                                        top: `${page.titlePosition?.y || 50}%`,
                                                        transform: 'translate(-50%, -50%)',
                                                        fontSize: `${(page.titleFontSize || 24)}px`, // No scaling needed as base is approx preview size
                                                        fontFamily: page.titleFontFamily,
                                                        color: page.titleColor,
                                                        whiteSpace: 'nowrap',
                                                        zIndex: 40
                                                    }}
                                                >
                                                    {page.titleText}
                                                </div>
                                            )}
                                        </div>
                                    ) : (isSpread && !isCover) ? (
                                        (() => {
                                            const isSplit = page.spreadMode === 'split';
                                            if (isSplit) {
                                                const fallbackTemplate = mergedPageTemplates[0];
                                                const leftLayoutId = page.spreadLayouts?.left || fallbackTemplate?.id || '';
                                                const rightLayoutId = page.spreadLayouts?.right || fallbackTemplate?.id || ''; // unused for slice, but good for consistency
                                                const leftTemplate = mergedPageTemplates.find(t => String(t.id) === String(leftLayoutId)) || fallbackTemplate;
                                                const leftPhotos = page.photos.slice(0, getPhotoCount(leftTemplate));
                                                const rightPhotos = page.photos.slice(getPhotoCount(leftTemplate));

                                                return (
                                                    <div
                                                        className="relative h-full w-full flex"
                                                        style={{ gap: `${(page.photoGap ?? config.photoGap) * 2}px` }}
                                                    >
                                                        <div className="h-full flex-1 min-w-0">
                                                            <PageLayout
                                                                page={page}
                                                                photoGap={page.photoGap ?? config.photoGap}
                                                                backgroundColor={exportPageBackground}
                                                                backgroundImage={page.backgroundImage || config.backgroundImage}
                                                                cornerRadius={exportCornerRadius}
                                                                overridePhotos={leftPhotos}
                                                                overrideLayout={leftLayoutId}
                                                                templateSource={mergedPageTemplates as any}
                                                                onUpdatePhotoPanAndZoom={() => { }}
                                                                onInteractionChange={() => { }}
                                                                onDropPhoto={() => { }}
                                                                useSimpleImage={true}
                                                            />
                                                        </div>
                                                        <div className="h-full flex-1 min-w-0">
                                                            <PageLayout
                                                                page={page}
                                                                photoGap={page.photoGap ?? config.photoGap}
                                                                backgroundColor={exportPageBackground}
                                                                backgroundImage={page.backgroundImage || config.backgroundImage}
                                                                cornerRadius={exportCornerRadius}
                                                                overridePhotos={rightPhotos}
                                                                overrideLayout={rightLayoutId}
                                                                templateSource={mergedPageTemplates as any}
                                                                onUpdatePhotoPanAndZoom={() => { }}
                                                                onInteractionChange={() => { }}
                                                                onDropPhoto={() => { }}
                                                                useSimpleImage={true}
                                                                photoIndexOffset={getPhotoCount(leftTemplate)}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="relative h-full w-full">
                                                    <PageLayout
                                                        page={page}
                                                        photoGap={page.photoGap ?? config.photoGap}
                                                        backgroundColor={exportPageBackground}
                                                        backgroundImage={page.backgroundImage || config.backgroundImage}
                                                        cornerRadius={exportCornerRadius}
                                                        templateSource={mergedPageTemplates as any}
                                                        onUpdatePhotoPanAndZoom={() => { }}
                                                        onInteractionChange={() => { }}
                                                        onDropPhoto={() => { }}
                                                        useSimpleImage={true}
                                                    />
                                                </div>
                                            );
                                        })()
                                    ) : (
                                        <PageLayout
                                            page={page}
                                            photoGap={page.photoGap ?? config.photoGap}
                                            backgroundColor={exportPageBackground}
                                            backgroundImage={page.backgroundImage || config.backgroundImage}
                                            cornerRadius={exportCornerRadius}
                                            templateSource={mergedPageTemplates as any}
                                            onUpdatePhotoPanAndZoom={() => { }}
                                            onInteractionChange={() => { }}
                                            onDropPhoto={() => { }}
                                            useSimpleImage={true}
                                        />
                                    )}
                                </div>

                                {/* Overlays for Regular Pages */}
                                {!isCover && (
                                    <>
                                        {page.coverTexts?.map(textItem => {
                                            // Calculate font size in pixels relative to the export container width
                                            // Spreads use 3200 (full view).
                                            // Single pages in editor use 3200 logic but seemingly render slightly larger visually?
                                            // Tuning single page reference to 3000 to match user expectation ("tiny bit small" -> larger text).
                                            const referenceWidth = isSpread ? 3200 : 3000;
                                            const fontSizePx = (textItem.style.fontSize / referenceWidth) * pageWidth;

                                            return (
                                                <StaticCoverText
                                                    key={textItem.id}
                                                    item={textItem}
                                                    fontSizeOverride={`${fontSizePx}px`}
                                                />
                                            );
                                        })}
                                        {page.coverImages?.map(imageItem => (
                                            <StaticCoverImage
                                                key={imageItem.id}
                                                item={imageItem}
                                                frameGap={exportDynamicFrameGap}
                                                frameGapColor={exportDynamicFrameGapColor}
                                                containerAspectRatio={pageWidth / pageHeight}
                                            />
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
});

AlbumExporter.displayName = 'AlbumExporter';
