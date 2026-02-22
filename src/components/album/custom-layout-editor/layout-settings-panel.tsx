import React from 'react';
import { Lock, LockOpen, SlidersHorizontal, X } from 'lucide-react';
import { TemplateImageRotationMode } from '@/lib/advanced-layout-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface LayoutSettingsPanelProps {
    photoGap: number;
    onPhotoGapChange: (value: number) => void;
    pageMargin: number;
    onPageMarginChange: (value: number) => void;
    cornerRadius: number;
    onCornerRadiusChange: (value: number) => void;
    backgroundColor: string;
    onBackgroundColorChange: (value: string) => void;
    imageRotationMode: TemplateImageRotationMode;
    onImageRotationModeChange: (value: TemplateImageRotationMode) => void;
    useDummyPhotos: boolean;
    onUseDummyPhotosChange: (value: boolean) => void;
    onDragStart?: (e: React.PointerEvent<HTMLDivElement>) => void;
    isDocked?: boolean;
    isDockLocked?: boolean;
    onToggleDockLock?: () => void;
    onClose?: () => void;
    onHeightChange?: (height: number) => void;
    className?: string;
}

export const LayoutSettingsPanel = ({
    photoGap,
    onPhotoGapChange,
    pageMargin,
    onPageMarginChange,
    cornerRadius,
    onCornerRadiusChange,
    backgroundColor,
    onBackgroundColorChange,
    imageRotationMode,
    onImageRotationModeChange,
    useDummyPhotos,
    onUseDummyPhotosChange,
    onDragStart,
    isDocked = false,
    isDockLocked = false,
    onToggleDockLock,
    onClose,
    onHeightChange,
    className
}: LayoutSettingsPanelProps) => {
    const rootRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const node = rootRef.current;
        if (!node || !onHeightChange) return;

        const notify = () => onHeightChange(node.getBoundingClientRect().height);
        notify();

        const observer = new ResizeObserver(notify);
        observer.observe(node);
        return () => observer.disconnect();
    }, [onHeightChange]);

    return (
        <div
            ref={rootRef}
            className={cn(
                "w-full bg-background pointer-events-auto",
                isDocked ? "border-0 rounded-none shadow-none" : "rounded-lg border shadow-lg",
                className
            )}
        >
            <div
                className={cn(
                    "border-b bg-muted/20 p-3 select-none",
                    onDragStart ? "cursor-move" : "cursor-default"
                )}
                onPointerDown={onDragStart}
            >
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Layout Settings
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {isDocked && onToggleDockLock && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleDockLock();
                                }}
                                title={isDockLocked ? "Undock panel" : "Lock dock"}
                            >
                                {isDockLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                            </Button>
                        )}
                        {onClose && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                }}
                                title="Close Layout Settings Panel"
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-3">
                <div className="space-y-3">
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground">Photo Gap</Label>
                        <div className="flex items-center justify-between gap-2">
                            <Slider
                                min={0}
                                max={50}
                                step={1}
                                value={[photoGap]}
                                onValueChange={(vals) => onPhotoGapChange(vals[0])}
                                className="w-24 flex-none"
                            />
                            <Input
                                type="number"
                                className="h-8 w-14 bg-muted/30 px-1 text-center text-xs"
                                value={photoGap}
                                min={0}
                                max={50}
                                onChange={(e) => onPhotoGapChange(Math.max(0, Math.min(50, Number(e.target.value))))}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground">Page Margin</Label>
                        <div className="flex items-center justify-between gap-2">
                            <Slider
                                min={0}
                                max={50}
                                step={1}
                                value={[pageMargin]}
                                onValueChange={(vals) => onPageMarginChange(vals[0])}
                                className="w-24 flex-none"
                            />
                            <Input
                                type="number"
                                className="h-8 w-14 bg-muted/30 px-1 text-center text-xs"
                                value={pageMargin}
                                min={0}
                                max={50}
                                onChange={(e) => onPageMarginChange(Math.max(0, Math.min(50, Number(e.target.value))))}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground">Corner Radius</Label>
                        <div className="flex items-center justify-between gap-2">
                            <Slider
                                min={0}
                                max={20}
                                step={1}
                                value={[cornerRadius]}
                                onValueChange={(vals) => onCornerRadiusChange(vals[0])}
                                className="w-24 flex-none"
                            />
                            <Input
                                type="number"
                                className="h-8 w-14 bg-muted/30 px-1 text-center text-xs"
                                value={cornerRadius}
                                min={0}
                                max={20}
                                onChange={(e) => onCornerRadiusChange(Math.max(0, Math.min(20, Number(e.target.value))))}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground">Background</Label>
                        <div className="flex items-center justify-between gap-2">
                            <div
                                className="relative h-8 w-9 overflow-hidden rounded border border-border"
                                style={{ backgroundColor }}
                                title={backgroundColor}
                            >
                                <input
                                    type="color"
                                    value={backgroundColor}
                                    onChange={(e) => onBackgroundColorChange(e.target.value)}
                                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                />
                            </div>
                            <Input
                                type="text"
                                className="h-8 w-[7.25rem] bg-muted/30 px-2 text-center font-mono text-xs"
                                value={backgroundColor}
                                onChange={(e) => {
                                    const val = e.target.value.trim();
                                    if (/^#[0-9A-Fa-f]{6}$/.test(val)) onBackgroundColorChange(val);
                                    if (val === '') onBackgroundColorChange('#ffffff');
                                }}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground">Image Mode</Label>
                        <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/20 p-1">
                            <Button
                                type="button"
                                variant={imageRotationMode === 'follow-frame' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-8 w-full justify-start px-2 text-[11px]"
                                onClick={() => onImageRotationModeChange('follow-frame')}
                            >
                                Follow Frame
                            </Button>
                            <Button
                                type="button"
                                variant={imageRotationMode === 'keep-horizontal' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-8 w-full justify-start px-2 text-[11px]"
                                onClick={() => onImageRotationModeChange('keep-horizontal')}
                            >
                                Keep Horizontal
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border/50 bg-muted/10 px-3 py-2">
                        <Label htmlFor="dummy-photos-floating-panel" className="cursor-pointer text-xs font-semibold">
                            Sample Photos
                        </Label>
                        <Switch
                            id="dummy-photos-floating-panel"
                            checked={useDummyPhotos}
                            onCheckedChange={onUseDummyPhotosChange}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
