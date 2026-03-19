
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
    Trash2, LayoutTemplate, Download, Wand2, Undo, Redo2, Pencil, BookOpen,
    RotateCw, Plus, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown,
    CornerDownRight, CornerDownLeft, ChevronUp, ChevronDown, Settings2, Lock, LockOpen, Sparkles,
    Maximize2, ArrowUpDown, AlignStartVertical, AlignEndVertical, AlignStartHorizontal, AlignEndHorizontal, AlignCenter
} from 'lucide-react';

import type { AlbumPage, AlbumConfig, CoverImage, Photo, PhotoPanAndZoom } from '@/lib/types';
import type { ExportDpi, ExportRenderOptions } from '@/components/album/shared/album-exporter';
import { logger } from '@/lib/logger';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTemplates, getPhotoCount } from '@/hooks/useTemplates';
import { AdvancedTemplate } from '@/lib/advanced-layout-types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { rotateGridTemplate, rotateAdvancedTemplate, getNextRotation, RotationAngle } from '@/lib/template-rotation';
import { parseLayoutId } from '@/lib/layout-id-utils';
import { useSettings } from '@/hooks/use-settings';
import { useAlbumEditor } from '../album-editor/context';
import { useToast } from '@/hooks/use-toast';
import { useCanvaFrames } from '@/hooks/useCanvaFrames';
import { AlbumCover } from '../book-view/album-cover';
import { TemplatePreview } from '@/components/album/shared/template-preview';
import { LayoutRegion } from '@/lib/advanced-layout-types';
// Import CoverEditorOverlay if needed, or pass onOpenCoverEditor prop to handle it in parent
// Assuming parent handles opening the overlay since it's a modal over everything

// --- HELPER TYPES ---
// All templates now use AdvancedTemplate with regions

// --- HELPERS ---



const LATEST_SAVED_TEMPLATES_STORAGE_KEY = 'album:last-saved-template-ids';
const LATEST_SAVED_TEMPLATES_EVENT = 'album:last-saved-templates';

type LatestSavedTemplatesPayload = {
    ids?: Array<string | number>;
    savedAt?: string;
};

type TemplateSection = {
    key: string;
    title: string;
    templates: AdvancedTemplate[];
};

const TEMPLATE_HOVER_PREVIEW_DELAY_MS = 2000;

type TemplateHoverPreviewState = {
    template: AdvancedTemplate;
    aspectRatio: number;
    pointerX: number;
    pointerY: number;
};


const TemplateThumbnail = ({
    template,
    isSelected,
    onSelect,
    aspectRatio = 1,
    onHoverStart,
    onHoverMove,
    onHoverEnd
}: {
    template: AdvancedTemplate;
    isSelected: boolean;
    onSelect: (templateId: string) => void;
    aspectRatio?: number;
    onHoverStart?: (template: AdvancedTemplate, aspectRatio: number, event: React.MouseEvent<HTMLDivElement>) => void;
    onHoverMove?: (template: AdvancedTemplate, aspectRatio: number, event: React.MouseEvent<HTMLDivElement>) => void;
    onHoverEnd?: (templateId: string | number) => void;
}) => {
    const renderPreview = () => {
        // All templates now use regions
        return (
            <div className="w-full h-full relative overflow-hidden bg-muted">
                <TemplatePreview template={template} />
            </div>
        );
    };

    return (
        <DropdownMenuItem
            onSelect={() => onSelect(String(template.id))}
            onMouseEnter={(event) => onHoverStart?.(template, aspectRatio, event)}
            onMouseMove={(event) => onHoverMove?.(template, aspectRatio, event)}
            onMouseLeave={() => onHoverEnd?.(template.id)}
            className={cn("p-0 focus:bg-accent/50 rounded-md cursor-pointer", isSelected && "ring-2 ring-primary")}
        >
            <div
                className="w-24 p-1 flex flex-col items-center"
            >
                <div style={{ aspectRatio, width: '100%' }} className="rounded-sm overflow-hidden border border-border/50">
                    {renderPreview()}
                </div>
                <span className="text-xs pt-1 text-muted-foreground truncate w-full text-center">{template.name}</span>
            </div>
        </DropdownMenuItem>
    );
};

const SpineEffectOverlay = () => {
    const { settings } = useSettings();
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    const { spineEffectSpread, spineEffectColor, spineEffectColorOpacity, spineEffectWidth, spineEffectOpacity, spineEffectCenterOpacity } = settings;
    return (
        <>
            <div className="absolute top-0 bottom-0 pointer-events-none z-10" style={{ left: `calc(50% - ${spineEffectWidth}px)`, width: `${spineEffectWidth}px`, background: `linear-gradient(to left, rgba(0,0,0,${spineEffectOpacity}), transparent)` }} />
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] z-10" style={{ backgroundColor: hexToRgba(spineEffectColor, spineEffectColorOpacity) }}>
                <div className="absolute inset-y-0 pointer-events-none mix-blend-multiply" style={{ left: `-${spineEffectSpread}px`, right: `-${spineEffectSpread}px`, background: `linear-gradient(to right, transparent, rgba(0,0,0,${spineEffectCenterOpacity}), transparent)` }} />
            </div>
            <div className="absolute top-0 bottom-0 left-1/2 pointer-events-none z-10" style={{ width: `${spineEffectWidth}px`, background: `linear-gradient(to right, rgba(0,0,0,${spineEffectOpacity}), transparent)` }} />
        </>
    );
};

// --- SUB-COMPONENTS ---

const AVAILABLE_FONTS = ['Inter', 'Serif', 'Mono', 'Cursive', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact'];

const DraggableTitle = ({
    text, color, fontSize = 24, fontFamily, position = { x: 50, y: 50 }, containerId, onUpdatePosition
}: {
    text: string; color?: string; fontSize?: number; fontFamily?: string; position?: { x: number; y: number }; containerId: string; onUpdatePosition: (x: number, y: number) => void;
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation(); setIsDragging(true);
    };
    useEffect(() => {
        if (!isDragging) return;
        const handleMouseMove = (e: MouseEvent) => {
            const container = document.getElementById(containerId);
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            onUpdatePosition(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
        };
        const handleMouseUp = () => setIsDragging(false);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, onUpdatePosition]);

    return (
        <div
            id={`draggable-title-${containerId}`}
            onMouseDown={handleMouseDown}
            className={cn("absolute p-2 border border-transparent hover:border-blue-500 rounded cursor-move select-none z-50 group", isDragging && "border-blue-500 bg-blue-500/10")}
            style={{ left: `${position.x}%`, top: `${position.y}%`, transform: 'translate(-50%, -50%)' }}
        >
            <div style={{ color: color || '#000000', fontSize: `${fontSize}px`, fontFamily: fontFamily || 'Inter', whiteSpace: 'nowrap' }}>{text}</div>
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/75 text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Drag to move</div>
        </div>
    );
};

const SpineColorPicker = ({ value, onChange, disableAlpha = false }: { value?: string; onChange: (color: string) => void; disableAlpha?: boolean; }) => {
    const [hex, setHex] = useState(() => {
        if (!value) return '#000000';
        if (value.startsWith('#')) return value;
        if (value.startsWith('rgba')) {
            const parts = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (parts) {
                const toHex = (n: number) => n.toString(16).padStart(2, '0');
                return `#${toHex(parseInt(parts[1]))}${toHex(parseInt(parts[2]))}${toHex(parseInt(parts[3]))}`;
            }
            return '#000000';
        }
        return value;
    });
    const [opacity, setOpacity] = useState(() => {
        if (disableAlpha) return 1;
        if (!value) return 1;
        if (value.startsWith('rgba')) {
            const match = value.match(/rgba?\(.*,\s*([\d.]+)\)/);
            return match ? parseFloat(match[1]) : 1;
        }
        return 1;
    });

    useEffect(() => {
        if (!value) { setHex('#000000'); if (!disableAlpha) setOpacity(0); return; }
        if (value.startsWith('#')) { setHex(value); if (!disableAlpha) setOpacity(1); }
        else if (value.startsWith('rgba')) {
            const parts = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]*)\)/);
            if (parts) {
                const toHex = (n: number) => n.toString(16).padStart(2, '0');
                setHex(`#${toHex(parseInt(parts[1]))}${toHex(parseInt(parts[2]))}${toHex(parseInt(parts[3]))}`);
                if (!disableAlpha) setOpacity(parts[4] ? parseFloat(parts[4]) : 1);
            }
        }
    }, [value, disableAlpha]);

    const updateColor = (newHex: string, newOpacity: number) => {
        setHex(newHex); setOpacity(newOpacity);
        if (disableAlpha) { onChange(newHex); }
        else {
            const r = parseInt(newHex.slice(1, 3), 16), g = parseInt(newHex.slice(3, 5), 16), b = parseInt(newHex.slice(5, 7), 16);
            onChange(`rgba(${r}, ${g}, ${b}, ${newOpacity})`);
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="h-6 w-14 px-1 gap-1 border-dashed" style={{ backgroundColor: (!disableAlpha && opacity === 0) ? 'transparent' : (disableAlpha ? hex : (value || (opacity === 0 ? 'transparent' : hex))), color: (disableAlpha || opacity > 0.5) ? (parseInt(hex.slice(1), 16) > 0xffffff / 2 ? 'black' : 'white') : 'inherit' }}>
                    <div className="w-full h-full flex items-center justify-center text-[10px]">{!disableAlpha && opacity === 0 ? 'None' : ''}</div>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 space-y-3">
                <div className="space-y-1">
                    <Label className="text-xs">Color</Label>
                    <div className="flex gap-2">
                        <input type="color" className="h-8 w-12 p-0 border-0" value={hex} onChange={(e) => updateColor(e.target.value, opacity)} />
                        <input type="text" className="flex-1 h-8 text-xs border rounded px-2 font-mono" value={hex} onChange={(e) => /^#[0-9A-F]{6}$/i.test(e.target.value) && updateColor(e.target.value, opacity)} />
                    </div>
                </div>
                {!disableAlpha && (
                    <div className="space-y-1">
                        <div className="flex justify-between"><Label className="text-xs">Opacity</Label><span className="text-xs text-muted-foreground">{Math.round(opacity * 100)}%</span></div>
                        <Slider value={[opacity]} min={0} max={1} step={0.01} onValueChange={([val]) => updateColor(hex, val)} />
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
};

const PageToolbar = ({
    page, pageNumber, displayLabel, canDelete = true, onDeletePage, onUpdateLayout, onUpdateSpreadLayout, onUpdateCoverLayout, onUpdateCoverType, onUpdateSpineText, onUpdateSpineSettings, onUpdateTitleSettings, onDownloadPage, onUpdatePage, toast, viewMode, onToggleViewMode, visibleTemplateCategories, allowedTemplateIds,
    onCycleLayout, onEnhanceWithAi, onUndo, onRedo, onOpenEditor, onToggleLock, onMovePage, canMoveUp, canMoveDown, config,
    customTemplates = [],
    isDynamicMode = false,
    onToggleDynamicMode,
    dynamicModeDisabledReason,
    selectedDynamicImage,
    onDeleteSelectedDynamicImage,
    onToggleSelectedDynamicImageRotationMode
}: any) => {
    const { gridTemplates, coverTemplates, advancedTemplates, findTemplate, defaultGridTemplate, defaultCoverTemplate } = useTemplates();

    const getAspectRatios = () => {
        if (!config?.size) return { single: 1, spread: 2 };
        const [w, h] = config.size.split('x').map(Number);
        if (isNaN(w) || isNaN(h) || h === 0) return { single: 1, spread: 2 };
        const single = w / h;
        return { single, spread: single * 2 };
    };

    const { single: singleAspectRatio, spread: spreadAspectRatio } = getAspectRatios();

    const filterTemplates = (templates: AdvancedTemplate[], category: 'grid' | 'cover' | 'advanced') => {
        if (visibleTemplateCategories && !visibleTemplateCategories.includes(category)) return [];
        if (allowedTemplateIds && allowedTemplateIds.length > 0) return templates.filter(t => allowedTemplateIds.includes(String(t.id)));
        return templates;
    };

    const filterByType = (templates: AdvancedTemplate[], type: 'single' | 'spread') => {
        return templates.filter(t => {
            // Priority 1: Explicitly typed templates
            if (t.type) {
                if (t.type === 'both') return true;
                return t.type === type;
            }

            // Priority 2: Templates without explicit type - Show them
            // User requested no filtering by system status
            return true;
        });
    };

    const filteredGridTemplates = filterTemplates(gridTemplates, 'grid');
    const filteredCoverTemplates = filterTemplates(coverTemplates, 'cover');
    const filteredAdvancedTemplates = filterTemplates(advancedTemplates, 'advanced');
    const mergeTemplatesById = (...templateLists: AdvancedTemplate[][]) => {
        const map = new Map<string, AdvancedTemplate>();
        templateLists.forEach((templates) => {
            templates.forEach((template) => {
                map.set(String(template.id), template);
            });
        });
        return Array.from(map.values());
    };
    const nonCoverTemplatesWithCustom = mergeTemplatesById(filteredGridTemplates, filteredAdvancedTemplates, customTemplates);
    const coverTemplatesWithCustom = mergeTemplatesById(filteredCoverTemplates, filteredAdvancedTemplates, customTemplates);
    const [latestSavedTemplateIds, setLatestSavedTemplateIds] = useState<string[]>([]);
    const [templateHoverPreview, setTemplateHoverPreview] = useState<TemplateHoverPreviewState | null>(null);
    const hoverPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hoveredTemplateIdRef = useRef<string | null>(null);
    const hoverPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const clearHoverPreviewTimer = useCallback(() => {
        if (hoverPreviewTimerRef.current) {
            clearTimeout(hoverPreviewTimerRef.current);
            hoverPreviewTimerRef.current = null;
        }
    }, []);

    const hideTemplateHoverPreview = useCallback((templateId?: string | number) => {
        const normalizedId = templateId === undefined || templateId === null ? null : String(templateId);

        if (normalizedId === null || hoveredTemplateIdRef.current === normalizedId) {
            hoveredTemplateIdRef.current = null;
            clearHoverPreviewTimer();
        }

        setTemplateHoverPreview((current) => {
            if (!current) return null;
            if (normalizedId === null || String(current.template.id) === normalizedId) return null;
            return current;
        });
    }, [clearHoverPreviewTimer]);

    const handleTemplateHoverStart = useCallback((
        template: AdvancedTemplate,
        aspectRatio: number,
        event: React.MouseEvent<HTMLDivElement>
    ) => {
        const templateId = String(template.id);
        hoveredTemplateIdRef.current = templateId;
        hoverPointerRef.current = { x: event.clientX, y: event.clientY };
        clearHoverPreviewTimer();

        hoverPreviewTimerRef.current = setTimeout(() => {
            if (hoveredTemplateIdRef.current !== templateId) return;
            setTemplateHoverPreview({
                template,
                aspectRatio,
                pointerX: hoverPointerRef.current.x,
                pointerY: hoverPointerRef.current.y
            });
        }, TEMPLATE_HOVER_PREVIEW_DELAY_MS);
    }, [clearHoverPreviewTimer]);

    const handleTemplateHoverMove = useCallback((
        template: AdvancedTemplate,
        aspectRatio: number,
        event: React.MouseEvent<HTMLDivElement>
    ) => {
        const templateId = String(template.id);
        if (hoveredTemplateIdRef.current !== templateId) return;

        hoverPointerRef.current = { x: event.clientX, y: event.clientY };

        setTemplateHoverPreview((current) => {
            // Before opening, only keep latest pointer for the delayed initial position.
            if (!current || String(current.template.id) !== templateId) {
                return current;
            }

            if (
                current.pointerX === event.clientX
                && current.pointerY === event.clientY
                && current.aspectRatio === aspectRatio
            ) {
                return current;
            }

            return {
                ...current,
                aspectRatio,
                pointerX: event.clientX,
                pointerY: event.clientY
            };
        });
    }, []);

    useEffect(() => {
        return () => {
            clearHoverPreviewTimer();
        };
    }, [clearHoverPreviewTimer]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const readLatestSavedTemplateIds = () => {
            try {
                const raw = window.localStorage.getItem(LATEST_SAVED_TEMPLATES_STORAGE_KEY);
                if (!raw) {
                    setLatestSavedTemplateIds([]);
                    return;
                }
                const parsed = JSON.parse(raw) as LatestSavedTemplatesPayload;
                const ids = Array.isArray(parsed?.ids) ? parsed.ids.map((id) => String(id)) : [];
                setLatestSavedTemplateIds(ids);
            } catch {
                setLatestSavedTemplateIds([]);
            }
        };

        const handleLatestSavedTemplates = (event: Event) => {
            const { detail } = event as CustomEvent<LatestSavedTemplatesPayload>;
            const ids = Array.isArray(detail?.ids) ? detail.ids.map((id) => String(id)) : [];
            setLatestSavedTemplateIds(ids);
        };

        readLatestSavedTemplateIds();
        window.addEventListener(LATEST_SAVED_TEMPLATES_EVENT, handleLatestSavedTemplates as EventListener);

        return () => {
            window.removeEventListener(LATEST_SAVED_TEMPLATES_EVENT, handleLatestSavedTemplates as EventListener);
        };
    }, []);

    const getTemplateRecencyScore = (template: AdvancedTemplate) => {
        const metadata = template as unknown as Record<string, unknown>;
        const createdAt = metadata.created_at ?? metadata.createdAt;
        const updatedAt = metadata.updated_at ?? metadata.updatedAt;
        const dateValue = (typeof createdAt === 'string' ? createdAt : null) || (typeof updatedAt === 'string' ? updatedAt : null);

        if (dateValue) {
            const parsedDate = Date.parse(dateValue);
            if (!Number.isNaN(parsedDate)) return parsedDate;
        }

        const numericId = Number(template.id);
        if (!Number.isNaN(numericId)) return numericId;

        return 0;
    };

    const sortTemplatesByRecency = (templates: AdvancedTemplate[]) => {
        return [...templates].sort((a, b) => {
            const recencyDiff = getTemplateRecencyScore(b) - getTemplateRecencyScore(a);
            if (recencyDiff !== 0) return recencyDiff;

            const numericIdDiff = Number(b.id) - Number(a.id);
            if (!Number.isNaN(numericIdDiff) && numericIdDiff !== 0) return numericIdDiff;

            return String(b.id).localeCompare(String(a.id));
        });
    };

    const buildTemplateSections = (templates: AdvancedTemplate[], type: 'single' | 'spread'): TemplateSection[] => {
        const typedTemplates = filterByType(templates, type);
        const sortedTemplates = sortTemplatesByRecency(typedTemplates);
        const latestIdSet = new Set(latestSavedTemplateIds);
        const latestFromLastSave = sortedTemplates.filter((template) => latestIdSet.has(String(template.id)));
        const latestTemplates = latestFromLastSave.length > 0
            ? latestFromLastSave
            : sortedTemplates.slice(0, 3);
        const latestTemplateIdSet = new Set(latestTemplates.map((template) => String(template.id)));
        const remainingTemplates = sortedTemplates.filter((template) => !latestTemplateIdSet.has(String(template.id)));

        const sections: TemplateSection[] = [];

        sections.push({
            key: 'latest',
            title: 'Latest',
            templates: latestTemplates
        });

        const groupedByPhotoCount = new Map<number, AdvancedTemplate[]>();
        for (const template of remainingTemplates) {
            const photoCount = getPhotoCount(template);
            if (!groupedByPhotoCount.has(photoCount)) {
                groupedByPhotoCount.set(photoCount, []);
            }
            groupedByPhotoCount.get(photoCount)!.push(template);
        }

        const sortedPhotoCounts = Array.from(groupedByPhotoCount.keys()).sort((a, b) => a - b);
        for (const photoCount of sortedPhotoCounts) {
            const countTemplates = groupedByPhotoCount.get(photoCount) ?? [];
            sections.push({
                key: `count-${photoCount}`,
                title: `${photoCount} ${photoCount === 1 ? 'Photo' : 'Photos'}`,
                templates: countTemplates
            });
        }

        return sections;
    };

    const renderTemplateDropdownContent = (
        templates: AdvancedTemplate[],
        type: 'single' | 'spread',
        selectedLayoutId: string | number | null | undefined,
        onSelectTemplate: (templateId: string) => void,
        aspectRatio: number
    ) => {
        const sections = buildTemplateSections(templates, type);
        const hasTemplates = sections.some((section) => section.templates.length > 0);

        return (
            <DropdownMenuContent
                className="p-2 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 w-[440px]"
                onEscapeKeyDown={() => hideTemplateHoverPreview()}
                onInteractOutside={() => hideTemplateHoverPreview()}
            >
                {!hasTemplates ? (
                    <div className="px-2 py-1 text-xs text-muted-foreground">No templates found</div>
                ) : (
                    <div className="space-y-3">
                        {sections.filter((section) => section.templates.length > 0).map((section) => (
                            <div key={section.key} className="space-y-1.5">
                                <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/50 px-2 py-1">
                                    <span className="inline-block h-2 w-2 rounded-full bg-primary/80" />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/90">
                                        {section.title}
                                    </span>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {section.templates.map((template) => (
                                        <TemplateThumbnail
                                            key={template.id}
                                            template={template}
                                            isSelected={isTemplateSelected(selectedLayoutId, template.id)}
                                            onSelect={(templateId) => {
                                                hideTemplateHoverPreview();
                                                onSelectTemplate(templateId);
                                            }}
                                            aspectRatio={aspectRatio}
                                            onHoverStart={handleTemplateHoverStart}
                                            onHoverMove={handleTemplateHoverMove}
                                            onHoverEnd={hideTemplateHoverPreview}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </DropdownMenuContent>
        );
    };

    const renderTemplateHoverPreview = () => {
        if (!templateHoverPreview) return null;
        if (typeof document === 'undefined') return null;

        const previewWidth = templateHoverPreview.aspectRatio >= 1.5 ? 340 : 280;

        return createPortal(
            <div
                className="pointer-events-none fixed z-[9999] w-auto rounded-lg border border-border/80 bg-background/95 p-2 shadow-2xl backdrop-blur-sm"
                style={{
                    left: templateHoverPreview.pointerX,
                    top: templateHoverPreview.pointerY,
                    width: previewWidth,
                    transform: 'translate(-100%, -100%)'
                }}
            >
                <div className="mb-1.5 text-[11px] font-semibold text-foreground truncate">
                    {templateHoverPreview.template.name}
                </div>
                <div className="overflow-hidden rounded-md border border-border/70 bg-muted" style={{ aspectRatio: templateHoverPreview.aspectRatio }}>
                    <TemplatePreview template={templateHoverPreview.template} variant="detailed" />
                </div>
            </div>,
            document.body
        );
    };
    const [showSpineSettings, setShowSpineSettings] = useState(false);
    const isCoverOrSpread = page.isCover || page.type === 'spread';
    const isSplit = page.isCover ? (page.coverType === 'split' || !page.coverType) : (page.spreadMode === 'split');
    const isFull = !isSplit;
    const isLocked = !!page.isLocked;

    useEffect(() => {
        if (isLocked && showSpineSettings) {
            setShowSpineSettings(false);
        }
    }, [isLocked, showSpineSettings]);
    const isTemplateSelected = useCallback((layoutId: string | number | null | undefined, templateId: string | number) => {
        const { baseId } = parseLayoutId(layoutId || '');
        return String(baseId) === String(templateId);
    }, []);

    const renderLayoutCycleButtons = () => (
        <div className="flex items-center gap-0.5 border-r pr-2 mr-2">
            {[1, 2, 3, 4, 5, 6].map(count => {
                const { baseId } = parseLayoutId(page.layout || defaultGridTemplate?.id || '');
                const currentTemplate = findTemplate(baseId);
                const currentCount = currentTemplate ? getPhotoCount(currentTemplate) : 0;
                const isActive = currentCount === count;
                return (
                    <Button
                        key={count}
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-6 w-6 p-0 text-[10px] font-bold transition-all",
                            isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:text-foreground hover:bg-muted",
                            isLocked && "opacity-45 cursor-not-allowed"
                        )}
                        disabled={isLocked}
                        onClick={() => onCycleLayout?.(count)}
                    >
                        {count}
                    </Button>
                );
            })}
        </div>
    );

    const renderCommonActions = () => (
        <>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 w-8", isLocked && "text-primary")}
                        onClick={() => onToggleLock?.(page.id)}
                    >
                        {isLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{isLocked ? "Unlock Page" : "Lock Page"}</TooltipContent>
            </Tooltip>
            {!page.isCover && (
                <>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-8 w-8", !canMoveUp && "opacity-45 cursor-not-allowed")}
                                onClick={() => onMovePage?.(page.id, 'up')}
                                disabled={!canMoveUp}
                            >
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Move Page Up</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-8 w-8", !canMoveDown && "opacity-45 cursor-not-allowed")}
                                onClick={() => onMovePage?.(page.id, 'down')}
                                disabled={!canMoveDown}
                            >
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Move Page Down</TooltipContent>
                    </Tooltip>
                </>
            )}
            <div className="h-4 w-px bg-border mx-1" />
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEnhanceWithAi?.(page.id)} disabled={isLocked}><Wand2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>AI Enhance</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onUndo?.(page.id)} disabled={isLocked}><Undo className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Undo</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRedo?.(page.id)} disabled={isLocked}><Redo2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Redo</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenEditor?.(page.id)} disabled={isLocked}><Pencil className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{page.isCover ? "Cover Editor" : "Page Editor"}</TooltipContent></Tooltip>
            <div className="h-4 w-px bg-border mx-1" />
        </>
    );

    const renderDownloadMenu = (tooltipLabel: string) => (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Download className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{tooltipLabel}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
                {[
                    { dpi: 150 as ExportDpi, label: 'Download 150 DPI (Fast)' },
                    { dpi: 200 as ExportDpi, label: 'Download 200 DPI (Balanced)' },
                    { dpi: 300 as ExportDpi, label: 'Download 300 DPI (Print)' },
                ].map((option) => (
                    <DropdownMenuItem
                        key={option.dpi}
                        onSelect={() => onDownloadPage?.(page.id, { dpi: option.dpi })}
                    >
                        {option.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    if (isCoverOrSpread) {
        return (
            <>
                <div className="">
                    <TooltipProvider>
                        <div className="flex items-center gap-1 rounded-lg border bg-background p-0.5 shadow-lg px-2 flex-wrap min-h-[42px]">
                            <span className="text-sm font-semibold text-muted-foreground mr-auto pl-1 whitespace-nowrap">{displayLabel || (page.isCover ? "Cover" : `Page ${pageNumber}`)}</span>

                            {/* Layout Toggle - BookOpen icon */}
                            <div className="flex items-center gap-2 border-r pr-2 mr-2">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={isFull ? "secondary" : "ghost"}
                                            size="icon"
                                            className={cn("h-8 w-8", isFull && "bg-primary/10 text-primary hover:bg-primary/20")}
                                            disabled={isLocked}
                                            onClick={() => {
                                                const newMode = isFull ? 'split' : 'full';
                                                if (page.isCover) onUpdateCoverType?.(page.id, newMode);
                                                else onUpdatePage?.({ ...page, spreadMode: newMode });
                                            }}
                                        >
                                            <BookOpen className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{isFull ? "Switch to Split Mode" : "Switch to Full Mode"}</TooltipContent>
                                </Tooltip>
                            </div>

                            {/* Integrated Actions */}
                            {isFull && renderLayoutCycleButtons()}
                            {renderCommonActions()}

                            <div className="flex items-center gap-1">
                                {isSplit ? (
                                    <>
                                        <DropdownMenu>
                                            <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="gap-1 px-2" disabled={isLocked}><LayoutTemplate className="h-4 w-4" /><span className="text-xs">{page.isCover ? "Back" : "Page 1"}</span></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent>{page.isCover ? "Back Cover Layout" : "Page 1 Layout"}</TooltipContent></Tooltip>
                                            {renderTemplateDropdownContent(
                                                page.isCover ? coverTemplatesWithCustom : nonCoverTemplatesWithCustom,
                                                'single',
                                                page.isCover
                                                    ? (page.coverLayouts?.back || defaultCoverTemplate?.id || '')
                                                    : (page.spreadLayouts?.left || defaultGridTemplate?.id || ''),
                                                (templateId) => {
                                                    // Reset rotation to 0 when selecting new template
                                                    const finalId = templateId;
                                                    if (page.isCover) onUpdateCoverLayout?.(page.id, 'back', String(finalId));
                                                    else onUpdateSpreadLayout ? onUpdateSpreadLayout(page.id, 'left', String(finalId)) : onUpdatePage?.({ ...page, spreadLayouts: { ...(page.spreadLayouts || { left: defaultGridTemplate?.id || '', right: defaultGridTemplate?.id || '' }), left: String(finalId) } });
                                                },
                                                singleAspectRatio
                                            )}
                                        </DropdownMenu>
                                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="relative h-8 w-8" disabled={isLocked} onClick={() => {
                                            const currentLayoutId = page.isCover ? page.coverLayouts?.back : page.spreadLayouts?.left;
                                            const { baseId, rotation } = parseLayoutId(currentLayoutId || defaultGridTemplate?.id || '');
                                            const newRotation = getNextRotation(rotation);
                                            const newLayout = newRotation === 0 ? baseId : `${baseId}_r${newRotation}`;
                                            if (page.isCover) onUpdateCoverLayout?.(page.id, 'back', String(newLayout));
                                            else onUpdateSpreadLayout ? onUpdateSpreadLayout(page.id, 'left', String(newLayout)) : onUpdatePage?.({ ...page, spreadLayouts: { ...(page.spreadLayouts || { left: defaultGridTemplate?.id || '', right: defaultGridTemplate?.id || '' }), left: String(newLayout) } });
                                        }}><RotateCw className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Rotate Layout</TooltipContent></Tooltip>
                                        {/* Smart Layout Toggle (Left/Back) */}
                                        {(String(parseLayoutId(page.isCover ? page.coverLayouts?.back || defaultCoverTemplate?.id || '' : page.spreadLayouts?.left || defaultGridTemplate?.id || '').baseId).startsWith('dynamic-justified')) && (
                                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="relative h-8 w-8" disabled={isLocked} onClick={() => {
                                                const currentLayoutId = page.isCover ? page.coverLayouts?.back : page.spreadLayouts?.left;
                                                const { baseId, rotation } = parseLayoutId(currentLayoutId || defaultGridTemplate?.id || '');
                                                const nextBaseId = baseId === 'dynamic-justified' ? 'dynamic-justified-smart' : 'dynamic-justified';
                                                const newLayout = rotation === 0 ? nextBaseId : `${nextBaseId}_r${rotation}`;
                                                if (page.isCover) {
                                                    onUpdateCoverLayout?.(page.id, 'back', String(newLayout));
                                                } else {
                                                    // CRITICAL: Update BOTH spreadLayouts AND page.layout
                                                    // page.layout is what full spread mode uses for rendering
                                                    onUpdatePage?.({
                                                        ...page,
                                                        layout: String(newLayout),
                                                        spreadLayouts: {
                                                            ...(page.spreadLayouts || { left: defaultGridTemplate?.id || '', right: defaultGridTemplate?.id || '' }),
                                                            left: String(newLayout),
                                                            right: String(newLayout)
                                                        }
                                                    });
                                                }
                                            }}><Wand2 className={cn("h-4 w-4", parseLayoutId(page.isCover ? page.coverLayouts?.back || defaultCoverTemplate?.id || '' : page.spreadLayouts?.left || defaultGridTemplate?.id || '').baseId === 'dynamic-justified-smart' && "text-primary fill-primary/20")} /></Button></TooltipTrigger><TooltipContent>Toggle Smart Fill</TooltipContent></Tooltip>
                                        )}
                                        <div className="h-4 w-px bg-border mx-1" />
                                        <DropdownMenu>
                                            <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="gap-1 px-2" disabled={isLocked}><LayoutTemplate className="h-4 w-4" /><span className="text-xs">{page.isCover ? "Front" : "Page 2"}</span></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent>{page.isCover ? "Front Cover Layout" : "Page 2 Layout"}</TooltipContent></Tooltip>
                                            {renderTemplateDropdownContent(
                                                page.isCover ? coverTemplatesWithCustom : nonCoverTemplatesWithCustom,
                                                'single',
                                                page.isCover
                                                    ? (page.coverLayouts?.front || defaultCoverTemplate?.id || '')
                                                    : (page.spreadLayouts?.right || defaultGridTemplate?.id || ''),
                                                (templateId) => {
                                                    // Reset rotation to 0 when selecting new template
                                                    const finalId = templateId;
                                                    if (page.isCover) onUpdateCoverLayout?.(page.id, 'front', String(finalId));
                                                    else onUpdateSpreadLayout ? onUpdateSpreadLayout(page.id, 'right', String(finalId)) : onUpdatePage?.({ ...page, spreadLayouts: { ...(page.spreadLayouts || { left: defaultGridTemplate?.id || '', right: defaultGridTemplate?.id || '' }), right: String(finalId) } });
                                                },
                                                singleAspectRatio
                                            )}
                                        </DropdownMenu>
                                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="relative h-8 w-8" disabled={isLocked} onClick={() => {
                                            const currentLayoutId = page.isCover ? page.coverLayouts?.front : page.spreadLayouts?.right;
                                            const { baseId, rotation } = parseLayoutId(currentLayoutId || defaultGridTemplate?.id || '');
                                            const newRotation = getNextRotation(rotation);
                                            const newLayout = newRotation === 0 ? baseId : `${baseId}_r${newRotation}`;
                                            if (page.isCover) onUpdateCoverLayout?.(page.id, 'front', String(newLayout));
                                            else onUpdateSpreadLayout ? onUpdateSpreadLayout(page.id, 'right', String(newLayout)) : onUpdatePage?.({ ...page, spreadLayouts: { ...(page.spreadLayouts || { left: defaultGridTemplate?.id || '', right: defaultGridTemplate?.id || '' }), right: String(newLayout) } });
                                        }}><RotateCw className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Rotate Layout</TooltipContent></Tooltip>
                                        {/* Smart Layout Toggle (Right/Front) */}
                                        {(String(parseLayoutId(page.isCover ? page.coverLayouts?.front || defaultCoverTemplate?.id || '' : page.spreadLayouts?.right || defaultGridTemplate?.id || '').baseId).startsWith('dynamic-justified')) && (
                                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="relative h-8 w-8" disabled={isLocked} onClick={() => {
                                                const currentLayoutId = page.isCover ? page.coverLayouts?.front : page.spreadLayouts?.right;
                                                const { baseId, rotation } = parseLayoutId(currentLayoutId || defaultGridTemplate?.id || '');
                                                const nextBaseId = baseId === 'dynamic-justified' ? 'dynamic-justified-smart' : 'dynamic-justified';
                                                const newLayout = rotation === 0 ? nextBaseId : `${nextBaseId}_r${rotation}`;
                                                if (page.isCover) onUpdateCoverLayout?.(page.id, 'front', String(newLayout));
                                                else onUpdateSpreadLayout ? onUpdateSpreadLayout(page.id, 'right', String(newLayout)) : onUpdatePage?.({ ...page, spreadLayouts: { ...(page.spreadLayouts || { left: defaultGridTemplate?.id || '', right: defaultGridTemplate?.id || '' }), right: String(newLayout) } });
                                            }}><Wand2 className={cn("h-4 w-4", parseLayoutId(page.isCover ? page.coverLayouts?.front || defaultCoverTemplate?.id || '' : page.spreadLayouts?.right || defaultGridTemplate?.id || '').baseId === 'dynamic-justified-smart' && "text-primary fill-primary/20")} /></Button></TooltipTrigger><TooltipContent>Toggle Smart Fill</TooltipContent></Tooltip>
                                        )}

                                    </>
                                ) : (
                                    <>
                                        <DropdownMenu>
                                            <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="gap-1 px-2" disabled={isLocked}><LayoutTemplate className="h-4 w-4" /><span className="text-xs">Layout</span></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent>Spread Layout</TooltipContent></Tooltip>
                                            {renderTemplateDropdownContent(
                                                page.isCover ? coverTemplatesWithCustom : nonCoverTemplatesWithCustom,
                                                'spread',
                                                page.layout || defaultGridTemplate?.id || '',
                                                (templateId) => {
                                                    // Reset rotation to 0 when selecting new template
                                                    const finalId = templateId;
                                                    if (page.isCover) onUpdateCoverLayout?.(page.id, 'full', String(finalId));
                                                    else onUpdateLayout(page.id, String(finalId));
                                                },
                                                spreadAspectRatio
                                            )}
                                        </DropdownMenu>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="relative" disabled={isLocked} onClick={() => {
                                                    const { baseId, rotation } = parseLayoutId(page.layout || defaultGridTemplate?.id || '');
                                                    const newRotation = getNextRotation(rotation);
                                                    const newLayout = newRotation === 0 ? baseId : `${baseId}_r${newRotation}`;
                                                    if (page.isCover) onUpdateCoverLayout?.(page.id, 'full', String(newLayout));
                                                    else onUpdateLayout(page.id, String(newLayout));
                                                }}><RotateCw className="h-4 w-4" /></Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Rotate Layout 90°</TooltipContent>
                                        </Tooltip>
                                        {/* Smart Layout Toggle (Full) */}
                                        {(String(parseLayoutId(page.layout || defaultGridTemplate?.id || '').baseId).startsWith('dynamic-justified')) && (
                                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="relative" disabled={isLocked} onClick={() => {
                                                const { baseId, rotation } = parseLayoutId(page.layout || (page.isCover ? defaultCoverTemplate?.id : defaultGridTemplate?.id) || '');
                                                const nextBaseId = baseId === 'dynamic-justified' ? 'dynamic-justified-smart' : 'dynamic-justified';
                                                const newLayout = rotation === 0 ? nextBaseId : `${nextBaseId}_r${rotation}`;
                                                console.log('[SmartFillToggle] Clicked!', { pageId: page.id, currentLayout: page.layout, newLayout: String(newLayout), photosCount: page.photos?.length });
                                                if (page.isCover) onUpdateCoverLayout?.(page.id, 'full', String(newLayout));
                                                else onUpdateLayout(page.id, String(newLayout));
                                            }}><Wand2 className={cn("h-4 w-4", parseLayoutId(page.layout || defaultGridTemplate?.id || '').baseId === 'dynamic-justified-smart' && "text-primary fill-primary/20")} /></Button></TooltipTrigger><TooltipContent>Toggle Smart Fill</TooltipContent></Tooltip>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="h-4 w-px bg-border mx-2" />

                            {
                                page.isCover && (
                                    <Popover>
                                        <PopoverTrigger asChild><Button variant="ghost" size="icon" className={cn(showSpineSettings && "text-primary bg-primary/10")} onClick={() => setShowSpineSettings(!showSpineSettings)} disabled={isLocked}><Settings2 className="h-4 w-4" /></Button></PopoverTrigger>
                                        <PopoverContent align="end" className="w-[380px] p-0 border-none shadow-none bg-transparent">
                                            <div className="bg-background/95 backdrop-blur-sm p-4 rounded-xl border shadow-xl animate-in fade-in zoom-in-95 duration-200">
                                                <div className="flex items-center gap-2 mb-4"><div className="w-1.5 h-4 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" /><h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Spine Structure</h4></div>
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div className="space-y-2"><div className="flex justify-between items-center px-0.5"><Label className="text-[10px] font-semibold uppercase text-muted-foreground/70">Width</Label><span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded text-foreground">{page.spineWidth ?? 40}px</span></div><Slider value={[page.spineWidth ?? 40]} min={0} max={100} step={1} onValueChange={(val) => onUpdateSpineSettings?.(page.id, { width: val[0] })} className="py-2" disabled={isLocked} /></div>
                                                        <div className="space-y-2"><div className="flex justify-between items-center px-0.5"><Label className="text-[10px] font-semibold uppercase text-muted-foreground/70">Opacity</Label><span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded text-foreground">{Math.round((page.spineOpacity ?? 1) * 100)}%</span></div><Slider value={[page.spineOpacity ?? 1]} min={0} max={1} step={0.01} onValueChange={(val) => onUpdateSpineSettings?.(page.id, { opacity: val[0] })} className="py-2" disabled={isLocked} /></div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-6 pt-2 border-t border-border/40">
                                                        <div className="space-y-2"><Label className="text-[10px] font-semibold uppercase text-muted-foreground/70 px-0.5">Background</Label><div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-lg border border-transparent hover:border-border transition-colors"><SpineColorPicker value={page.spineColor || '#ffffff'} onChange={(color) => onUpdateSpineSettings?.(page.id, { color })} /><span className="text-[10px] font-mono text-foreground font-medium uppercase tracking-tighter">{page.spineColor || '#FFFFFF'}</span></div></div>
                                                        <div className="space-y-2"><Label className="text-[10px] font-semibold uppercase text-muted-foreground/70 px-0.5">Spine Text</Label><Input value={page.spineText || ''} onChange={(e) => onUpdateSpineText?.(page.id, e.target.value)} placeholder="My Album..." className="h-8 text-xs px-3 bg-muted/30 border-transparent focus-visible:bg-background transition-all" disabled={isLocked} /></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                )
                            }
                            {renderDownloadMenu(`Download ${page.isCover ? "Cover" : "Spread"}`)}
                            {!page.isCover && <><div className="h-4 w-px bg-border mx-2" /><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={cn("text-destructive hover:bg-destructive/10 hover:text-destructive", (!canDelete || isLocked) && "opacity-50 cursor-not-allowed")} onClick={() => canDelete && onDeletePage(page.id)} disabled={!canDelete || isLocked}><Trash2 className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent>Delete Spread</TooltipContent></Tooltip></>}

                        </div >
                    </TooltipProvider >
                </div >
                {renderTemplateHoverPreview()}
            </>
        );
    }

    return (
        <>
            <div className="mb-2">
                <TooltipProvider>
                    <div className="flex items-center justify-between gap-1 rounded-lg border bg-background p-0.5 shadow-lg px-2 min-h-[42px]">
                        <span className="text-sm font-semibold text-muted-foreground mr-auto">{displayLabel || `Page ${pageNumber}`}</span>

                        {/* Integrated Actions for Single Page */}
                        {renderLayoutCycleButtons()}
                        {renderCommonActions()}

                        <div className="flex items-center gap-1">
                            <DropdownMenu>
                                <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={isLocked}><LayoutTemplate className="h-5 w-5" /></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent>Page Layout</TooltipContent></Tooltip>
                                {renderTemplateDropdownContent(
                                    nonCoverTemplatesWithCustom,
                                    'single',
                                    page.layout || (page.isCover ? defaultCoverTemplate?.id : defaultGridTemplate?.id) || '',
                                    (templateId) => {
                                        // Reset rotation to 0 when selecting new template
                                        const finalId = templateId;
                                        onUpdateLayout(page.id, String(finalId));
                                    },
                                    singleAspectRatio
                                )}
                            </DropdownMenu>
                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="relative" disabled={isLocked} onClick={() => {
                                const { baseId, rotation } = parseLayoutId(page.layout || (page.isCover ? defaultCoverTemplate?.id : defaultGridTemplate?.id) || '');
                                const newRotation = getNextRotation(rotation);
                                const newLayout = newRotation === 0 ? baseId : `${baseId}_r${newRotation}`;
                                onUpdateLayout(page.id, String(newLayout));
                            }}><RotateCw className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Rotate Layout</TooltipContent></Tooltip>
                            {/* Smart Layout Toggle (Single Page) */}
                            {(String(parseLayoutId(page.layout || (page.isCover ? defaultCoverTemplate?.id : defaultGridTemplate?.id) || '').baseId).startsWith('dynamic-justified')) && (
                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="relative" disabled={isLocked} onClick={() => {
                                    const { baseId, rotation } = parseLayoutId(page.layout || (page.isCover ? defaultCoverTemplate?.id : defaultGridTemplate?.id) || '');
                                    const nextBaseId = baseId === 'dynamic-justified' ? 'dynamic-justified-smart' : 'dynamic-justified';
                                    const newLayout = rotation === 0 ? nextBaseId : `${nextBaseId}_r${rotation}`;
                                    onUpdateLayout(page.id, String(newLayout));
                                }}><Wand2 className={cn("h-4 w-4", parseLayoutId(page.layout || (page.isCover ? defaultCoverTemplate?.id : defaultGridTemplate?.id) || '').baseId === 'dynamic-justified-smart' && "text-primary fill-primary/20")} /></Button></TooltipTrigger><TooltipContent>Toggle Smart Fill</TooltipContent></Tooltip>
                            )}
                            {page.isCover && (
                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={cn(showSpineSettings && "text-primary bg-primary/10")} onClick={() => setShowSpineSettings(!showSpineSettings)} disabled={isLocked}><Settings2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Show Title Settings</TooltipContent></Tooltip>
                            )}
                            {renderDownloadMenu('Download Page')}
                            <div className="mx-1 h-6 w-px bg-border" />
                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={cn("text-destructive hover:bg-destructive/10 hover:text-destructive", (!canDelete || isLocked) && "opacity-50 cursor-not-allowed")} onClick={() => canDelete && onDeletePage(page.id)} disabled={!canDelete || isLocked}><Trash2 className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent>{canDelete ? "Delete Page" : "Cannot delete first/last page"}</TooltipContent></Tooltip>
                        </div>
                        {
                            showSpineSettings && (
                                <div className="mt-2 p-3 bg-background border rounded-lg shadow-xl space-y-4 animate-in slide-in-from-top-2 duration-200 w-full">
                                    <div className="space-y-3 p-3 bg-muted/30 rounded-md border border-border/50 max-w-lg mx-auto">
                                        <div className="flex items-center gap-2 mb-1"><div className="w-1.5 h-4 bg-orange-500 rounded-full" /><h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Title Properties</h4></div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5 col-span-2"><Label className="text-[10px] font-medium uppercase text-muted-foreground">Display Title</Label><Input value={page.titleText || ''} onChange={(e) => onUpdateTitleSettings?.(page.id, { text: e.target.value })} placeholder="Page Title..." className="h-7 text-xs px-2" disabled={isLocked} /></div>
                                            <div className="space-y-1.5"><div className="flex justify-between items-center"><Label className="text-[10px] font-medium uppercase text-muted-foreground">Size</Label><span className="text-[10px] font-bold font-mono">{page.titleFontSize ?? 24}px</span></div><Slider value={[page.titleFontSize ?? 24]} min={8} max={120} step={1} onValueChange={(val) => onUpdateTitleSettings?.(page.id, { fontSize: val[0] })} disabled={isLocked} /></div>
                                            <div className="space-y-1.5"><Label className="text-[10px] font-medium uppercase text-muted-foreground">Color</Label><div className="flex items-center gap-2"><SpineColorPicker value={page.titleColor || '#000000'} onChange={(color) => onUpdateTitleSettings?.(page.id, { color })} disableAlpha={true} /><span className="text-[10px] text-muted-foreground font-mono truncate">{page.titleColor || '#000000'}</span></div></div>
                                            <div className="space-y-1.5 col-span-2"><Label className="text-[10px] font-medium uppercase text-muted-foreground">Font Family</Label><div className="flex flex-wrap gap-1">{AVAILABLE_FONTS.slice(0, 8).map(font => (<Button key={font} variant={page.titleFontFamily === font ? "default" : "outline"} size="sm" className="h-6 px-2 text-[10px]" onClick={() => onUpdateTitleSettings?.(page.id, { fontFamily: font })} disabled={isLocked}>{font}</Button>))}</div></div>
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                    </div >
                </TooltipProvider >
            </div >
            {renderTemplateHoverPreview()}
        </>
    );
};

const ScaledCoverPreview = React.memo(({
    page,
    config,
    onUpdatePage,
    onUpdateTitleSettings,
    onDropPhoto,
    onDynamicDropPhoto,
    onUpdatePhotoPanAndZoom,
    onInteractionChange,
    onRemovePhoto,
    onEnhancePhotoWithAi,
    allPhotos = [],
    previousPagePhotos = [],
    activeView = 'full',
    priority = false, // Add priority here
    chronologicalIndex,
    templateName,
    requiredLabel,
    isLocked = false,
    dynamicMode = false,
    dynamicModeDisabledReason,
    selectedDynamicImage,
    onToggleDynamicMode,
    onOpenDynamicTemplateDialog,
    canvaFrames = [],
    canvaFramesLoading = false,
    onApplyCanvaFrameToSelectedDynamicImage,
    onToggleSelectedDynamicImageRotationMode,
    onDeleteSelectedDynamicImage,
    onMatchSelectedDynamicFramesSize,
    onAlignSelectedDynamicFrames,
    activeDynamicImageIds = [],
    onSelectDynamicImage,
    disableFrameDrop = false,
    extraTemplates = [],
    lockOverlayImageAspectRatio = false,
}: {
    page: AlbumPage;
    config: AlbumConfig;
    onUpdatePage?: (page: AlbumPage) => void;
    onUpdateTitleSettings?: any;
    onDropPhoto?: any;
    onDynamicDropPhoto?: (
        pageId: string,
        droppedPhotoId: string,
        payload: { x: number; y: number; containerAspectRatio: number }
    ) => void;
    onUpdatePhotoPanAndZoom?: any;
    onInteractionChange?: (isInteracting: boolean) => void;
    onRemovePhoto?: any;
    onEnhancePhotoWithAi?: (pageId: string, photoId: string, photo: Photo) => void;
    allPhotos?: Photo[];
    previousPagePhotos?: Photo[];
    activeView?: 'full' | 'split' | 'front' | 'back';
    priority?: boolean;
    chronologicalIndex?: Record<string, number>;
    templateName?: string;
    requiredLabel?: string;
    isLocked?: boolean;
    dynamicMode?: boolean;
    dynamicModeDisabledReason?: string | null;
    selectedDynamicImage?: CoverImage | null;
    onToggleDynamicMode?: () => void;
    onOpenDynamicTemplateDialog?: () => void;
    canvaFrames?: AdvancedTemplate[];
    canvaFramesLoading?: boolean;
    onApplyCanvaFrameToSelectedDynamicImage?: (frameTemplate: AdvancedTemplate | null) => void;
    onToggleSelectedDynamicImageRotationMode?: () => void;
    onDeleteSelectedDynamicImage?: () => void;
    onMatchSelectedDynamicFramesSize?: (mode: 'both' | 'width' | 'height') => void;
    onAlignSelectedDynamicFrames?: (mode: 'left' | 'right' | 'top' | 'bottom' | 'center') => void;
    activeDynamicImageIds?: string[];
    onSelectDynamicImage?: (id: string | string[] | null, isMulti?: boolean) => void;
    disableFrameDrop?: boolean;
    extraTemplates?: AdvancedTemplate[];
    lockOverlayImageAspectRatio?: boolean;
}) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const BASE_PAGE_PX = 450;

    const sizeStr = config?.size || '800x600';
    const [wStr, hStr] = sizeStr.split('x');
    const cfgW = Number(wStr);
    const cfgH = Number(hStr);
    const pxPerUnit = BASE_PAGE_PX / cfgH;
    const singlePageLogicalW = cfgW * pxPerUnit;
    const spineWidth = page.isCover ? (page.spineWidth !== undefined ? page.spineWidth : 40) : 0;
    const isDouble = page.isCover || page.type === 'spread';
    const logicalWidth = isDouble ? (singlePageLogicalW * 2) + spineWidth : singlePageLogicalW;
    const logicalHeight = BASE_PAGE_PX;

    useEffect(() => {
        if (!wrapperRef.current) return;
        const measure = () => {
            const wrapper = wrapperRef.current;
            if (!wrapper) return;
            const { width: availW, height: availH } = wrapper.getBoundingClientRect();
            if (availW === 0 || availH === 0) return;
            const scaleX = availW / logicalWidth;
            const scaleY = availH / logicalHeight;
            const fitScale = Math.min(scaleX, scaleY) * 0.94;
            setScale(fitScale);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(wrapperRef.current);
        return () => observer.disconnect();
    }, [logicalWidth, logicalHeight]);

    return (
        <div ref={wrapperRef} className="w-full h-full flex items-center justify-center p-4 pt-0">
            <div className="relative flex items-center justify-center"
                style={{ width: logicalWidth, height: logicalHeight, transform: `scale(${scale})`, transformOrigin: 'center center', flexShrink: 0 }}>
                <div className="absolute inset-0 bg-muted/30 shadow-2xl z-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-background/5 via-transparent to-background/5 opacity-40" />
                    {!page.isCover && page.type === 'spread' && (
                        <div className="absolute bottom-[-2px] left-1/2 -translate-x-1/2 w-[40px] h-[12px] opacity-50 z-60 pointer-events-none">
                            <div className="w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-black/45 via-black/25 to-transparent rounded-b-xs" />
                        </div>
                    )}
                </div>
                <div className="absolute z-0 bg-background border-x border-transparent shadow-md" style={{ width: '98%', height: '94.5%', top: '50.4%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                <div
                    className="relative w-[97%] h-[95%] shadow-lg z-10 overflow-hidden bg-background"
                    data-page-canvas-surface={page.id}
                >
                    <div className="absolute inset-0 z-50">
                        <AlbumCover
                            page={page}
                            config={config}
                            mode="editor"
                            activeView={activeView}
                            onUpdateTitleSettings={onUpdateTitleSettings}
                            onUpdatePage={onUpdatePage}
                            onDropPhoto={onDropPhoto}
                            onDynamicDropPhoto={onDynamicDropPhoto}
                            onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom}
                            onInteractionChange={onInteractionChange}
                            onRemovePhoto={onRemovePhoto}
                            onEnhancePhotoWithAi={onEnhancePhotoWithAi}
                            allPhotos={allPhotos}
                            previousPagePhotos={previousPagePhotos}
                            priority={priority}
                            chronologicalIndex={chronologicalIndex}
                            activeImageIds={dynamicMode ? activeDynamicImageIds : []}
                            onSelectImage={dynamicMode ? onSelectDynamicImage : undefined}
                            dynamicMode={dynamicMode}
                            disableFrameDrop={disableFrameDrop}
                            extraTemplates={extraTemplates}
                            lockOverlayImageAspectRatio={lockOverlayImageAspectRatio}
                        />
                        {!page.isCover && page.type === 'spread' && <SpineEffectOverlay />}
                    </div>
                    <div className="absolute inset-0 z-60 pointer-events-none">
                        {page.titleText && <DraggableTitle text={page.titleText} color={page.titleColor} fontSize={page.titleFontSize} fontFamily={page.titleFontFamily} position={page.titlePosition} containerId={`front-cover-container-${page.id}`} onUpdatePosition={(x, y) => onUpdateTitleSettings?.(page.id, { position: { x, y } })} />}
                    </div>
                </div>
                {(isLocked || templateName || requiredLabel) && (
                    <div className="pointer-events-none absolute left-0 -bottom-6 z-[70]">
                        <div className="inline-flex items-center gap-1.5">
                            {templateName && (
                                <div
                                    className="inline-flex items-center rounded-full border border-border/60 bg-background/82 px-2 py-0.5 text-[9px] font-medium text-foreground/90 shadow-sm backdrop-blur-sm whitespace-nowrap"
                                    title={templateName}
                                >
                                    {templateName}
                                </div>
                            )}
                            {requiredLabel && (
                                <div className="inline-flex items-center rounded-full border border-border/60 bg-background/82 px-2 py-0.5 text-[9px] font-medium text-foreground/90 shadow-sm backdrop-blur-sm whitespace-nowrap">
                                    {requiredLabel}
                                </div>
                            )}
                            {isLocked && (
                                <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/85 px-2 py-0.5 text-[9px] font-semibold text-foreground/90 shadow-sm backdrop-blur-sm whitespace-nowrap">
                                    <Lock className="h-2.5 w-2.5" />
                                    Locked
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <div className="absolute right-0 -bottom-6 z-[70] pointer-events-auto">
                    <div className="inline-flex items-center rounded-full border border-border/60 bg-background/82 px-2 py-0.5 text-[9px] font-medium text-foreground/90 shadow-sm backdrop-blur-sm whitespace-nowrap">
                        <button
                            type="button"
                            onClick={onToggleDynamicMode}
                            disabled={isLocked || !!dynamicModeDisabledReason}
                            title={dynamicModeDisabledReason || (dynamicMode ? 'Exit Dynamic Mode' : 'Enter Dynamic Mode')}
                            className={cn(
                                "inline-flex items-center gap-1 rounded-sm px-0.5 whitespace-nowrap transition-colors hover:bg-background/80",
                                dynamicMode && "text-primary",
                                (isLocked || !!dynamicModeDisabledReason) && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <Sparkles className="h-2.5 w-2.5" />
                            Dynamic
                        </button>
                        {dynamicMode && (
                            <>
                                <span className="mx-1 h-3 w-px bg-border/60" />
                                <button
                                    type="button"
                                    onClick={onOpenDynamicTemplateDialog}
                                    title="Save current dynamic result as template"
                                    className="inline-flex items-center gap-1 rounded-sm px-0.5 whitespace-nowrap transition-colors hover:bg-background/80"
                                >
                                    <LayoutTemplate className="h-2.5 w-2.5" />
                                    Save Template
                                </button>
                            </>
                        )}
                        {dynamicMode && selectedDynamicImage && (
                            <>
                                <span className="mx-1 h-3 w-px bg-border/60" />
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            title="Choose frame shape"
                                            className="inline-flex items-center gap-1 rounded-sm px-0.5 whitespace-nowrap transition-colors hover:bg-background/80"
                                        >
                                            <LayoutTemplate className="h-2.5 w-2.5" />
                                            Frame
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent side="top" align="end" className="w-[320px] p-2">
                                        <div className="mb-2 text-[11px] font-semibold text-foreground/90">
                                            Choose Canva Frame
                                        </div>
                                        <div className="max-h-[260px] overflow-y-auto pr-1">
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => onApplyCanvaFrameToSelectedDynamicImage?.(null)}
                                                    className={cn(
                                                        "aspect-square rounded-md border-2 p-1 transition-all",
                                                        selectedDynamicImage.frameShape !== 'path' && "border-primary bg-primary/5",
                                                        selectedDynamicImage.frameShape === 'path' && "border-muted hover:border-primary/40 bg-muted/30"
                                                    )}
                                                >
                                                    <div className="w-full h-full rounded-sm border border-border/60 bg-muted/40 flex items-center justify-center">
                                                        <div className="h-[58%] w-[58%] border-2 border-foreground/70" />
                                                    </div>
                                                </button>
                                                {canvaFramesLoading ? (
                                                    <div className="col-span-2 rounded-md border border-border/60 p-2 text-[10px] text-muted-foreground">
                                                        Loading Canva frames...
                                                    </div>
                                                ) : canvaFrames.map((frameTemplate) => (
                                                    (() => {
                                                        const firstRegion = frameTemplate.regions?.[0];
                                                        const pathD = firstRegion?.path || '';
                                                        const viewBox = firstRegion?.viewBox || '0 0 100 100';
                                                        const safeId = String(frameTemplate.id).replace(/[^a-zA-Z0-9_-]/g, '-');
                                                        const clipId = `dynamic-thumb-clip-${safeId}`;
                                                        const vb = viewBox.split(' ').map(Number);
                                                        const vbX = vb[0] || 0;
                                                        const vbY = vb[1] || 0;
                                                        const vbW = vb[2] || 100;
                                                        const vbH = vb[3] || 100;

                                                        return (
                                                            <button
                                                                key={`dynamic-frame-${frameTemplate.id}`}
                                                                type="button"
                                                                onClick={() => onApplyCanvaFrameToSelectedDynamicImage?.(frameTemplate)}
                                                                className={cn(
                                                                    "aspect-square rounded-md border-2 p-1 transition-all relative overflow-hidden",
                                                                    selectedDynamicImage.frameShape === 'path' &&
                                                                        selectedDynamicImage.frameTemplateId === String(frameTemplate.id)
                                                                        ? "border-primary bg-primary/5"
                                                                        : "border-muted hover:border-primary/40 bg-muted/30"
                                                                )}
                                                                title={frameTemplate.name}
                                                            >
                                                                <div className="w-full h-full relative overflow-hidden bg-muted rounded-sm">
                                                                    <svg viewBox={viewBox} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                                                                        <defs>
                                                                            <clipPath id={clipId}>
                                                                                <path d={pathD} />
                                                                            </clipPath>
                                                                            <linearGradient id={`thumbSky-${safeId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                                                <stop offset="0%" stopColor="#b8e4f9" />
                                                                                <stop offset="100%" stopColor="#e8f6fc" />
                                                                            </linearGradient>
                                                                            <linearGradient id={`thumbHill1-${safeId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                                                <stop offset="0%" stopColor="#9cd67e" />
                                                                                <stop offset="100%" stopColor="#7cc45a" />
                                                                            </linearGradient>
                                                                            <linearGradient id={`thumbHill2-${safeId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                                                <stop offset="0%" stopColor="#85c95c" />
                                                                                <stop offset="100%" stopColor="#6ab344" />
                                                                            </linearGradient>
                                                                        </defs>
                                                                        <g clipPath={`url(#${clipId})`}>
                                                                            <rect x={vbX} y={vbY} width={vbW} height={vbH} fill={`url(#thumbSky-${safeId})`} />
                                                                            <circle cx={vbX + vbW * 0.85} cy={vbY + vbH * 0.15} r={vbW * 0.08} fill="#fdf2a4" />
                                                                            <g fill="white" opacity="0.8">
                                                                                <circle cx={vbX + vbW * 0.2} cy={vbY + vbH * 0.2} r={vbW * 0.05} />
                                                                                <circle cx={vbX + vbW * 0.25} cy={vbY + vbH * 0.22} r={vbW * 0.06} />
                                                                                <circle cx={vbX + vbW * 0.3} cy={vbY + vbH * 0.2} r={vbW * 0.05} />
                                                                            </g>
                                                                            <path
                                                                                d={`M ${vbX - vbW * 0.1} ${vbY + vbH} Q ${vbX + vbW * 0.5} ${vbY + vbH * 0.4} ${vbX + vbW * 1.1} ${vbY + vbH} Z`}
                                                                                fill={`url(#thumbHill1-${safeId})`}
                                                                            />
                                                                            <path
                                                                                d={`M ${vbX - vbW * 0.2} ${vbY + vbH} Q ${vbX + vbW * 0.3} ${vbY + vbH * 0.6} ${vbX + vbW * 0.8} ${vbY + vbH * 1.1} Z`}
                                                                                fill={`url(#thumbHill2-${safeId})`}
                                                                            />
                                                                        </g>
                                                                    </svg>
                                                                </div>
                                                            </button>
                                                        );
                                                    })()
                                                ))}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <span className="mx-1 h-3 w-px bg-border/60" />
                                <button
                                    type="button"
                                    onClick={onToggleSelectedDynamicImageRotationMode}
                                    title={selectedDynamicImage.imageRotationMode === 'keep-horizontal'
                                        ? 'Switch to Follow Frame'
                                        : 'Switch to Keep Horizontal'}
                                    className="inline-flex items-center gap-1 rounded-sm px-0.5 whitespace-nowrap transition-colors hover:bg-background/80"
                                >
                                    <RotateCw className="h-2.5 w-2.5" />
                                    {selectedDynamicImage.imageRotationMode === 'keep-horizontal'
                                        ? 'Keep Horizontal'
                                        : 'Follow Frame'}
                                </button>
                            </>
                        )}
                        {dynamicMode && selectedDynamicImage && activeDynamicImageIds.length > 1 && (
                            <>
                                <span className="mx-1 h-3 w-px bg-border/60" />
                                <button
                                    type="button"
                                    onClick={() => onMatchSelectedDynamicFramesSize?.('both')}
                                    title="Match width and height to lead frame"
                                    className="inline-flex items-center justify-center rounded-sm p-0.5 transition-colors hover:bg-background/80"
                                >
                                    <Maximize2 className="h-2.5 w-2.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onMatchSelectedDynamicFramesSize?.('width')}
                                    title="Match width to lead frame"
                                    className="inline-flex items-center justify-center rounded-sm p-0.5 transition-colors hover:bg-background/80"
                                >
                                    <ArrowUpDown className="h-2.5 w-2.5 rotate-90" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onMatchSelectedDynamicFramesSize?.('height')}
                                    title="Match height to lead frame"
                                    className="inline-flex items-center justify-center rounded-sm p-0.5 transition-colors hover:bg-background/80"
                                >
                                    <ArrowUpDown className="h-2.5 w-2.5" />
                                </button>
                            </>
                        )}
                        {dynamicMode && selectedDynamicImage && (
                            <>
                                <span className="mx-1 h-3 w-px bg-border/60" />
                                <button
                                    type="button"
                                    onClick={() => onAlignSelectedDynamicFrames?.('left')}
                                    title="Align left"
                                    className="inline-flex items-center justify-center rounded-sm p-0.5 transition-colors hover:bg-background/80"
                                >
                                    <AlignStartVertical className="h-2.5 w-2.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onAlignSelectedDynamicFrames?.('right')}
                                    title="Align right"
                                    className="inline-flex items-center justify-center rounded-sm p-0.5 transition-colors hover:bg-background/80"
                                >
                                    <AlignEndVertical className="h-2.5 w-2.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onAlignSelectedDynamicFrames?.('top')}
                                    title="Align top"
                                    className="inline-flex items-center justify-center rounded-sm p-0.5 transition-colors hover:bg-background/80"
                                >
                                    <AlignStartHorizontal className="h-2.5 w-2.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onAlignSelectedDynamicFrames?.('bottom')}
                                    title="Align bottom"
                                    className="inline-flex items-center justify-center rounded-sm p-0.5 transition-colors hover:bg-background/80"
                                >
                                    <AlignEndHorizontal className="h-2.5 w-2.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onAlignSelectedDynamicFrames?.('center')}
                                    title="Align center"
                                    className="inline-flex items-center justify-center rounded-sm p-0.5 transition-colors hover:bg-background/80"
                                >
                                    <AlignCenter className="h-2.5 w-2.5" />
                                </button>
                            </>
                        )}
                        {dynamicMode && selectedDynamicImage && (
                            <span className="mx-1 h-3 w-px bg-border/60" />
                        )}
                        {dynamicMode && selectedDynamicImage && (
                            <button
                                type="button"
                                onClick={onDeleteSelectedDynamicImage}
                                title="Delete Selected Dynamic Frame"
                                className="inline-flex items-center gap-1 rounded-sm px-0.5 text-destructive whitespace-nowrap transition-colors hover:bg-destructive/10"
                            >
                                <Trash2 className="h-2.5 w-2.5" />
                                Delete Frame
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

// --- MAIN EXPORTED COMPONENT ---

interface PageCanvasProps {
    page: AlbumPage;
    pageIndex: number; // Renamed from index for clarity
    config: AlbumConfig;
    allPhotos: Photo[];
    onDeletePage: (pageId: string) => void;
    onAddSpread?: (afterIndex: number) => void;
    onUpdateLayout: (pageId: string, newLayout: string) => void;
    onUpdateCoverLayout?: (pageId: string, side: 'front' | 'back' | 'full', newLayout: string) => void;
    onUpdateSpreadLayout?: (pageId: string, side: 'left' | 'right', newLayout: string) => void;
    onUpdateCoverType?: (pageId: string, newType: 'split' | 'full') => void;
    onUpdatePage?: (page: AlbumPage) => void;
    onUpdateSpineText?: (pageId: string, text: string) => void;
    onUpdateSpineSettings?: (pageId: string, settings: any) => void; // Details omitted for brevity matches AlbumEditor
    onUpdateTitleSettings?: (pageId: string, settings: any) => void;
    onUpdatePhotoPanAndZoom: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
    onDropPhoto: (pageId: string, targetPhotoId: string, droppedPhotoId: string, sourceInfo?: { pageId: string; photoId: string }) => void;
    onDownloadPage: (pageId: string, options?: ExportRenderOptions) => void;
    onRemovePhoto: (pageId: string, photoId: string) => void;
    onOpenEditor?: (pageId: string) => void;
    onEnhanceWithAi?: (pageId: string) => void;
    onEnhancePhotoWithAi?: (pageId: string, photoId: string, photo: Photo) => void;
    onUndo?: (pageId: string) => void;
    onRedo?: (pageId: string) => void;
    onToggleLock?: (pageId: string) => void;
    onMovePage?: (pageId: string, direction: 'up' | 'down') => void;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    customTemplates?: AdvancedTemplate[];
    onCreateCustomTemplate?: (template: AdvancedTemplate) => void;
    defaultViewMode?: 'single' | 'spread';
    visibleTemplateCategories?: string[];
    allowedTemplateIds?: string[];
    priority?: boolean;
    chronologicalIndex?: Record<string, number>;
}

export const PageCanvas = React.memo(({
    page,
    pageIndex,
    config,
    onDeletePage,
    onAddSpread,
    onUpdateLayout,
    onUpdateCoverLayout,
    onUpdateSpreadLayout,
    onUpdateCoverType,
    onUpdatePage,
    onUpdateSpineText,
    onUpdateSpineSettings,
    onUpdateTitleSettings,
    onUpdatePhotoPanAndZoom,
    onDropPhoto,
    onDownloadPage,
    onRemovePhoto,
    onOpenEditor,
    onEnhanceWithAi,
    onEnhancePhotoWithAi,
    onUndo,
    onRedo,
    onToggleLock,
    onMovePage,
    canMoveUp = false,
    canMoveDown = false,
    allPhotos,
    customTemplates = [],
    onCreateCustomTemplate,
    defaultViewMode = 'spread',
    visibleTemplateCategories,
    allowedTemplateIds,
    previousPagePhotos = [],
    displayLabel: externalDisplayLabel,
    priority = false, // Default to false
    chronologicalIndex,
}: PageCanvasProps & { previousPagePhotos?: Photo[]; displayLabel?: string }) => {
    const { gridTemplates, coverTemplates, advancedTemplates, findTemplate, findCoverTemplate, defaultGridTemplate, defaultCoverTemplate } = useTemplates();
    const { frames: canvaFrames, loading: canvaFramesLoading } = useCanvaFrames();
    const { previewPhotoGap, previewPageMargin, previewCornerRadius } = useAlbumEditor();
    const { toast } = useToast();
    const [isInteracting, setIsInteracting] = useState(false);

    const filterTemplates = (templates: AdvancedTemplate[], category: 'grid' | 'cover' | 'advanced') => {
        if (visibleTemplateCategories && !visibleTemplateCategories.includes(category)) return [];
        if (allowedTemplateIds && allowedTemplateIds.length > 0) return templates.filter(t => allowedTemplateIds.includes(String(t.id)));
        return templates;
    };

    const filteredGridTemplates = filterTemplates(gridTemplates, 'grid');
    const filteredCoverTemplates = filterTemplates(coverTemplates, 'cover');
    const filteredAdvancedTemplates = filterTemplates(advancedTemplates, 'advanced');

    const mergeTemplatesById = useCallback((...templateLists: AdvancedTemplate[][]) => {
        const map = new Map<string, AdvancedTemplate>();
        templateLists.forEach((templates) => {
            templates.forEach((template) => {
                map.set(String(template.id), template);
            });
        });
        return Array.from(map.values());
    }, []);

    const nonCoverTemplatesWithCustom = useMemo(() => {
        return mergeTemplatesById(filteredGridTemplates, filteredAdvancedTemplates, customTemplates);
    }, [customTemplates, filteredAdvancedTemplates, filteredGridTemplates, mergeTemplatesById]);

    const coverTemplatesWithCustom = useMemo(() => {
        return mergeTemplatesById(filteredCoverTemplates, filteredAdvancedTemplates, customTemplates);
    }, [customTemplates, filteredAdvancedTemplates, filteredCoverTemplates, mergeTemplatesById]);
    const isPageLocked = !!page.isLocked;

    const [isDynamicMode, setIsDynamicMode] = useState(false);
    const [isDynamicExitDialogOpen, setIsDynamicExitDialogOpen] = useState(false);
    const [dynamicTemplateName, setDynamicTemplateName] = useState('');
    const [activeDynamicImageIds, setActiveDynamicImageIds] = useState<string[]>([]);
    const dynamicTemplateLabelSeed = externalDisplayLabel || (page.isCover ? 'Cover' : `Page ${pageIndex + 1}`);

    const dynamicModeUnsupportedReason = useMemo(() => {
        if (!onUpdatePage) return 'Dynamic mode requires editable page state.';
        if (page.isCover) {
            if (page.coverType === 'split' || !page.coverType) {
                return 'Switch this cover to Full mode before using Dynamic mode.';
            }
        } else if (page.type === 'spread' && page.spreadMode === 'split') {
            return 'Switch this spread to Full mode before using Dynamic mode.';
        }
        return null;
    }, [onUpdatePage, page.isCover, page.coverType, page.spreadMode, page.type]);

    useEffect(() => {
        setIsDynamicMode(false);
        setIsDynamicExitDialogOpen(false);
        setDynamicTemplateName('');
        setActiveDynamicImageIds([]);
    }, [page.id]);

    useEffect(() => {
        if (!isDynamicMode) return;
        if (!dynamicModeUnsupportedReason) return;
        setIsDynamicMode(false);
        setIsDynamicExitDialogOpen(false);
    }, [dynamicModeUnsupportedReason, isDynamicMode]);

    useEffect(() => {
        const validIds = new Set((page.coverImages || []).map((image) => image.id));
        setActiveDynamicImageIds((prev) => prev.filter((id) => validIds.has(id)));
    }, [page.coverImages]);

    const selectedDynamicImage = useMemo(() => {
        if (!page.coverImages || activeDynamicImageIds.length === 0) return null;
        return page.coverImages.find((image) => image.id === activeDynamicImageIds[0]) || null;
    }, [activeDynamicImageIds, page.coverImages]);

    const findTemplateIncludingCustom = useCallback((templateId: string | number | null | undefined) => {
        if (templateId == null) return undefined;
        const { baseId } = parseLayoutId(templateId);
        return customTemplates.find((template) => String(template.id) === String(baseId))
            || findTemplate(baseId)
            || findCoverTemplate(baseId);
    }, [customTemplates, findCoverTemplate, findTemplate]);

    const updateDynamicImages = useCallback((updater: (images: CoverImage[]) => CoverImage[]) => {
        if (!onUpdatePage) return;
        const currentImages = page.coverImages || [];
        const nextImages = updater(currentImages);
        onUpdatePage({
            ...page,
            coverImages: nextImages
        });
    }, [onUpdatePage, page]);

    const clampFrameSizeAndCenter = useCallback((image: CoverImage, targetWidth: number, targetHeight: number) => {
        const width = Math.max(2, Math.min(100, targetWidth));
        const height = Math.max(2, Math.min(100, targetHeight));
        const halfW = width / 2;
        const halfH = height / 2;
        const x = Math.max(halfW, Math.min(100 - halfW, image.x));
        const y = Math.max(halfH, Math.min(100 - halfH, image.y));
        return { width, height, x, y };
    }, []);

    const getFrameGeometry = useCallback((image: CoverImage) => {
        const width = Math.max(2, Math.min(100, image.width));
        const height = Math.max(
            2,
            Math.min(100, image.height ?? (image.width / Math.max(image.aspectRatio || 1, 0.01)))
        );
        const halfW = width / 2;
        const halfH = height / 2;
        const left = image.x - halfW;
        const right = image.x + halfW;
        const top = image.y - halfH;
        const bottom = image.y + halfH;
        return { width, height, halfW, halfH, left, right, top, bottom };
    }, []);

    const clampFrameCenterToPage = useCallback((x: number, y: number, width: number, height: number) => {
        const halfW = width / 2;
        const halfH = height / 2;
        return {
            x: Math.max(halfW, Math.min(100 - halfW, x)),
            y: Math.max(halfH, Math.min(100 - halfH, y))
        };
    }, []);

    const handleSelectDynamicImage = useCallback((target: string | string[] | null, isMulti?: boolean) => {
        const targetIds = Array.isArray(target) ? target : (target ? [target] : []);
        if (targetIds.length === 0) {
            if (!isMulti) setActiveDynamicImageIds([]);
            return;
        }

        if (isMulti) {
            setActiveDynamicImageIds((prev) => {
                const next = [...prev];
                targetIds.forEach((id) => {
                    const idx = next.indexOf(id);
                    if (idx >= 0) {
                        next.splice(idx, 1);
                    } else {
                        next.push(id);
                    }
                });
                return next;
            });
            return;
        }

        const clickedId = targetIds[0];
        setActiveDynamicImageIds((prev) => {
            if (targetIds.length === 1 && prev.length > 1 && prev.includes(clickedId)) {
                return [clickedId, ...prev.filter((id) => id !== clickedId)];
            }
            return targetIds;
        });
    }, []);

    const resolveDroppedPhotoAspectRatio = useCallback(async (photo: Photo, sourceUrl: string) => {
        if (photo.width && photo.height && photo.width > 0 && photo.height > 0) {
            return photo.width / photo.height;
        }

        if (typeof window === 'undefined') {
            return 1;
        }

        const measured = await new Promise<number>((resolve) => {
            const probe = new window.Image();
            probe.onload = () => {
                if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
                    resolve(probe.naturalWidth / probe.naturalHeight);
                    return;
                }
                resolve(1);
            };
            probe.onerror = () => resolve(1);
            probe.src = sourceUrl;
        });

        return measured > 0 ? measured : 1;
    }, []);

    const handleAddDynamicImageFromDrop = useCallback(async (
        droppedPhotoId: string,
        payload: { x: number; y: number; containerAspectRatio: number }
    ) => {
        const droppedPhoto = allPhotos.find((photo) => photo.id === droppedPhotoId);
        if (!droppedPhoto) return;
        if (!onUpdatePage) return;

        const sourceUrl = droppedPhoto.remoteUrl || droppedPhoto.src;
        if (!sourceUrl) return;

        const safeAspectRatio = await resolveDroppedPhotoAspectRatio(droppedPhoto, sourceUrl);
        const containerAspectRatio = payload.containerAspectRatio > 0 ? payload.containerAspectRatio : 1;
        const computeHeightFromWidth = (frameWidth: number) => {
            return frameWidth * (containerAspectRatio / safeAspectRatio);
        };

        let width = 24;
        let height = computeHeightFromWidth(width);

        if (height > 38) {
            height = 38;
            width = height * (safeAspectRatio / containerAspectRatio);
        }
        if (width > 48) {
            width = 48;
            height = computeHeightFromWidth(width);
        }
        if (width < 8) {
            width = 8;
            height = computeHeightFromWidth(width);
        }
        if (height < 8) {
            height = 8;
            width = height * (safeAspectRatio / containerAspectRatio);
        }

        const currentImages = page.coverImages || [];
        const highestZ = currentImages.reduce((max, item) => Math.max(max, item.zIndex || 40), 40);
        const newImage: CoverImage = {
            id: crypto.randomUUID(),
            url: sourceUrl,
            x: Math.max(0, Math.min(100, payload.x)),
            y: Math.max(0, Math.min(100, payload.y)),
            width,
            height,
            aspectRatio: safeAspectRatio,
            panAndZoom: { scale: 1, x: 50, y: 50 },
            rotation: 0,
            opacity: 1,
            zIndex: highestZ + 1,
            imageRotationMode: 'follow-frame',
            frameShape: 'rect'
        };

        onUpdatePage({
            ...page,
            coverImages: [...currentImages, newImage]
        });
        setActiveDynamicImageIds([newImage.id]);
    }, [allPhotos, onUpdatePage, page, resolveDroppedPhotoAspectRatio]);

    const handleDeleteSelectedDynamicImage = useCallback(() => {
        const selectedId = activeDynamicImageIds[0];
        if (!selectedId) return;
        updateDynamicImages((images) => images.filter((image) => image.id !== selectedId));
        setActiveDynamicImageIds([]);
    }, [activeDynamicImageIds, updateDynamicImages]);

    const handleToggleSelectedDynamicImageRotationMode = useCallback(() => {
        const selectedId = activeDynamicImageIds[0];
        if (!selectedId) return;
        updateDynamicImages((images) => images.map((image) => {
            if (image.id !== selectedId) return image;
            const currentMode = image.imageRotationMode === 'keep-horizontal' ? 'keep-horizontal' : 'follow-frame';
            return {
                ...image,
                imageRotationMode: currentMode === 'keep-horizontal' ? 'follow-frame' : 'keep-horizontal'
            };
        }));
    }, [activeDynamicImageIds, updateDynamicImages]);

    const handleApplyCanvaFrameToSelectedDynamicImage = useCallback((frameTemplate: AdvancedTemplate | null) => {
        const selectedId = activeDynamicImageIds[0];
        if (!selectedId) return;

        updateDynamicImages((images) => images.map((image) => {
            if (image.id !== selectedId) return image;

            if (!frameTemplate) {
                return {
                    ...image,
                    frameShape: 'rect',
                    framePath: undefined,
                    frameViewBox: undefined,
                    frameTemplateId: undefined,
                    frameName: undefined
                };
            }

            const frameRegion = frameTemplate.regions?.find((region) => region.shape === 'path' && !!region.path);
            if (!frameRegion?.path) {
                return {
                    ...image,
                    frameShape: 'rect',
                    framePath: undefined,
                    frameViewBox: undefined,
                    frameTemplateId: undefined,
                    frameName: undefined
                };
            }

            return {
                ...image,
                frameShape: 'path',
                framePath: frameRegion.path,
                frameViewBox: frameRegion.viewBox || '0 0 100 100',
                frameTemplateId: String(frameTemplate.id),
                frameName: frameTemplate.name
            };
        }));
    }, [activeDynamicImageIds, updateDynamicImages]);

    const handleMatchSelectedDynamicFramesSize = useCallback((mode: 'both' | 'width' | 'height') => {
        if (activeDynamicImageIds.length < 2) return;
        const leadId = activeDynamicImageIds[0];
        if (!leadId) return;

        updateDynamicImages((images) => {
            const leadImage = images.find((image) => image.id === leadId);
            if (!leadImage) return images;

            const leadWidth = Math.max(2, Math.min(100, leadImage.width));
            const leadHeight = Math.max(
                2,
                Math.min(100, leadImage.height ?? (leadImage.width / Math.max(leadImage.aspectRatio || 1, 0.01)))
            );
            const selectedSet = new Set(activeDynamicImageIds);

            return images.map((image) => {
                if (!selectedSet.has(image.id) || image.id === leadId) return image;

                const currentHeight = image.height ?? (image.width / Math.max(image.aspectRatio || 1, 0.01));
                const targetWidth = mode === 'height' ? image.width : leadWidth;
                const targetHeight = mode === 'width' ? currentHeight : leadHeight;
                const clamped = clampFrameSizeAndCenter(image, targetWidth, targetHeight);

                return {
                    ...image,
                    width: clamped.width,
                    height: clamped.height,
                    x: clamped.x,
                    y: clamped.y
                };
            });
        });
    }, [activeDynamicImageIds, clampFrameSizeAndCenter, updateDynamicImages]);

    const handleAlignSelectedDynamicFrames = useCallback((mode: 'left' | 'right' | 'top' | 'bottom' | 'center') => {
        if (activeDynamicImageIds.length === 0) return;

        updateDynamicImages((images) => {
            const selectedSet = new Set(activeDynamicImageIds);
            const selectedImages = images.filter((image) => selectedSet.has(image.id));
            if (selectedImages.length === 0) return images;

            if (selectedImages.length === 1) {
                const selectedId = selectedImages[0].id;
                return images.map((image) => {
                    if (image.id !== selectedId) return image;
                    const geometry = getFrameGeometry(image);
                    let x = image.x;
                    let y = image.y;
                    switch (mode) {
                        case 'left':
                            x = geometry.halfW;
                            break;
                        case 'right':
                            x = 100 - geometry.halfW;
                            break;
                        case 'top':
                            y = geometry.halfH;
                            break;
                        case 'bottom':
                            y = 100 - geometry.halfH;
                            break;
                        case 'center':
                            x = 50;
                            y = 50;
                            break;
                    }
                    const clamped = clampFrameCenterToPage(x, y, geometry.width, geometry.height);
                    return {
                        ...image,
                        x: clamped.x,
                        y: clamped.y
                    };
                });
            }

            const leadId = activeDynamicImageIds[0];
            const leadImage = leadId ? images.find((image) => image.id === leadId) : null;
            if (!leadImage) return images;
            const leadGeometry = getFrameGeometry(leadImage);

            return images.map((image) => {
                if (!selectedSet.has(image.id) || image.id === leadId) return image;

                const geometry = getFrameGeometry(image);
                let x = image.x;
                let y = image.y;

                switch (mode) {
                    case 'left':
                        x = leadGeometry.left + geometry.halfW;
                        break;
                    case 'right':
                        x = leadGeometry.right - geometry.halfW;
                        break;
                    case 'top':
                        y = leadGeometry.top + geometry.halfH;
                        break;
                    case 'bottom':
                        y = leadGeometry.bottom - geometry.halfH;
                        break;
                    case 'center':
                        x = leadImage.x;
                        y = leadImage.y;
                        break;
                }

                const clamped = clampFrameCenterToPage(x, y, geometry.width, geometry.height);
                return {
                    ...image,
                    x: clamped.x,
                    y: clamped.y
                };
            });
        });
    }, [activeDynamicImageIds, clampFrameCenterToPage, getFrameGeometry, updateDynamicImages]);

    const handleMoveSelectedDynamicFrames = useCallback((deltaX: number, deltaY: number) => {
        if (activeDynamicImageIds.length === 0) return;

        updateDynamicImages((images) => {
            const selectedSet = new Set(activeDynamicImageIds);
            const selectedImages = images.filter((image) => selectedSet.has(image.id));
            if (selectedImages.length === 0) return images;

            const minAllowedDx = selectedImages.reduce((lowerBound, image) => {
                const geometry = getFrameGeometry(image);
                return Math.max(lowerBound, -geometry.left);
            }, Number.NEGATIVE_INFINITY);
            const maxAllowedDx = selectedImages.reduce((upperBound, image) => {
                const geometry = getFrameGeometry(image);
                return Math.min(upperBound, 100 - geometry.right);
            }, Number.POSITIVE_INFINITY);
            const minAllowedDy = selectedImages.reduce((lowerBound, image) => {
                const geometry = getFrameGeometry(image);
                return Math.max(lowerBound, -geometry.top);
            }, Number.NEGATIVE_INFINITY);
            const maxAllowedDy = selectedImages.reduce((upperBound, image) => {
                const geometry = getFrameGeometry(image);
                return Math.min(upperBound, 100 - geometry.bottom);
            }, Number.POSITIVE_INFINITY);

            const appliedDx = Number.isFinite(deltaX)
                ? Math.min(maxAllowedDx, Math.max(minAllowedDx, deltaX))
                : 0;
            const appliedDy = Number.isFinite(deltaY)
                ? Math.min(maxAllowedDy, Math.max(minAllowedDy, deltaY))
                : 0;

            if (Math.abs(appliedDx) < 0.0001 && Math.abs(appliedDy) < 0.0001) {
                return images;
            }

            return images.map((image) => {
                if (!selectedSet.has(image.id)) return image;
                return {
                    ...image,
                    x: image.x + appliedDx,
                    y: image.y + appliedDy
                };
            });
        });
    }, [activeDynamicImageIds, getFrameGeometry, updateDynamicImages]);

    const resolveDynamicKeyboardNudgeStep = useCallback(() => {
        if (typeof document === 'undefined') {
            return { x: 0.1, y: 0.1 };
        }

        const surface = document.querySelector<HTMLElement>(`[data-page-canvas-surface="${page.id}"]`);
        if (!surface) {
            return { x: 0.1, y: 0.1 };
        }

        const rect = surface.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return { x: 0.1, y: 0.1 };
        }

        return {
            x: 100 / rect.width,
            y: 100 / rect.height
        };
    }, [page.id]);

    useEffect(() => {
        if (!isDynamicMode) return;
        if (isPageLocked) return;
        if (activeDynamicImageIds.length === 0) return;

        const handleDynamicArrowNudge = (event: KeyboardEvent) => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                return;
            }

            const activeElement = document.activeElement as HTMLElement | null;
            if (activeElement) {
                const tagName = activeElement.tagName;
                if (tagName === 'INPUT' || tagName === 'TEXTAREA' || activeElement.isContentEditable) {
                    return;
                }
            }

            event.preventDefault();
            const step = resolveDynamicKeyboardNudgeStep();

            if (event.key === 'ArrowLeft') handleMoveSelectedDynamicFrames(-step.x, 0);
            if (event.key === 'ArrowRight') handleMoveSelectedDynamicFrames(step.x, 0);
            if (event.key === 'ArrowUp') handleMoveSelectedDynamicFrames(0, -step.y);
            if (event.key === 'ArrowDown') handleMoveSelectedDynamicFrames(0, step.y);
        };

        window.addEventListener('keydown', handleDynamicArrowNudge);
        return () => window.removeEventListener('keydown', handleDynamicArrowNudge);
    }, [activeDynamicImageIds.length, handleMoveSelectedDynamicFrames, isDynamicMode, isPageLocked, resolveDynamicKeyboardNudgeStep]);

    const handleToggleDynamicMode = useCallback(() => {
        if (isPageLocked || dynamicModeUnsupportedReason) return;
        if (isDynamicMode) {
            setIsDynamicMode(false);
            setIsDynamicExitDialogOpen(false);
            setActiveDynamicImageIds([]);
            return;
        }
        setIsDynamicMode(true);
        if (!dynamicTemplateName.trim()) {
            setDynamicTemplateName(`${dynamicTemplateLabelSeed} Dynamic Template`);
        }
    }, [dynamicModeUnsupportedReason, dynamicTemplateLabelSeed, dynamicTemplateName, isDynamicMode, isPageLocked]);

    const handleOpenDynamicTemplateDialog = useCallback(() => {
        if (!isDynamicMode) return;
        if (!dynamicTemplateName.trim()) {
            setDynamicTemplateName(`${dynamicTemplateLabelSeed} Dynamic Template`);
        }
        setIsDynamicExitDialogOpen(true);
    }, [dynamicTemplateLabelSeed, dynamicTemplateName, isDynamicMode]);

    const handleCancelDynamicExit = useCallback(() => {
        setIsDynamicExitDialogOpen(false);
    }, []);

    const handleSaveDynamicTemplate = useCallback(() => {
        if (!onCreateCustomTemplate) {
            toast({
                title: 'Template save is unavailable',
                description: 'No custom template handler is configured.',
                variant: 'destructive'
            });
            return;
        }

        const templateName = dynamicTemplateName.trim();
        if (!templateName) {
            toast({
                title: 'Template name is required',
                description: 'Please enter a name before saving.',
                variant: 'destructive'
            });
            return;
        }

        const defaultLayoutId = page.isCover ? defaultCoverTemplate?.id : defaultGridTemplate?.id;
        const currentLayoutId = page.layout || defaultLayoutId || '';
        const baseTemplate = findTemplateIncludingCustom(currentLayoutId);
        if (!baseTemplate) {
            toast({
                title: 'Cannot save dynamic template',
                description: 'The base template was not found.',
                variant: 'destructive'
            });
            return;
        }

        const cloneRegion = (region: LayoutRegion): LayoutRegion => ({
            ...region,
            bounds: { ...region.bounds },
            radius: region.radius ? { ...region.radius } : undefined,
            points: region.points?.map((point) => [point[0], point[1]] as [number, number])
        });

        const baseRegions = (baseTemplate.regions || []).map(cloneRegion);
        const maxBaseZ = baseRegions.reduce((max, region, idx) => Math.max(max, region.zIndex ?? idx), 0);
        const dynamicRegions: LayoutRegion[] = (page.coverImages || []).map((image, index) => {
            const imageHeight = image.height ?? (image.width / Math.max(image.aspectRatio || 1, 0.01));
            const width = Math.max(2, Math.min(100, image.width));
            const height = Math.max(2, Math.min(100, imageHeight));
            const x = Math.max(0, Math.min(100 - width, image.x - (width / 2)));
            const y = Math.max(0, Math.min(100 - height, image.y - (height / 2)));
            const imageRotationMode = image.imageRotationMode === 'keep-horizontal'
                ? 'keep-horizontal'
                : 'follow-frame';
            const hasCanvaPathFrame = image.frameShape === 'path' && typeof image.framePath === 'string' && image.framePath.trim().length > 0;

            if (hasCanvaPathFrame) {
                return {
                    id: `dynamic-${image.id}`,
                    shape: 'path',
                    path: image.framePath,
                    viewBox: image.frameViewBox || '0 0 100 100',
                    bounds: { x, y, width, height },
                    rotation: image.rotation || 0,
                    imageRotationMode,
                    zIndex: (image.zIndex ?? maxBaseZ + index + 1),
                    label: image.frameName ? `Dynamic Frame: ${image.frameName}` : `Dynamic Frame ${index + 1}`
                };
            }

            return {
                id: `dynamic-${image.id}`,
                shape: 'rect',
                bounds: { x, y, width, height },
                rotation: image.rotation || 0,
                imageRotationMode,
                zIndex: (image.zIndex ?? maxBaseZ + index + 1),
                label: `Dynamic Frame ${index + 1}`
            };
        });

        const allRegions = [...baseRegions, ...dynamicRegions];
        if (allRegions.length === 0) {
            toast({
                title: 'Nothing to save',
                description: 'No regions were found for this result.',
                variant: 'destructive'
            });
            return;
        }

        const templateId = `dynamic-custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const type: AdvancedTemplate['type'] = page.type === 'spread' ? 'spread' : 'single';

        const newTemplate: AdvancedTemplate = {
            ...baseTemplate,
            id: templateId,
            name: templateName,
            category: 'custom',
            type,
            isCustom: true,
            createdBy: null,
            photoCount: allRegions.length,
            regions: allRegions
        };

        onCreateCustomTemplate(newTemplate);
        toast({
            title: 'Dynamic template saved',
            description: `"${templateName}" is now available in the template picker.`
        });

        setIsDynamicExitDialogOpen(false);
    }, [
        defaultCoverTemplate?.id,
        defaultGridTemplate?.id,
        dynamicTemplateName,
        findTemplateIncludingCustom,
        onCreateCustomTemplate,
        page.coverImages,
        page.isCover,
        page.layout,
        page.type,
        toast
    ]);

    const cycleLayoutByPhotoCount = useCallback((targetPhotoCount: number) => {
        const templatesWithCount = (page.isCover ? coverTemplatesWithCustom : nonCoverTemplatesWithCustom)
            .filter(t => getPhotoCount(t) === targetPhotoCount);

        if (templatesWithCount.length === 0) return;

        const { baseId } = parseLayoutId(page.layout || (page.isCover ? defaultCoverTemplate?.id : defaultGridTemplate?.id) || '');
        const currentIndex = templatesWithCount.findIndex(t => String(t.id) === String(baseId));
        const nextIndex = (currentIndex + 1) % templatesWithCount.length;
        const nextTemplate = templatesWithCount[nextIndex];

        const { rotation } = parseLayoutId(page.layout || (page.isCover ? defaultCoverTemplate?.id : defaultGridTemplate?.id) || '');
        const finalId = rotation === 0 ? nextTemplate.id : `${nextTemplate.id}_r${rotation}`;

        if (page.isCover) onUpdateCoverLayout?.(page.id, 'full', String(finalId));
        else onUpdateLayout(page.id, String(finalId));
    }, [coverTemplatesWithCustom, nonCoverTemplatesWithCustom, page, onUpdateCoverLayout, onUpdateLayout]);

    // Calculate info for label
    const displayLabel = useMemo(() => {
        if (externalDisplayLabel) return externalDisplayLabel;

        // Simplified label logic based on index and type
        if (page.isCover) return "Cover";
        // Fallback if no external label provided
        if (page.type === 'spread') return `Page ${pageIndex + 1} (Spread)`;
        return `Page ${pageIndex + 1}`;
    }, [page, pageIndex, externalDisplayLabel]);

    const resolveLayoutRequiredPhotoCount = useCallback((
        layoutId: string | number | null | undefined,
        fallbackId: string | number | undefined,
        preferCoverTemplate = false
    ) => {
        const { baseId } = parseLayoutId(layoutId || fallbackId || '');
        const normalizedId = String(baseId || '');
        const templatePool = preferCoverTemplate
            ? coverTemplatesWithCustom
            : nonCoverTemplatesWithCustom;

        const matchedTemplate = templatePool.find((t) => String(t.id) === normalizedId)
            || findTemplateIncludingCustom(baseId);

        const fallbackTemplate = templatePool[0] || (preferCoverTemplate ? defaultCoverTemplate : defaultGridTemplate);
        const resolvedTemplate = matchedTemplate || fallbackTemplate;

        if (normalizedId.startsWith('dynamic-justified')) {
            return Math.max(1, page.photos?.length || 0);
        }

        return Math.max(1, resolvedTemplate ? getPhotoCount(resolvedTemplate) : (page.photos?.length || 0));
    }, [
        coverTemplatesWithCustom,
        defaultCoverTemplate,
        defaultGridTemplate,
        findTemplateIncludingCustom,
        nonCoverTemplatesWithCustom
    ]);

    const resolveTemplateName = useCallback((
        layoutId: string | number | null | undefined,
        fallbackId: string | number | undefined,
        preferCoverTemplate = false
    ) => {
        const { baseId } = parseLayoutId(layoutId || fallbackId || '');
        const normalizedId = String(baseId || '');
        const templatePool = preferCoverTemplate
            ? coverTemplatesWithCustom
            : nonCoverTemplatesWithCustom;

        const matchedTemplate = templatePool.find((t) => String(t.id) === normalizedId)
            || findTemplateIncludingCustom(baseId);

        // Match PageLayout fallback behavior when layout ID is missing from source.
        const fallbackTemplate = templatePool[0] || (preferCoverTemplate ? defaultCoverTemplate : defaultGridTemplate);
        const resolvedTemplate = matchedTemplate || fallbackTemplate;

        const name = matchedTemplate?.name || resolvedTemplate?.name || String(baseId || 'Template');
        return `${name} (ID: ${String(baseId)})`;
    }, [
        coverTemplatesWithCustom,
        defaultCoverTemplate,
        defaultGridTemplate,
        findTemplateIncludingCustom,
        nonCoverTemplatesWithCustom
    ]);

    const currentRequiredCount = useMemo(() => {
        const defaultGridId = defaultGridTemplate?.id;
        const defaultCoverId = defaultCoverTemplate?.id;

        if (page.isCover) {
            const isCoverSplit = page.coverType === 'split' || !page.coverType;
            if (isCoverSplit) {
                return resolveLayoutRequiredPhotoCount(page.coverLayouts?.back, defaultCoverId, true)
                    + resolveLayoutRequiredPhotoCount(page.coverLayouts?.front, defaultCoverId, true);
            }
            return resolveLayoutRequiredPhotoCount(page.layout, defaultCoverId, true);
        }

        if (page.type === 'spread') {
            if (page.spreadMode === 'split') {
                return resolveLayoutRequiredPhotoCount(page.spreadLayouts?.left, defaultGridId, false)
                    + resolveLayoutRequiredPhotoCount(page.spreadLayouts?.right, defaultGridId, false);
            }
            return resolveLayoutRequiredPhotoCount(page.layout, defaultGridId, false);
        }

        return resolveLayoutRequiredPhotoCount(page.layout, defaultGridId, false);
    }, [
        defaultCoverTemplate?.id,
        defaultGridTemplate?.id,
        page.coverLayouts?.back,
        page.coverLayouts?.front,
        page.coverType,
        page.isCover,
        page.layout,
        page.spreadLayouts?.left,
        page.spreadLayouts?.right,
        page.spreadMode,
        page.type,
        resolveLayoutRequiredPhotoCount
    ]);

    const currentRequiredLabel = useMemo(() => {
        return `Required: ${currentRequiredCount} photo${currentRequiredCount === 1 ? '' : 's'}`;
    }, [currentRequiredCount]);

    const currentTemplateName = useMemo(() => {
        const defaultGridId = defaultGridTemplate?.id;
        const defaultCoverId = defaultCoverTemplate?.id;

        if (page.isCover) {
            const isCoverSplit = page.coverType === 'split' || !page.coverType;
            if (isCoverSplit) {
                const backName = resolveTemplateName(page.coverLayouts?.back, defaultCoverId, true);
                const frontName = resolveTemplateName(page.coverLayouts?.front, defaultCoverId, true);
                return `Back: ${backName} | Front: ${frontName}`;
            }
            return resolveTemplateName(page.layout, defaultCoverId, true);
        }

        if (page.type === 'spread') {
            if (page.spreadMode === 'split') {
                const leftName = resolveTemplateName(page.spreadLayouts?.left, defaultGridId);
                const rightName = resolveTemplateName(page.spreadLayouts?.right, defaultGridId);
                return `Page 1: ${leftName} | Page 2: ${rightName}`;
            }
            return resolveTemplateName(page.layout, defaultGridId);
        }

        return resolveTemplateName(page.layout, defaultGridId);
    }, [
        page.isCover,
        page.coverType,
        page.coverLayouts?.back,
        page.coverLayouts?.front,
        page.spreadMode,
        page.spreadLayouts?.left,
        page.spreadLayouts?.right,
        page.type,
        page.layout,
        defaultGridTemplate?.id,
        defaultCoverTemplate?.id,
        resolveTemplateName
    ]);

    if (!config) {
        logger.error('Missing config for page:', page.id);
        return <div className="p-4 text-red-500">Missing Configuration</div>;
    }

    const hasPreviewOverrides = previewPhotoGap !== null || previewPageMargin !== null || previewCornerRadius !== null;
    const effectiveConfig: AlbumConfig = hasPreviewOverrides
        ? {
            ...config,
            photoGap: (previewPhotoGap !== null && previewPhotoGap !== undefined) ? previewPhotoGap : (config.photoGap ?? 0),
            pageMargin: (previewPageMargin !== null && previewPageMargin !== undefined) ? previewPageMargin : (config.pageMargin ?? 0),
            cornerRadius: (previewCornerRadius !== null && previewCornerRadius !== undefined) ? previewCornerRadius : (config.cornerRadius ?? 0),
        }
        : config;

    return (
        <div className="w-full relative group/page text-left">


            <div className={cn("px-8 pt-1", 'w-full')}>
                <PageToolbar
                    page={page}
                    pageNumber={pageIndex + 1}
                    displayLabel={displayLabel}
                    canDelete={!page.isCover && page.type !== 'single'}
                    onDeletePage={() => onDeletePage(page.id)}
                    onUpdateLayout={onUpdateLayout}
                    onUpdateSpreadLayout={onUpdateSpreadLayout}
                    onUpdateCoverLayout={onUpdateCoverLayout}
                    onUpdateCoverType={onUpdateCoverType}
                    onUpdateSpineText={onUpdateSpineText}
                    onUpdateSpineSettings={onUpdateSpineSettings}
                    onUpdateTitleSettings={onUpdateTitleSettings}
                    onDownloadPage={onDownloadPage}
                    onUpdatePage={onUpdatePage}
                    viewMode={'full'}
                    onToggleViewMode={() => { }}
                    visibleTemplateCategories={visibleTemplateCategories}
                    allowedTemplateIds={allowedTemplateIds}
                    toast={toast}
                    onCycleLayout={cycleLayoutByPhotoCount}
                    onEnhanceWithAi={onEnhanceWithAi}
                    onUndo={onUndo}
                    onRedo={onRedo}
                    onOpenEditor={onOpenEditor}
                    onToggleLock={onToggleLock}
                    onMovePage={onMovePage}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                    customTemplates={customTemplates}
                    isDynamicMode={isDynamicMode}
                    onToggleDynamicMode={handleToggleDynamicMode}
                    dynamicModeDisabledReason={dynamicModeUnsupportedReason}
                    selectedDynamicImage={selectedDynamicImage}
                    onDeleteSelectedDynamicImage={handleDeleteSelectedDynamicImage}
                    onToggleSelectedDynamicImageRotationMode={handleToggleSelectedDynamicImageRotationMode}
                    config={config}
                />
            </div>
            <div className={cn("relative", page.type === 'single' && 'w-1/2 mx-auto')}>
                <AspectRatio
                    ratio={(
                        () => {
                            const sizeStr = config?.size || '800x600';
                            const [w, h] = sizeStr.split('x').map(Number);
                            const baseRatio = w / h;
                            if (page.isCover) {
                                const BASE_PAGE_PX = 450;
                                const pxPerUnit = BASE_PAGE_PX / h;
                                const singlePageW = w * pxPerUnit;
                                const spineWidth = page.spineWidth !== undefined ? page.spineWidth : 40;
                                const coverWidth = (singlePageW * 2) + spineWidth;
                                return coverWidth / BASE_PAGE_PX;
                            }
                            return page.type === 'spread' ? baseRatio * 2 : baseRatio;
                        }
                    )()}
                >
                    <Card className="h-full w-full border-none bg-transparent shadow-none">
                        <CardContent className="flex h-full w-full items-center justify-center p-0" style={{ padding: 0 }}>
                            <ScaledCoverPreview
                                page={page}
                                config={effectiveConfig}
                                onUpdatePage={onUpdatePage}
                                onUpdateTitleSettings={onUpdateTitleSettings}
                                onDropPhoto={onDropPhoto}
                                onDynamicDropPhoto={(_pageId, droppedPhotoId, payload) => {
                                    if (!isDynamicMode) return;
                                    void handleAddDynamicImageFromDrop(droppedPhotoId, payload);
                                }}
                                onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom}
                                onInteractionChange={setIsInteracting}
                                onRemovePhoto={onRemovePhoto}
                                onEnhancePhotoWithAi={onEnhancePhotoWithAi}
                                allPhotos={allPhotos}
                                previousPagePhotos={previousPagePhotos}
                                activeView="full"
                                priority={priority}
                                chronologicalIndex={chronologicalIndex}
                                templateName={currentTemplateName}
                                requiredLabel={currentRequiredLabel}
                                isLocked={!!page.isLocked}
                                dynamicMode={isDynamicMode}
                                dynamicModeDisabledReason={dynamicModeUnsupportedReason}
                                selectedDynamicImage={selectedDynamicImage}
                                onToggleDynamicMode={handleToggleDynamicMode}
                                onOpenDynamicTemplateDialog={handleOpenDynamicTemplateDialog}
                                canvaFrames={canvaFrames}
                                canvaFramesLoading={canvaFramesLoading}
                                onApplyCanvaFrameToSelectedDynamicImage={handleApplyCanvaFrameToSelectedDynamicImage}
                                onToggleSelectedDynamicImageRotationMode={handleToggleSelectedDynamicImageRotationMode}
                                onDeleteSelectedDynamicImage={handleDeleteSelectedDynamicImage}
                                onMatchSelectedDynamicFramesSize={handleMatchSelectedDynamicFramesSize}
                                onAlignSelectedDynamicFrames={handleAlignSelectedDynamicFrames}
                                activeDynamicImageIds={activeDynamicImageIds}
                                onSelectDynamicImage={handleSelectDynamicImage}
                                disableFrameDrop={isDynamicMode}
                                extraTemplates={customTemplates}
                                lockOverlayImageAspectRatio={isDynamicMode}
                            />
                        </CardContent>
                    </Card>
                </AspectRatio>
                {page.isLocked && (
                    <div
                        className="absolute inset-0 z-50 cursor-not-allowed"
                        onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    />
                )}
            </div>
            <Dialog
                open={isDynamicExitDialogOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCancelDynamicExit();
                    }
                }}
            >
                <DialogContent className="w-[min(94vw,620px)] max-w-[620px]">
                    <DialogHeader>
                        <DialogTitle>Save Dynamic Result as Template?</DialogTitle>
                        <DialogDescription>
                            Name a new template from this page result.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor={`dynamic-template-name-${page.id}`}>Template Name</Label>
                        <Input
                            id={`dynamic-template-name-${page.id}`}
                            value={dynamicTemplateName}
                            onChange={(e) => setDynamicTemplateName(e.target.value)}
                            placeholder="Dynamic Template"
                        />
                    </div>
                    <DialogFooter className="mt-3 grid w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 sm:space-x-0">
                        <Button className="w-full whitespace-nowrap" onClick={handleSaveDynamicTemplate}>
                            Save As Template
                        </Button>
                        <Button className="w-full whitespace-nowrap" variant="outline" onClick={handleCancelDynamicExit}>
                            Back To Dynamic
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {
                onAddSpread && !page.isCover && (
                    <div className="flex justify-center py-2">
                        <Button variant="outline" size="sm" className="opacity-40 hover:opacity-100 transition-opacity" onClick={() => onAddSpread(pageIndex)}>
                            <Plus className="h-4 w-4 mr-1" /> Add Spread
                        </Button>
                    </div>
                )
            }
        </div >
    );
});
PageCanvas.displayName = 'PageCanvas';
