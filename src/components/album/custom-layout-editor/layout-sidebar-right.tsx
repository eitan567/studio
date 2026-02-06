import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useTemplates } from '@/hooks/useTemplates';
import { cn } from '@/lib/utils';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LayoutSidebarRightProps {
    selectedLayout: string;
    onSelectLayout: (layoutId: string) => void;
    spreadMode: 'full' | 'split';
    onSpreadModeChange: (mode: 'full' | 'split') => void;
    photoGap: number;
    onPhotoGapChange: (gap: number) => void;
    pageMargin: number;
    onPageMarginChange: (margin: number) => void;
    cornerRadius: number;
    onCornerRadiusChange: (radius: number) => void;
    useDummyPhotos: boolean;
    onUseDummyPhotosChange: (use: boolean) => void;
}

export const LayoutSidebarRight = ({
    selectedLayout,
    onSelectLayout,
    spreadMode,
    onSpreadModeChange,
    photoGap,
    onPhotoGapChange,
    pageMargin,
    onPageMarginChange,
    cornerRadius,
    onCornerRadiusChange,
    useDummyPhotos,
    onUseDummyPhotosChange
}: LayoutSidebarRightProps) => {
    const { allTemplates } = useTemplates();

    // Filter templates by category and type
    const systemTemplates = allTemplates.filter(t => t.createdBy === 'system' && t.category === 'grid');
    const userTemplates = allTemplates.filter(t => t.createdBy === 'user' || t.isCustom);

    const filterByMode = (templates: typeof allTemplates) => {
        const type = spreadMode === 'split' ? 'single' : 'spread';
        return templates.filter(t => {
            if (t.type) return t.type === type || t.type === 'both';
            // Default system grids to spread if not explicitly typed
            return t.createdBy === 'system' ? type === 'spread' : false;
        });
    };

    const filteredSystem = filterByMode(systemTemplates);
    const filteredUser = filterByMode(userTemplates);

    return (
        <div className="w-full h-full border-l bg-background flex flex-col shrink-0 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b h-14 flex items-center justify-between bg-accent/5">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-primary flex items-center gap-2">
                    <Settings2 className="w-4 h-4" /> Layout Properties
                </h2>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Template Type */}
                <div className="space-y-3">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Template Type
                    </Label>
                    <div className="flex gap-2">
                        <Button
                            variant={spreadMode === 'full' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1"
                            onClick={() => onSpreadModeChange('full')}
                        >
                            Double Page
                        </Button>
                        <Button
                            variant={spreadMode === 'split' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1"
                            onClick={() => onSpreadModeChange('split')}
                        >
                            Single Page
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {spreadMode === 'full'
                            ? 'Double Page: Create a template spanning the full spread.'
                            : 'Single Page: Create a template for a single page (applies to L or R).'}
                    </p>
                </div>

                {/* System Layout Templates */}
                <div className="space-y-3">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Standard Layouts
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                        {filteredSystem.map((template) => (
                            <button
                                key={template.id}
                                onClick={() => onSelectLayout(String(template.id))}
                                className={cn(
                                    "aspect-[4/3] rounded-md border-2 p-1 transition-all hover:border-primary/50",
                                    selectedLayout === template.id
                                        ? "border-primary bg-primary/5"
                                        : "border-muted bg-muted/30"
                                )}
                                title={template.name}
                            >
                                <div className="w-full h-full relative overflow-hidden">
                                    {template.regions?.map((region, idx) => (
                                        region.shape === 'path' ? (() => {
                                            const vb = region.viewBox ? region.viewBox.split(' ').map(Number) : [0, 0, 100, 100];
                                            const [vx, vy, vw, vh] = vb;
                                            return (
                                                <svg
                                                    key={idx}
                                                    className="absolute overflow-visible"
                                                    viewBox={`${vx} ${vy} ${vw} ${vh}`}
                                                    preserveAspectRatio="xMidYMid slice"
                                                    style={{
                                                        left: `${region.bounds.x}%`,
                                                        top: `${region.bounds.y}%`,
                                                        width: `${region.bounds.width}%`,
                                                        height: `${region.bounds.height}%`,
                                                    }}
                                                >
                                                    <defs>
                                                        <clipPath id={`preview-clip-${template.id}-${idx}`}>
                                                            <path d={region.path} />
                                                        </clipPath>
                                                    </defs>
                                                    <g clipPath={`url(#preview-clip-${template.id}-${idx})`}>
                                                        {/* Simplified Canva-style placeholder for preview */}
                                                        <rect x={vx - 10} y={vy - 10} width={vw + 20} height={vh + 20} fill="#d4eaf7" />
                                                        <circle cx={vx + vw * 0.8} cy={vy + vh * 0.15} r={vw * 0.1} fill="#fdf2a4" />
                                                        <path d={`M${vx - vw * 0.2},${vy + vh} Q${vx + vw * 0.3},${vy + vh * 0.5} ${vx + vw * 0.8},${vy + vh * 1.1} Z`} fill="#90d5ac" />
                                                        <path d={`M${vx + vw * 0.4},${vy + vh * 1.1} Q${vx + vw * 0.8},${vy + vh * 0.6} ${vx + vw * 1.2},${vy + vh} Z`} fill="#76c893" />
                                                    </g>
                                                    {/* Subtle outline to show the shape boundary */}
                                                    <path d={region.path} fill="none" stroke="currentColor" strokeWidth={vw * 0.01} className="opacity-10" />
                                                </svg>
                                            );
                                        })() : (
                                            <div
                                                key={idx}
                                                className="absolute bg-muted-foreground/20 rounded-[1px]"
                                                style={{
                                                    left: `${region.bounds.x}%`,
                                                    top: `${region.bounds.y}%`,
                                                    width: `${region.bounds.width}%`,
                                                    height: `${region.bounds.height}%`,
                                                }}
                                            />
                                        )
                                    ))}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* User Layout Templates */}
                {filteredUser.length > 0 && (
                    <div className="space-y-3">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            My Layouts
                        </Label>
                        <div className="grid grid-cols-3 gap-2">
                            {filteredUser.map((template) => (
                                <button
                                    key={template.id}
                                    onClick={() => onSelectLayout(String(template.id))}
                                    className={cn(
                                        "aspect-[4/3] rounded-md border-2 p-1 transition-all hover:border-primary/50",
                                        selectedLayout === template.id
                                            ? "border-primary bg-primary/5"
                                            : "border-muted bg-muted/30"
                                    )}
                                    title={template.name}
                                >
                                    <div className="w-full h-full relative">
                                        {template.regions?.map((region, idx) => (
                                            <div
                                                key={idx}
                                                className="absolute bg-muted-foreground/20 rounded-sm"
                                                style={{
                                                    left: `${region.bounds.x}%`,
                                                    top: `${region.bounds.y}%`,
                                                    width: `${region.bounds.width}%`,
                                                    height: `${region.bounds.height}%`,
                                                }}
                                            />
                                        ))}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Spacing Controls */}


            </div>
        </div>
    );
};
